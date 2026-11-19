const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const val = n => $(`input[name=${n}]:checked`).value;
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let pool = [], idx = 0, cur, ok = 0, total = 0, streak = 0, answered = false;

// ── Progression enregistrée sur l'appareil ──
// prog : { id: [réussites, échecs, dernière réponse juste 0/1, boîte de révision, échéance] } (voir learn.js)
// extra : { best: meilleure série, exams: [{date, pct}], defi: {date: score}, tally: {type d'erreur: nombre} }
const KEY = 'phraseo-progress-v1', KEY2 = 'phraseo-extra-v1';
let prog = {}, extra = {};
try { prog = JSON.parse(localStorage.getItem(KEY)) || {}; } catch {}
try { extra = JSON.parse(localStorage.getItem(KEY2)) || {}; } catch {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(prog)); localStorage.setItem(KEY2, JSON.stringify(extra)); } catch {} };
const isErr = q => prog[q.id]?.[2] === 0;
const isDue = q => isDueP(prog[q.id]);
function record(good) {
  prog[cur.id] = leitner(prog[cur.id], good);
  save(); errCount();
}
function errCount() {
  $('label[for=r-err]').textContent = `❌ Mes erreurs (${QUESTIONS.filter(isErr).length})`;
  $('label[for=r-due]').textContent = `📅 À réviser (${QUESTIONS.filter(isDue).length})`;
}

// Catégories pour les statistiques
// (la phase se déduit du message : sur un petit terrain, c'est la Tour qui gère aussi le roulage)
const PHASES = [[/Prévol|Delivery|mise en route|start-up/i, 'Clairance IFR'],
  [/roul|taxi|maintenez avant|hold short|consignes de roulage/i, 'Roulage'],
  [/décoll|take-off|align|line up|atterri|land|vent arrière|downwind|base|remettez|go around|transpondeur|squawk|Info/i, 'Tour (décollage, circuit, atterrissage)'],
  [/./, 'Approche / en route']];
const cats = q => q.regle === 'alpha' ? [['Thème', 'Alphabet OACI']] : [
  ['Langue', q.lang === 'en' ? 'Anglais' : 'Français'], ['Règles', q.regle.toUpperCase()],
  ['Sujet / phase', q.cat ? SUJETS[q.cat]
    : q.st ? PHASES.find(([r]) => r.test(`${q.st} ${q.atc} ${q.answers[0]}`))[1] : 'Théorie (codes, collationnement…)']];

function showStats() {
  const g = {};
  for (const q of QUESTIONS) for (const [grp, c] of cats(q)) {
    const t = ((g[grp] ||= {})[c] ||= [0, 0]), p = prog[q.id];
    if (p) { t[0] += p[0]; t[1] += p[1]; }
  }
  const color = pct => pct == null ? 'transparent' : pct >= 80 ? 'var(--ok)' : pct >= 50 ? '#d97706' : 'var(--ko)';
  const rows = Object.entries(g).map(([grp, cs]) => `<tr><th colspan="3">${grp}</th></tr>` + Object.entries(cs).map(([c, [o, k]]) => {
    const n = o + k, pct = n ? Math.round(100 * o / n) : null;
    return `<tr><td>${esc(c)}</td><td><div class="meter"><div style="width:${pct ?? 0}%;background:${color(pct)}"></div></div></td>
      <td class="num">${pct == null ? '—' : pct + ' %'} <span class="muted">(${n})</span></td></tr>`;
  }).join('')).join('');
  const answered = Object.values(prog).reduce((s, p) => s + p[0] + p[1], 0);
  const b = bilan(extra.tally, answered);
  const weak = Object.entries(g['Sujet / phase'] || {}).map(([c, [o, k]]) => [c, o + k ? o / (o + k) : 1, o + k])
    .filter(([, r, n]) => n >= 5 && r < 0.7).sort((x, y) => x[1] - y[1]).slice(0, 2);
  const bil = !b.pret ? `<p class="muted">Bilan disponible après 50 réponses (encore ${b.reste}).</p>`
    : `${b.top.length ? `<ul>${b.top.map(t => `<li><strong>${esc(t.titre)}</strong> (${t.n} fois) : ${esc(t.conseil)}
        <button class="ghost" data-cible="${t.key}">🎯 S’entraîner</button> <button class="ghost" data-fiche="${t.fiche}">📚 Fiche</button></li>`).join('')}</ul>`
        : '<p>Aucune erreur type relevée. Continuez !</p>'}
      ${weak.length ? `<p>À travailler en priorité : ${weak.map(([c, r]) => `<strong>${esc(c)}</strong> (${Math.round(r * 100)} %)`).join(', ')}.</p>` : ''}
      <p class="muted">${QUESTIONS.filter(isDue).length} exercice(s) à réviser aujourd’hui (thème « 📅 À réviser »).</p>`;
  $('#statsBody').innerHTML = `<h3>🧭 Bilan personnalisé</h3>${bil}
    <h3>🏅 Badges</h3><div class="badges">${badges(QUESTIONS, prog, extra).map(x =>
      `<span class="badge ${x.ok ? 'got' : ''}" title="${esc(x.desc)}">${x.icon} ${esc(x.nom)}<small>${esc(x.desc)}</small></span>`).join('')}</div>
    <h3>📊 Réussite par catégorie</h3><table>${rows}</table>`;
  $$('#statsBody [data-fiche]').forEach(x => x.addEventListener('click', () => { $('#stats').close(); openFiche(x.dataset.fiche); }));
  $$('#statsBody [data-cible]').forEach(x => x.addEventListener('click', () => { $('#stats').close(); start({ type: 'cible', kind: x.dataset.cible }); }));
  $('#stats').showModal();
}

