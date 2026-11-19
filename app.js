const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const val = n => $(`input[name=${n}]:checked`).value;
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let pool = [], idx = 0, cur, ok = 0, total = 0, streak = 0, answered = false;

// ── Progression enregistrée sur l'appareil : { id: [réussites, échecs, dernière réponse juste 0/1] } ──
const KEY = 'phraseo-progress-v1';
let prog = {};
try { prog = JSON.parse(localStorage.getItem(KEY)) || {}; } catch {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(prog)); } catch {} };
const isErr = q => prog[q.id]?.[2] === 0;
function record(good) {
  const p = prog[cur.id] || (prog[cur.id] = [0, 0, 0]);
  p[good ? 0 : 1]++; p[2] = good ? 1 : 0;
  save(); errCount();
}
function errCount() { $('label[for=r-err]').textContent = `❌ Mes erreurs (${QUESTIONS.filter(isErr).length})`; }

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
  $('#statsBody').innerHTML = `<table>${rows}</table>`;
  $('#stats').showModal();
}

function start() {
  const l = val('lang'), r = val('regle'), m = val('mode'), chrono = $('#chrono').checked, su = $('#sujet').value;
  pool = QUESTIONS.filter(q => (su === 'all' || r === 'alpha' || (q.cat || 'base') === su) &&
    (r === 'err' ? isErr(q) && (l === 'all' || q.regle === 'alpha' || q.lang === l)
      : r === 'alpha' ? q.regle === 'alpha' : q.regle !== 'alpha' && (r === 'all' || q.regle === r) && (l === 'all' || q.lang === l))
    && (m === 'qcm' || !q.qcmOnly) && (!chrono || r === 'alpha' || r === 'err' || q.st) && (q.niv || 1) <= +val('niv'));
  if (!chrono) {
    if (r !== 'err') pool = pool.concat(pool.filter(isErr)); // les questions ratées reviennent deux fois plus souvent
    pool.sort(() => Math.random() - 0.5);
  }
  idx = ok = total = streak = 0;
  stats();
  next();
}

function stats() {
  $('#score').textContent = `${ok} / ${total}`;
  $('#streak').textContent = `🔥 ${streak}`;
  $('#prog').style.width = pool.length ? `${100 * idx / pool.length}%` : '0';
}

function next() {
  speechSynthesis.cancel(); stopHiss();
  if (!pool.length) { $('#card').innerHTML = '<p class="ctx">Aucune question pour ces réglages.</p>'; return; }
  if (idx >= pool.length) return end();
  cur = pool[idx++];
  answered = false;
  stats();
  const mode = val('mode'), en = cur.lang === 'en', listen = ($('#ecoute').checked || LEVELS[val('niv')].listen) && cur.atc;
  const q = cur.q || (en ? 'Read back this instruction:' : 'Collationnez :');
  let h = `<div class="radio"><span class="led" id="led"></span><span>COM1</span><strong>${esc(cur.st || '—')}</strong>
    <span class="prog">${idx} / ${pool.length}</span></div>
    <div class="tags"><span class="tag">${cur.regle === 'alpha' ? 'OACI' : cur.regle.toUpperCase()}</span>${cur.regle === 'alpha' ? '' : `<span class="tag">${en ? 'EN' : 'FR'}</span>`}${isErr(cur) ? '<span class="tag err">À revoir</span>' : ''}</div>
    <p class="ctx">${esc(cur.ctx)}</p>`;
  if (cur.atc) h += `<div class="bubble atc"><div class="who">${cur.who || 'ATC'}</div>
    <p class="msg ${listen ? 'hidden' : ''}" id="atc">${esc(cur.atc)}</p>
    <button class="ghost" id="hear">🔊 ${listen ? 'Réécouter' : 'Écouter'}</button></div>`;
  h += `<p class="q">${esc(q)}</p>`;
  if (mode === 'qcm') {
    const opts = [cur.answers[0], ...cur.wrong].sort(() => Math.random() - 0.5);
    h += `<div class="opts">${opts.map((o, i) => `<button data-o="${esc(o)}"><span class="n">${i + 1}</span><span>${esc(o)}</span></button>`).join('')}</div>`;
  } else if (mode === 'ecrit') {
    h += `<textarea id="txt" placeholder="${en ? 'Your readback…' : 'Votre collationnement…'}"></textarea>
      <div class="row"><button class="primary" id="go">Valider</button></div>`;
  } else {
    h += SR ? `<div class="row"><button class="primary mic" id="mic">🎤 Appuyer pour parler</button><span id="heard" class="muted"></span></div>`
      : '<p class="warn">La reconnaissance vocale n’est pas disponible dans ce navigateur. Utilisez Chrome ou Edge.</p>';
  }
  h += '<div id="fb"></div>';
  $('#card').innerHTML = h;

  $('#hear')?.addEventListener('click', say);
  $$('.opts button').forEach(b => b.addEventListener('click', () => pick(b)));
  $('#go')?.addEventListener('click', () => grade($('#txt').value));
  $('#mic')?.addEventListener('click', listenMic);
  if (listen) say();
  ($('#txt') || $('.opts button') || $('#mic'))?.focus();
}

// ── Voix du contrôleur ──
// Niveaux : débit de parole, souffle radio (volume du bruit), écoute seule imposée.
const LEVELS = { 1: { rate: 0.9, hiss: 0 }, 2: { rate: 1.15, hiss: 0.012 }, 3: { rate: 1.35, hiss: 0.03, listen: true } };
const NOVELTY = /bells|bubbles|boing|cellos|whisper|zarvox|trinoids|organ|jester|superstar|bad news|good news|wobble|bahh|albert|hysterical|deranged|pipe/i;
const hash = s => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