// session : null (entraînement libre), { type: 'exam' } (examen blanc) ou { type: 'defi' } (défi du jour)
let session = null, timer = null;
const EXAM_N = 20, EXAM_MIN = 15;
const today = () => new Date().toISOString().slice(0, 10);
// examen et défi en QCM ; l'entraînement ciblé garde le mode choisi
const modeNow = () => session && session.type !== 'cible' ? 'qcm' : val('mode');
const words = s => s.split(' ').length;

function start(sess = null) {
  session = sess; clearInterval(timer);
  const l = val('lang'), r = val('regle'), m = modeNow(), chrono = !session && $('#chrono').checked, su = $('#sujet').value;
  const langOk = q => l === 'all' || q.regle === 'alpha' || q.lang === l;
  if (session?.type === 'defi') pool = dailyPick(QUESTIONS, today(), 10); // identique pour tout le monde
  else if (session?.type === 'cible') // entraînement ciblé sur un type d'erreur du bilan
    pool = cible(QUESTIONS, session.kind).filter(q => langOk(q) && (m === 'qcm' || !q.qcmOnly) && (q.niv || 1) <= +val('niv'))
      .sort(() => Math.random() - 0.5).slice(0, 15);
  else if (session?.type === 'exam') // examen blanc : tous sujets, selon la langue choisie
    pool = QUESTIONS.filter(q => langOk(q) && (q.niv || 1) <= 2).sort(() => Math.random() - 0.5).slice(0, EXAM_N);
  else {
    pool = QUESTIONS.filter(q => (su === 'all' || r === 'alpha' || (q.cat || 'base') === su) &&
      (r === 'err' ? isErr(q) && langOk(q) : r === 'due' ? isDue(q) && langOk(q)
        : r === 'alpha' ? q.regle === 'alpha' : q.regle !== 'alpha' && (r === 'all' || q.regle === r) && langOk(q))
      && (m === 'qcm' || !q.qcmOnly) && (m !== 'dictee' || (q.atc && !q.q && words(q.atc) >= 8))
      && (!chrono || r === 'alpha' || r === 'err' || q.st) && (q.niv || 1) <= +val('niv'));
    if (!chrono) {
      if (r !== 'err' && r !== 'due') pool = pool.concat(pool.filter(isErr)); // les questions ratées reviennent deux fois plus souvent
      pool.sort(() => Math.random() - 0.5);
    }
  }
  if (session) {
    session.log = []; session.t0 = Date.now();
    if (session.type === 'exam') { session.deadline = session.t0 + EXAM_MIN * 60000; timer = setInterval(tick, 1000); }
  }
  idx = ok = total = streak = 0;
  // un indicatif par série, comme un vrai vol ; F-GBCD pour le défi du jour (identique pour tous)
  series = $('#random').checked && session?.type !== 'defi' ? newCallsign() : 'F-GBCD';
  memo = {}; // même piste et mêmes codes pendant toute la série
  stats();
  next();
}