// Meilleures voix installées d'abord ; chaque poste (Sol, Tour, Approche…) garde « son » contrôleur.
function pickVoice(lang, st = '') {
  const good = v => (/premium|enhanced|natural|neural|google/i.test(v.name) ? 2 : 0) + (/GB|FR/.test(v.lang) ? 1 : 0)
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

function say() {
  speechSynthesis.cancel(); stopHiss();
  const L = LEVELS[val('niv')], v = pickVoice(cur.lang, cur.st);
  const u = new SpeechSynthesisUtterance(speakable(cur.atc, cur.lang));
  u.lang = cur.lang === 'en' ? 'en-GB' : 'fr-FR';
  if (v) u.voice = v;
  u.rate = L.rate;
  u.pitch = 0.9 + (hash(cur.st || '') % 3) * 0.08;
  u.onstart = () => $('#led')?.classList.add('tx');
  u.onend = u.onerror = () => {
    $('#led')?.classList.remove('tx');
    if (L.hiss) { stopHiss(); noise(L.hiss * 6, 0.12); } // squelch de fin d'émission
  };
  if (L.hiss) { noise(L.hiss * 6, 0.08); hissNode = noise(L.hiss); } // alternat + souffle porteuse
  setTimeout(() => speechSynthesis.speak(u), L.hiss ? 150 : 0);
}
speechSynthesis.onvoiceschanged = () => {}; // force le chargement de la liste des voix (Chrome)

function pick(b) {
  if (answered) return;
  const good = b.dataset.o === cur.answers[0];
  $$('.opts button').forEach(x => { x.disabled = true; if (x.dataset.o === cur.answers[0]) x.classList.add('good'); });
  if (!good) b.classList.add('bad');
  feedback(good);
}

function listenMic() {
  const rec = new SR(), mic = $('#mic');
  rec.lang = cur.lang === 'en' ? 'en-GB' : 'fr-FR';
  mic.disabled = true; mic.classList.add('on'); mic.textContent = '🔴 À vous…';
  rec.onresult = e => grade(e.results[0][0].transcript);
  rec.onerror = e => { $('#heard').textContent = `Erreur micro : ${e.error}`; };
  rec.onend = () => { if (!answered) { mic.disabled = false; mic.classList.remove('on'); mic.textContent = '🎤 Réessayer'; } };
  rec.start();
}

function grade(text) {
  if (answered || !text.trim()) return;
  if (cur.regle === 'alpha') {
    const w = s => s.toLowerCase().replace(/[^a-z]/g, '');
    return feedback(cur.answers.some(a => w(a) === w(text)), { said: text });
  }
  const r = check(text, cur.answers);
  feedback(r.pass, { said: text, diff: diffWords(text, r.ans), ans: r.ans });
}

const paint = (cs, cls) => cs.map(c => c.bad ? `<span class="${cls}">${esc(c.text)}</span>` : esc(c.text)).join(' ');

function feedback(good, { said = '', diff, ans = cur.answers[0] } = {}) {
  answered = true;
  record(good);
  total++; if (good) { ok++; streak++; } else streak = 0;
  stats();
  $('#atc')?.classList.remove('hidden');
  if ($('#go')) $('#go').disabled = true;
  if ($('#mic')) { $('#mic').disabled = true; $('#mic').classList.remove('on'); $('#mic').textContent = '🎤'; }
  $('#fb').innerHTML = `<div class="fb ${good ? 'ok' : 'ko'}">
    <p><strong>${good ? '✅ Correct' : '❌ À revoir'}</strong></p>
    ${diff?.notes.length ? `<ul class="notes">${diff.notes.slice(0, 5).map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
    ${said ? `<p>Votre réponse : <span class="said">${diff ? paint(diff.U, 'extra') : esc(said)}</span></p>` : ''}
    <p>Réponse attendue : <strong>${diff ? paint(diff.E, 'miss') : esc(ans)}</strong></p>
    <p class="src">📘 Source : ${esc(cur.src)}</p>
    <div class="row"><button class="primary" id="nx">Suivant →</button></div></div>`;
  $('#nx').addEventListener('click', next);
  $('#nx').focus();
}

function end() {
  stats();
  const pct = total ? Math.round(100 * ok / total) : 0;
  $('#card').innerHTML = `<div class="radio"><span class="led"></span><span>COM1</span><strong>FIN DE SÉRIE</strong></div>
    <p class="ctx">Série terminée : ${ok} / ${total} (${pct} %)</p>
    <div class="row" style="margin:0 20px"><button class="primary" id="again">Recommencer</button></div>`;
  $('#again').addEventListener('click', start);
  $('#again').focus();
}

document.addEventListener('keydown', e => {
  if (e.target.tagName === 'TEXTAREA') {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#go')?.click(); }
    return;
  }
  if (!answered && /^[1-4]$/.test(e.key)) $$('.opts button')[e.key - 1]?.click();
});

$('#sujet').insertAdjacentHTML('beforeend', Object.entries(SUJETS).map(([k, v]) => `<option value="${k}">${v}</option>`).join(''));
$$('.settings input, #sujet').forEach(i => i.addEventListener('change', start));
$('#statsBtn').addEventListener('click', showStats);
$('#reset').addEventListener('click', () => {
  if (!confirm('Effacer toute votre progression enregistrée sur cet appareil ?')) return;
  prog = {}; save(); errCount(); $('#stats').close(); start();
});
QUESTIONS.forEach(q => { q.id = hash([q.lang, q.regle, q.atc, q.q, q.ctx].join('|')).toString(36); });
errCount();
start();