// ── Réalisme : prépare la carte (valeurs aléatoires, indicatif abrégé, message pour un autre avion, coupure) ──
let series = 'F-GBCD', memo = {};
function prepare(q) {
  if (q.regle === 'alpha' || q.prepared) return q;
  const en = q.lang === 'en', chrono = $('#chrono').checked;
  // indicatif abrégé : seulement après un premier échange et à l'initiative du contrôleur (Manuel p. 18)
  const short = !session && !!q.atc && q.cat !== 'atis' && !q.elements && q.st && (chrono ? idx > 1 : Math.random() < 0.3);
  const shown = short ? abbrev(series) : series;
  let c = vary(q, { cs: series, shown, values: $('#random').checked && session?.type !== 'defi', memo });
  if (short && !chrono) c.ctx += en ? ' (The controller already uses your abbreviated callsign.)' : ' (Le contrôleur utilise déjà votre indicatif abrégé.)';
  c.shown = shown; c.prepared = true;
  if (session) return c; // examen et défi : pas de piège radio
  if (modeNow() === 'dictee') return { ...c, answers: [c.atc], dictee: true,
    q: en ? 'Write down the whole message:' : 'Notez le message complet :', src: `${c.src} (dictée du message)` };
  if ($('#busy').checked && c.atc && c.st && !c.q && Math.random() < 0.3) {
    const other = Math.random() < 0.5 ? similarCallsign(series) : newCallsign();
    return { ...c, atc: c.atc.replace(shown, other), notMine: other };
  }
  const cut = $('#cuts').checked && c.atc && !c.q && c.cat !== 'atis' && Math.random() < 0.3 && cutMessage(c.atc);
  if (cut) return { ...c, cut, full: c, qcmOnly: false, niv: 1,
    q: en ? 'The end of the message was cut off. What do you say?' : 'La fin du message a été coupée. Que dites-vous ?',
    answers: [en ? `Say again all after ${cut.word}, ${shown}` : `Répétez tout après ${cut.word}, ${shown}`],
    wrong: en ? [`Roger, ${shown}`, `Say again all before ${cut.word}, ${shown}`, `Wilco, ${shown}`]
      : [`Roger, ${shown}`, `Répétez tout avant ${cut.word}, ${shown}`, `Wilco, ${shown}`],
    src: SERA('SERA.14075 c) 4)') };
  return c;
}

function stats() {
  $('#score').textContent = `${ok} / ${total}`;
  $('#streak').textContent = `🔥 ${streak}`;
  const pc = pool.length ? Math.round(100 * idx / pool.length) : 0;
  $('#prog').style.width = pc + '%'; $('#bar').setAttribute('aria-valuenow', pc);
}

function next() {
  speechSynthesis.cancel(); stopHiss(); stopRecording();
  if (myAudio) { URL.revokeObjectURL(myAudio); myAudio = null; }
  if (!pool.length) { $('#card').innerHTML = '<p class="ctx">Aucune question pour ces réglages.</p>'; return; }
  if (idx >= pool.length) return end();
  cur = prepare(pool[idx++]);
  answered = false;
  stats();
  const mode = modeNow(), en = cur.lang === 'en';
  const listen = ($('#ecoute').checked || LEVELS[val('niv')].listen || cur.dictee) && cur.atc;
  const q = cur.q || (en ? 'Read back this instruction:' : 'Collationnez :');
  const badge = session ? `<span class="tag sess">${session.type === 'exam' ? '🎓 Examen blanc'
    : session.type === 'cible' ? `🎯 ${esc(CONSEILS[session.kind]?.[0] || 'Entraînement ciblé')}` : `🏆 Défi du ${today()}`}</span>` : '';
  let h = `<div class="radio"><span class="led" id="led"></span><span>COM1</span><strong>${esc(cur.st || '—')}</strong>
    <span class="prog">${session?.type === 'exam' ? '<span id="timer" class="me"></span>' : ''}<span class="me" title="Votre indicatif">✈ ${esc(series)}</span> ${idx} / ${pool.length}</span></div>
    <div class="tags">${badge}<span class="tag">${cur.regle === 'alpha' ? 'OACI' : cur.regle.toUpperCase()}</span>${cur.regle === 'alpha' ? '' : `<span class="tag">${en ? 'EN' : 'FR'}</span>`}${!session && isErr(cur) ? '<span class="tag err">À revoir</span>' : ''}</div>
    <p class="ctx">${esc(cur.ctx)}</p>`;
  if (cur.atc) h += `<div class="bubble atc"><div class="who">${cur.who || 'ATC'}</div>
    <p class="msg ${listen ? 'hidden' : ''}" id="atc" ${listen ? 'aria-hidden="true"' : ''}>${cur.cut ? `${esc(cur.cut.heard)} <span class="cut">▒▒▒▒ ${en ? '(cut off)' : '(coupé)'}</span>` : esc(cur.atc)}</p>
    <div class="row tight"><button class="ghost" id="hear">🔊 ${listen ? 'Réécouter' : 'Écouter'}</button>
    ${$('#busy').checked ? `<button class="ghost" id="nm" title="Ce message est pour un autre avion">🚫 ${en ? 'Not for me' : 'Pas pour moi'}</button>` : ''}</div></div>`;
  h += `<p class="q">${esc(q)}</p>`;
  if (mode === 'qcm') {
    const opts = [cur.answers[0], ...cur.wrong].sort(() => Math.random() - 0.5);
    h += `<div class="opts">${opts.map((o, i) => `<button data-o="${esc(o)}"><span class="n">${i + 1}</span><span>${esc(o)}</span></button>`).join('')}</div>`;
  } else if (mode === 'ecrit' || mode === 'dictee') {
    h += `<textarea id="txt" aria-label="${en ? 'Your answer' : 'Votre réponse'}" placeholder=""${cur.dictee ? (en ? 'The message…' : 'Le message…') : en ? 'Your readback…' : 'Votre collationnement…'}"></textarea>
      <div class="row"><button class="primary" id="go">Valider</button></div>`;
  } else {
    h += SR ? `<div class="row"><button class="primary mic" id="mic">🎤 Appuyer pour parler</button><span id="heard" class="muted"></span></div>`
      : '<p class="warn">La reconnaissance vocale n’est pas disponible dans ce navigateur. Utilisez Chrome ou Edge.</p>';
  }
  h += '<div id="fb" role="status" aria-live="polite"></div>';
  $('#card').innerHTML = h;
  $('#card').lang = cur.regle === 'alpha' ? 'fr' : cur.lang; // prononciation correcte par les lecteurs d'écran

  $('#hear')?.addEventListener('click', () => say());
  $('#nm')?.addEventListener('click', () => { if (!answered) feedback(!!cur.notMine, { nm: true }); });
  $$('.opts button').forEach(b => b.addEventListener('click', () => pick(b)));
  $('#go')?.addEventListener('click', () => grade($('#txt').value));
  $('#mic')?.addEventListener('click', listenMic);
  if (listen) say();
  ($('#txt') || $('.opts button') || $('#mic'))?.focus();
  tick();
}

// Chronomètre de l'examen blanc
function tick() {
  if (session?.type !== 'exam') return;
  const left = Math.max(0, session.deadline - Date.now());
  if ($('#timer')) $('#timer').textContent = `⏱ ${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`;
  if (!left) { clearInterval(timer); end(); }
}

// ── Voix du contrôleur ──
// Niveaux : débit de parole, souffle radio (volume du bruit), écoute seule imposée.
const LEVELS = { 1: { rate: 0.9, hiss: 0 }, 2: { rate: 1.15, hiss: 0.012 }, 3: { rate: 1.35, hiss: 0.03, listen: true } };
const NOVELTY = /bells|bubbles|boing|cellos|whisper|zarvox|trinoids|organ|jester|superstar|bad news|good news|wobble|bahh|albert|hysterical|deranged|pipe/i;
const hash = s => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

// Meilleures voix installées d'abord ; chaque poste (Sol, Tour, Approche…) garde « son » contrôleur.
function pickVoice(lang, st = '') {
  // en anglais, à partir du niveau Confirmé, toutes les variantes (GB, US, AU, IE, IN…) : accents variés selon le poste
  const region = lang === 'fr' || val('niv') === '1';
  const good = v => (/premium|enhanced|natural|neural|google/i.test(v.name) ? 2 : 0) + (region && /GB|FR/.test(v.lang) ? 1 : 0)
    - (/eloquence|^(eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley)\b/i.test(v.voiceURI + ' ' + v.name) ? 3 : 0); // voix peu naturelles (macOS)
  const vs = speechSynthesis.getVoices() // voix « fantaisie » macOS (Bells, Jester/Bouffon…) : noms traduits, on filtre aussi par voiceURI
    .filter(v => v.lang.toLowerCase().startsWith(lang) && !NOVELTY.test(v.name) && !/speech\.synthesis\.voice/.test(v.voiceURI))
    .sort((a, b) => good(b) - good(a)).filter((v, _, a) => good(v) === good(a[0])); // seulement les meilleures
  return vs[hash(st) % (vs.length || 1)];
}

let ac, noiseBuf, hissNode;
function audio() {
  if (!ac) {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
// Bruit blanc filtré dans la bande radio VHF (300–3000 Hz) ; `secs` = durée, sinon en boucle.
function noise(vol, secs) {
  const c = audio(), src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  src.buffer = noiseBuf; src.loop = !secs;
  f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.8; g.gain.value = vol;
  src.connect(f).connect(g).connect(c.destination);
  src.start();
  if (secs) src.stop(c.currentTime + secs);
  return src;
}
function stopHiss() { try { hissNode?.stop(); } catch {} hissNode = null; }

// `text` par défaut : le message de la carte (ou sa partie reçue si la fin est coupée).
function say(text = cur.cut ? cur.cut.heard : cur.atc) {
  speechSynthesis.cancel(); stopHiss();
  const L = LEVELS[val('niv')], v = pickVoice(cur.lang, cur.st), cut = cur.cut && text === cur.cut.heard;
  const u = new SpeechSynthesisUtterance(speakable(text, cur.lang));
  u.lang = v?.lang || (cur.lang === 'en' ? 'en-GB' : 'fr-FR');
  if (v) u.voice = v;
  u.rate = L.rate;
  u.pitch = 0.9 + (hash(cur.st || '') % 3) * 0.08;
  u.onstart = () => $('#led')?.classList.add('tx');
  u.onend = u.onerror = () => {
    $('#led')?.classList.remove('tx');
    if (L.hiss) { stopHiss(); noise(L.hiss * 6, 0.12); } // squelch de fin d'émission
    if (cut) noise(0.15, 1.2); // la fin du message est couverte par le bruit
  };
  if (L.hiss) { noise(L.hiss * 6, 0.08); hissNode = noise(L.hiss); } // alternat + souffle porteuse
  setTimeout(() => speechSynthesis.speak(u), L.hiss ? 150 : 0);
}
speechSynthesis.onvoiceschanged = () => {}; // force le chargement de la liste des voix (Chrome)

function pick(b) {
  if (answered) return;
  const good = !cur.notMine && b.dataset.o === cur.answers[0];
  $$('.opts button').forEach(x => { x.disabled = true; if (!cur.notMine && x.dataset.o === cur.answers[0]) x.classList.add('good'); });
  if (!good) b.classList.add('bad');
  feedback(good, { chosen: b.dataset.o });
}

function listenMic() {
  const rec = new SR(), mic = $('#mic');
  rec.lang = cur.lang === 'en' ? 'en-GB' : 'fr-FR';
  mic.disabled = true; mic.classList.add('on'); mic.textContent = '🔴 À vous…';
  rec.onresult = e => grade(e.results[0][0].transcript);
  rec.onerror = e => { $('#heard').textContent = `Erreur micro : ${e.error}`; };
  rec.onend = () => { stopRecording(); if (!answered) { mic.disabled = false; mic.classList.remove('on'); mic.textContent = '🎤 Réessayer'; } };
  rec.start();
  startRecording();
}

// ── Enregistrement de sa propre voix (mode oral), pour la réécouter à côté du message du contrôleur ──
// L'enregistrement reste dans la page : rien n'est envoyé ni sauvegardé.
let mediaRec = null, myAudio = null;
function startRecording() {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return;
  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    const chunks = [], card = cur;
    mediaRec = new MediaRecorder(stream);
    mediaRec.ondataavailable = e => chunks.push(e.data);
    mediaRec.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      if (card !== cur) return; // carte déjà changée
      if (myAudio) URL.revokeObjectURL(myAudio);
      myAudio = URL.createObjectURL(new Blob(chunks, { type: mediaRec.mimeType }));
      showMyVoice();
    };
    mediaRec.start();
  }).catch(() => {}); // micro refusé : la reconnaissance vocale continue sans enregistrement
}
function stopRecording() { if (mediaRec?.state === 'recording') mediaRec.stop(); }
function showMyVoice() {
  const row = $('#fb .row');
  if (!row || !myAudio || $('#myVoice')) return;
  row.insertAdjacentHTML('afterbegin', '<button id="myVoice">▶️ Ma réponse</button><button id="atcVoice">🔊 Le contrôleur</button>');
  $('#myVoice').addEventListener('click', () => { speechSynthesis.cancel(); new Audio(myAudio).play(); });
  $('#atcVoice').addEventListener('click', () => say(cur.cut ? cur.full.atc : cur.atc));
}

function grade(text) {
  if (answered || !text.trim()) return;
  if (cur.regle === 'alpha') {
    const w = s => s.toLowerCase().replace(/[^a-z]/g, '');
    return feedback(cur.answers.some(a => w(a) === w(text)), { said: text });
  }
  if (cur.notMine) return feedback(false, { said: text });
  if (cur.elements) { // premier appel libre : éléments obligatoires dans l'ordre
    const r = gradeElements(text, cur.elements, cur.callsigns);
    return feedback(r.pass, { said: text, notes: r.notes });
  }
  const r = check(text, cur.answers, cur.callsigns);
  const diff = diffWords(text, r.ans, cur.callsigns);
  feedback(r.pass, { said: text, diff, notes: diff.notes, ans: r.ans });
}

const paint = (cs, cls) => cs.map(c => c.bad ? `<span class="${cls}">${esc(c.text)}</span>` : esc(c.text)).join(' ');

function feedback(good, { said = '', diff, notes = [], ans = cur.answers[0], nm = false, chosen = '' } = {}) {
  answered = true;
  const counted = !cur.retry;
  if (counted) {
    if (!cur.notMine && !cur.cut && !cur.dictee) record(good); // ces cartes ne touchent pas la révision
    total++; if (good) { ok++; streak++; } else streak = 0;
    extra.best = Math.max(extra.best || 0, streak);
    if (!good) for (const k of classify(notes, said)) (extra.tally ||= {})[k] = (extra.tally[k] || 0) + 1; // pour le bilan
    save();
  }
  if (session) session.log.push({ q: cur, good, chosen: chosen || said });
  if (session?.type === 'exam') return next(); // examen : correction seulement à la fin
  stats();
  $('#atc')?.classList.remove('hidden'); $('#atc')?.removeAttribute('aria-hidden');
  if ($('#go')) $('#go').disabled = true;
  if ($('#mic')) { $('#mic').disabled = true; $('#mic').classList.remove('on'); $('#mic').textContent = '🎤'; }
  let head = good ? '✅ Correct' : '❌ À revoir';
  if (cur.notMine) head = good ? `✅ Bien vu : ce message était pour ${cur.notMine}, on ne répond pas.`
    : `❌ Ce message était pour ${cur.notMine}, pas pour vous (${cur.shown}) : il ne fallait pas répondre.`;
  else if (nm) head = `❌ Ce message était pour vous (${cur.shown}) : il fallait répondre.`;
  if (cur.retry) head = `2e essai (non compté) : ${head}`;
  const canRetry = !good && !cur.retry && !cur.notMine && !nm && !cur.cut && !cur.elements && !cur.dictee && cur.atc && modeNow() !== 'qcm';
  const why = whyRules(cur), fiche = FICHES.find(f => f.id === why.fiche);
  $('#fb').innerHTML = `<div class="fb ${good ? 'ok' : 'ko'}">
    <p><strong>${esc(head)}</strong></p>
    ${notes.length ? `<ul class="notes">${notes.slice(0, 6).map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
    ${said ? `<p>Votre réponse : <span class="said">${diff ? paint(diff.U, 'extra') : esc(said)}</span></p>` : ''}
    ${cur.notMine ? '' : `<p>Réponse attendue : <strong>${diff ? paint(diff.E, 'miss') : esc(ans)}</strong></p>`}
    <p class="src">📘 Source : ${esc(cur.notMine ? `${MANUEL(24)} (confusion d’indicatifs)` : cur.src)}</p>
    <details class="why"><summary>❓ Pourquoi ?</summary><ul>${why.regles.map(r => `<li>${esc(r.texte)} <span class="src">(${esc(r.src)})</span></li>`).join('')}</ul>
      ${fiche ? `<button class="ghost" data-fiche="${fiche.id}">📚 Fiche : ${esc(fiche.titre)}</button>` : ''}</details>
    <div class="row">${canRetry ? '<button id="again1">🔁 Le contrôleur corrige (« Négatif je répète »)</button>' : ''}
    <button class="primary" id="nx">Suivant →</button></div></div>`;
  if (cur.cut) pool.splice(idx, 0, cur.full); // le contrôleur répète : on collationne le message complet
  $('#again1')?.addEventListener('click', retry);
  showMyVoice();
  $('#fb [data-fiche]')?.addEventListener('click', e => openFiche(e.target.dataset.fiche));
  $('#nx').addEventListener('click', next);
  $('#nx').focus();
}

// SERA.14075 d) : « NÉGATIF JE RÉPÈTE » suivi de la version correcte ; nouvel essai non compté.
function retry() {
  cur.retry = true; answered = false;
  const body = cur.atc.replace(/^[^,]+,\s*/, '');
  say(cur.lang === 'en' ? `${cur.shown}, negative I say again, ${body}` : `${cur.shown}, négatif je répète, ${body}`);
  $('#fb').innerHTML = `<p class="muted">${cur.lang === 'en' ? 'Negative I say again…' : 'Négatif je répète…'} Collationnez à nouveau (essai non compté).</p>`;
  if ($('#txt')) { $('#txt').value = ''; $('#go').disabled = false; $('#txt').focus(); }
  if ($('#mic')) { $('#mic').disabled = false; $('#mic').textContent = '🎤 Appuyer pour parler'; }
}

function end() {
  clearInterval(timer); speechSynthesis.cancel(); stopHiss();
  stats();
  const n = session?.type === 'exam' ? pool.length : total; // examen : les questions sans réponse comptent fausses
  const pct = n ? Math.round(100 * ok / n) : 0;
  let title = 'FIN DE SÉRIE', body = `<p class="ctx">Série terminée : ${ok} / ${total} (${pct} %)</p>`;
  if (session?.type === 'exam') {
    const mins = Math.round((Date.now() - session.t0) / 60000);
    (extra.exams ||= []).push({ date: today(), pct }); save();
    const ko = session.log.filter(x => !x.good);
    title = 'EXAMEN BLANC';
    body = `<p class="ctx">${pct >= 75 ? '✅' : '❌'} Note : ${ok} / ${n} (${pct} %) en ${mins} min.
      ${n > total ? `${n - total} question(s) sans réponse (temps écoulé).` : ''}</p>
      <p class="muted" style="margin:0 20px">Format d'entraînement (${EXAM_N} questions, ${EXAM_MIN} min) : ce n'est pas le format officiel d'un examen.</p>
      ${ko.length ? `<ol class="review">${ko.map(x => `<li><strong>${esc(x.q.q || x.q.atc)}</strong><br>
        Votre réponse : <span class="extra">${esc(x.chosen)}</span><br>Bonne réponse : <strong>${esc(x.q.answers[0])}</strong>
        <br><span class="src">📘 ${esc(x.q.src)}</span></li>`).join('')}</ol>` : '<p class="ctx">Aucune erreur. Bravo !</p>'}`;
  } else if (session?.type === 'defi') {
    (extra.defi ||= {})[today()] = ok; save();
    const last = Object.entries(extra.defi).sort().slice(-7).map(([d, s]) => `${d.slice(5)} : ${s}/10`).join(' · ');
    title = 'DÉFI DU JOUR';
    body = `<p class="ctx">🏆 Défi du ${today()} : ${ok} / ${total}. Revenez demain pour un nouveau défi.</p>
      <p class="muted" style="margin:0 20px">Vos derniers défis : ${esc(last)}</p>`;
  } else if (session?.type === 'cible') {
    title = 'ENTRAÎNEMENT CIBLÉ';
    body = `<p class="ctx">🎯 ${esc(CONSEILS[session.kind]?.[0] || '')} : ${ok} / ${total} (${pct} %).</p>`;
  }
  $('#card').innerHTML = `<div class="radio"><span class="led"></span><span>COM1</span><strong>${title}</strong></div>${body}
    <div class="row" style="margin:12px 20px 0"><button class="primary" id="again">${session ? 'Retour à l’entraînement' : 'Recommencer'}</button></div>`;
  $('#again').addEventListener('click', () => start());
  $('#again').focus();
}

// ── Fiches de cours, glossaire, statistiques (badges et bilan) ──
function openFiche(id = FICHES[0].id) {
  const f = FICHES.find(x => x.id === id) || FICHES[0];
  $('#ficheNav').innerHTML = FICHES.map(x => `<button class="${x.id === f.id ? 'primary' : 'ghost'}" data-id="${x.id}">${esc(x.titre)}</button>`).join('');
  $('#ficheBody').innerHTML = `<h3>${esc(f.titre)}</h3><ul>${f.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul><p class="src">📘 ${esc(f.src)}</p>`;
  $$('#ficheNav button').forEach(b => b.addEventListener('click', () => openFiche(b.dataset.id)));
  if (!$('#fiches').open) $('#fiches').showModal();
}

let carte = null;
function showGlossaire() {
  const f = $('#glossQ').value.toLowerCase();
  $('#glossBody').innerHTML = carte
    ? `<button class="flip" id="flip"><span>${esc(carte.face ? carte.c[1] : carte.c[0])}</span><small>${carte.face ? 'EN' : 'FR'} · cliquez pour retourner</small></button>
       <p class="src">📘 ${esc(MANUEL(carte.c[2]))}</p>`
    : `<table>${GLOSSAIRE.filter(g => !f || (g[0] + ' ' + g[1]).toLowerCase().includes(f))
        .map(([fr, en, p]) => `<tr><td>${esc(fr)}</td><td>${esc(en)}</td><td class="num muted">p. ${p}</td></tr>`).join('')}</table>`;
  $('#flip')?.addEventListener('click', () => { carte.face = !carte.face; showGlossaire(); });
}
function nextCarte() { carte = { c: GLOSSAIRE[Math.floor(Math.random() * GLOSSAIRE.length)], face: Math.random() < 0.5 }; showGlossaire(); }

document.addEventListener('keydown', e => {
  if (e.target.tagName === 'TEXTAREA') {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#go')?.click(); }
    return;
  }
  // raccourcis 1-4 : pas pendant une saisie ni quand une fenêtre (fiches, glossaire, stats) est ouverte
  if (/INPUT|SELECT/.test(e.target.tagName) || $('dialog[open]')) return;
  if (!answered && /^[1-4]$/.test(e.key)) $$('.opts button')[e.key - 1]?.click();
});

$('#sujet').insertAdjacentHTML('beforeend', Object.entries(SUJETS).map(([k, v]) => `<option value="${k}">${v}</option>`).join(''));
$$('.settings input, #sujet').forEach(i => i.addEventListener('change', () => start()));
$('#statsBtn').addEventListener('click', showStats);
$('#examBtn').addEventListener('click', () => {
  if (confirm(`Examen blanc : ${EXAM_N} questions en QCM, ${EXAM_MIN} minutes, correction à la fin. Commencer ?`)) start({ type: 'exam' });
});
$('#defiBtn').addEventListener('click', () => start({ type: 'defi' }));
$('#fichesBtn').addEventListener('click', () => openFiche());
$('#glossBtn').addEventListener('click', () => { carte = null; showGlossaire(); $('#glossaire').showModal(); });
$('#glossQ').addEventListener('input', () => { carte = null; showGlossaire(); });
$('#cartesBtn').addEventListener('click', nextCarte);
$('#listeBtn').addEventListener('click', () => { carte = null; showGlossaire(); });
$('#reset').addEventListener('click', () => {
  if (!confirm('Effacer toute votre progression enregistrée sur cet appareil ?')) return;
  prog = {}; extra = {}; save(); errCount(); $('#stats').close(); start();
});
QUESTIONS.forEach(q => { q.id = hash([q.lang, q.regle, q.atc, q.q, q.ctx].join('|')).toString(36); });
errCount();
start();
