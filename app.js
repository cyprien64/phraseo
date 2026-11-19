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
const EXAM_N = 30, EXAM_MIN = 15, EXAM_OK = 80; // 30 s par question, réussite à 80 %
const today = () => new Date().toLocaleDateString('sv'); // AAAA-MM-JJ à l'heure de l'appareil
// examen et défi en QCM ; l'entraînement ciblé et les leçons gardent le mode choisi
// (leçon : la dictée devient l'écrit et le pilote fautif le QCM, pour que les réponses comptent dans la progression)
const modeNow = () => {
  const m = val('mode');
  if (session && !/cible|lecon/.test(session.type)) return 'qcm';
  return session?.type === 'lecon' ? ({ dictee: 'ecrit', fautif: 'qcm' }[m] || m) : m;
};
const navOrder = (a, b) => b.lang.localeCompare(a.lang) || a.nav - b.nav; // français puis anglais, dans l'ordre du vol
const words = s => s.split(' ').length;

// exercices de la langue choisie (l'alphabet est dans toutes les langues)
const langOk = q => val('lang') === 'all' || q.regle === 'alpha' || q.lang === val('lang');

function start(sess = null) {
  session = sess; clearInterval(timer);
  const r = val('regle'), m = modeNow(), chrono = !session && $('#chrono').checked, su = $('#sujet').value;
  if (session?.type === 'defi') pool = dailyPick(QUESTIONS, today(), 10); // identique pour tout le monde
  else if (session?.type === 'cible') // entraînement ciblé sur un type d'erreur du bilan
    pool = cible(QUESTIONS, session.kind).filter(q => langOk(q) && (m === 'qcm' || !q.qcmOnly) && (q.niv || 1) <= +val('niv'))
      .sort(() => Math.random() - 0.5).slice(0, 15);
  else if (session?.type === 'lecon') { // parcours : exercices pas encore réussis d'abord
    const L = parcours(QUESTIONS.filter(langOk), prog)[session.n];
    session.titre = L.titre;
    pool = L.qs[0]?.nav ? [...L.qs].sort(navOrder)
      : L.qs.sort(() => Math.random() - 0.5).sort((a, b) => (prog[a.id]?.[2] === 1) - (prog[b.id]?.[2] === 1)).slice(0, 15);
  } else if (session?.type === 'exam') // examen blanc : tous sujets, selon la langue choisie
    pool = QUESTIONS.filter(langOk).sort(() => Math.random() - 0.5).slice(0, EXAM_N);
  else {
    // la navigation complète (enchaînement) n'apparaît que dans son sujet, sauf en révision
    pool = QUESTIONS.filter(q => (r === 'alpha' || (su === 'all' ? q.cat !== 'nav' || r === 'err' || r === 'due' : (q.cat || 'base') === su)) &&
      (r === 'err' ? isErr(q) && langOk(q) : r === 'due' ? isDue(q) && langOk(q)
        : r === 'alpha' ? q.regle === 'alpha' : q.regle !== 'alpha' && (r === 'all' || q.regle === r) && langOk(q))
      && (m === 'qcm' || !q.qcmOnly) && (m !== 'dictee' || (q.atc && !q.q && words(q.atc) >= 8)) && (m !== 'fautif' || (q.atc && !q.q))
      && (val('niv') !== '4' || !q.atc || q.q || q.niv >= 2 || words(q.atc) >= 7) // Expert+ : messages longs ou combinés
      && (!chrono || r === 'alpha' || r === 'err' || q.st) && (q.niv || 1) <= +val('niv'));
    if (su === 'nav' && r !== 'err' && r !== 'due') pool.sort(navOrder);
    else if (!chrono) {
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
  // terrain réel (pas pour le défi, identique pour tous) : piste face au vent du dernier METAR
  terrain = session?.type === 'defi' ? null : TERRAINS.find(t => t.icao === $('#terrain').value) || null;
  wx = terrain && wxOf(terrain.icao);
  if (terrain) memo.rw24 = memo.rw32 = memo.rw12 = bestRunway(terrain.pistes, wx?.wdir, wx?.wspd, terrain.pref);
  atisLetter = terrain && wx ? atisFromMetar(wx.raw, terrain, memo.rw24, 'fr')?.letter : null; // même lettre dans toute la série
  const live = terrain && wx && !session && !['alpha', 'err', 'due'].includes(val('regle')) && ['all', 'atis', 'base', 'nav'].includes($('#sujet').value)
    && !['fautif', 'dictee'].includes(val('mode')) ? liveAtis(val('lang') === 'all' ? (Math.random() < 0.5 ? 'fr' : 'en') : val('lang')) : [];
  if (live.length) pool = [...live, ...pool.filter(q => q.cat !== 'atis')]; // l'ATIS reconstitué remplace l'ATIS fictif de Saint-Exémery
  stats();
  next();
}

// ── Réalisme : prépare la carte (valeurs aléatoires, indicatif abrégé, message pour un autre avion, coupure) ──
let series = 'F-GBCD', memo = {}, terrain = null, wx = null, atisLetter = null;
// METAR officiels récupérés par GitHub toutes les 30 min (metar.json, format aviationweather.gov) ; trop ancien = ignoré
let METAR = [];
function wxOf(icao) {
  const m = Array.isArray(METAR) && METAR.find(x => x.icaoId === icao);
  if (!m || Date.now() / 1000 - m.obsTime > 3 * 3600) return null;
  return { wdir: m.wdir, wspd: m.wspd, qnh: Math.round(m.altim), raw: m.rawOb };
}
function prepare(q) {
  if (q.regle === 'alpha' || q.prepared) return q;
  const en = q.lang === 'en', chrono = $('#chrono').checked;
  // indicatif abrégé : seulement après un premier échange et à l'initiative du contrôleur (Manuel p. 18)
  // option « Indicatif abrégé » : après un premier échange complet avec le contrôleur, il abrège et vous répondez
  // avec F-CD (permis seulement une fois que le contrôleur l'a fait : Manuel p. 18, SERA.14055)
  const short = !!q.atc && q.cat !== 'atis' && !q.elements && !!q.st && ($('#abbr').checked ? !!memo.contact
    : !session && q.cat !== 'nav' && (chrono ? idx > 1 : Math.random() < 0.3));
  if (q.atc && q.st && q.cat !== 'atis') memo.contact = true;
  const shown = short ? abbrev(series) : series;
  let c = vary(q, { cs: series, shown, values: (!!terrain || $('#random').checked) && session?.type !== 'defi', memo });
  if (terrain) c = realTerrain(c, terrain, wx, atisLetter);
  if (c.atc && !c.q && !c.elements) c = trickyWrongs(c, shown); // QCM piégeux : une seule petite erreur par choix
  if (short && !chrono) c.ctx += en ? ' (The controller already uses your abbreviated callsign.)' : ' (Le contrôleur utilise déjà votre indicatif abrégé.)';
  c.shown = shown; c.prepared = true;
  c.chatter = chatterFor(q, c);
  if (session) return c; // examen, défi, leçon : pas de piège radio
  if (modeNow() === 'fautif') { // le pilote collationne, juste ou faux : à vous de trouver
    const bad = Math.random() < 0.5;
    return { ...c, orig: c, pilote: bad ? c.wrong[Math.floor(Math.random() * c.wrong.length)] : c.answers[0],
      q: en ? 'Is the pilot’s readback correct?' : 'Le collationnement du pilote est-il correct ?',
      answers: [bad ? 'Incorrect' : 'Correct'], wrong: [bad ? 'Correct' : 'Incorrect'] };
  }
  if (modeNow() === 'dictee') return { ...c, answers: [c.atc], dictee: true,
    q: en ? 'Write down the whole message:' : 'Notez le message complet :', src: `${c.src} (dictée du message)` };
  const xp = val('niv') === '4'; // Expert+ : pièges radio toujours actifs, indicatifs proches
  if (($('#busy').checked || xp) && c.atc && c.st && !c.q && Math.random() < (xp ? 0.4 : 0.3)) {
    const other = xp || Math.random() < 0.5 ? similarCallsign(series) : newCallsign();
    return { ...c, atc: c.atc.replace(shown, other), notMine: other };
  }
  const cut = ($('#cuts').checked || xp) && c.atc && !c.q && c.cat !== 'atis' && Math.random() < 0.3 && cutMessage(c.atc);
  if (cut) return { ...c, cut, full: c, qcmOnly: false, niv: 1,
    q: en ? 'The end of the message was cut off. What do you say?' : 'La fin du message a été coupée. Que dites-vous ?',
    answers: [en ? `Say again all after ${cut.word}, ${shown}` : `Répétez tout après ${cut.word}, ${shown}`],
    wrong: en ? [`Roger, ${shown}`, `Say again all before ${cut.word}, ${shown}`, `Wilco, ${shown}`]
      : [`Roger, ${shown}`, `Répétez tout avant ${cut.word}, ${shown}`, `Wilco, ${shown}`],
    src: SERA('SERA.14075 c) 4)') };
  return c;
}

// Fréquence vivante : avant certains messages, un autre avion échange avec le même poste (message et collationnement
// tirés des exercices vérifiés, avec un autre indicatif). Plus fréquent aux niveaux élevés.
function chatterFor(q, c) {
  const p = { 2: 0.25, 3: 0.4, 4: 0.6 }[val('niv')] || 0;
  if (session || !c.atc || !q.st || Math.random() >= p) return null;
  const others = QUESTIONS.filter(x => x.st === q.st && x.lang === q.lang && x.atc && !x.q && !x.elements && x.cat !== 'nav' && x !== q);
  if (!others.length) return null;
  const x = others[Math.floor(Math.random() * others.length)];
  const cs = val('niv') === '4' && Math.random() < 0.5 ? similarCallsign(series) : newCallsign(); // Expert+ : indicatif proche
  let v = vary(x, { cs, values: true, memo: { ...memo } });
  if (terrain) v = realTerrain(v, terrain, wx, atisLetter);
  return [{ text: v.atc, lang: q.lang, st: c.st, who: `ATC → ${cs}` }, { text: v.answers[0], lang: q.lang, st: c.st, pilot: true, far: true, cs, who: cs }];
}

// ATIS du terrain réel, mis en forme à partir du dernier METAR (realism.js) : deux questions tirées au hasard.
function liveAtis(lang) {
  const a = atisFromMetar(wx.raw, terrain, memo.rw24, lang);
  if (!a) return [];
  const en = lang === 'en', ch = atisChoices(a, terrain.pistes);
  const qs = [
    [en ? 'What is the information letter?' : 'Quelle est la lettre de l’information ?', a.letter, ch.letter],
    [en ? 'Which runway is in use?' : 'Quelle est la piste en service ?', a.piste, ch.piste],
    [en ? 'What is the QNH?' : 'Quel est le QNH ?', a.qnh, ch.qnh],
  ];
  if (a.wind) qs.push([en ? 'What is the wind?' : 'Quel est le vent ?', a.wind, ch.wind]);
  return qs.sort(() => Math.random() - 0.5).slice(0, 2).map(([q, ans, wrong]) => ({
    live: true, prepared: true, cat: 'atis', lang, regle: 'vfr', who: 'ATIS', shown: series,
    st: `${terrain.radio} ATIS ${en ? terrain.atis.replace(',', '.') : terrain.atis}`,
    ctx: en ? `ATIS rebuilt from the official ${terrain.nom} METAR (fictitious information letter; no transition level or local instructions). Listen to it before your first call.`
      : `ATIS reconstitué d’après le METAR officiel de ${terrain.nom} (lettre d’information fictive ; sans niveau de transition ni consignes locales). Écoutez-le avant votre premier appel.`,
    atc: a.text, q, answers: [ans], wrong,
    src: `ATIS reconstitué (pas la diffusion réelle) : METAR ${terrain.icao} officiel (aviationweather.gov), mis en forme selon le ${MANUEL(214)} et p. 215-218`,
  }));
}

function stats() {
  $('#score').textContent = `${ok} / ${total}`;
  $('#streak').textContent = `🔥 ${streak}`;
  const pc = pool.length ? Math.round(100 * idx / pool.length) : 0;
  $('#prog').style.width = pc + '%'; $('#bar').setAttribute('aria-valuenow', pc);
}

function next() {
  hush(); stopRecording();
  if (myAudio) { URL.revokeObjectURL(myAudio); myAudio = null; }
  if (!pool.length) { $('#card').innerHTML = '<p class="ctx">Aucune question pour ces réglages.</p>'; return; }
  if (idx >= pool.length) return end();
  cur = prepare(pool[idx++]);
  answered = false;
  stats();
  const mode = cur.qcmOnly || cur.pilote ? 'qcm' : modeNow(), en = cur.lang === 'en';
  const listen = ($('#ecoute').checked || LEVELS[val('niv')].listen || cur.dictee) && cur.atc;
  const q = cur.q || (en ? 'Read back this instruction:' : 'Collationnez :');
  const badge = session ? `<span class="tag sess">${session.type === 'exam' ? '🎓 Examen blanc' : session.type === 'lecon' ? `🧭 ${esc(session.titre)}`
    : session.type === 'cible' ? `🎯 ${esc(CONSEILS[session.kind]?.[0] || 'Entraînement ciblé')}` : `🏆 Défi du ${today()}`}</span>` : '';
  let h = `<div class="radio"><span class="led" id="led"></span><span>COM1</span><strong>${esc(cur.st || '—')}</strong>
    <span class="prog">${session?.type === 'exam' ? '<span id="timer" class="me"></span>' : ''}<span class="me" title="Votre indicatif">✈ ${esc(series)}</span> ${idx} / ${pool.length}</span></div>
    <div class="tags">${badge}<span class="tag">${cur.regle === 'alpha' ? 'OACI' : cur.regle.toUpperCase()}</span>${cur.regle === 'alpha' ? '' : `<span class="tag">${en ? 'EN' : 'FR'}</span>`}${!session && isErr(cur) ? '<span class="tag err">À revoir</span>' : ''}</div>
    ${terrain && cur.st?.startsWith(terrain.radio) ? `<p class="metar">📡 ${wx ? esc(wx.raw) : 'METAR indisponible : vent et QNH de l’exercice.'}
      <span class="muted">${esc(terrain.nom)} · ${esc(AIP_AD(terrain.icao))}</span></p>` : ''}
    <p class="ctx">${esc(cur.ctx)}</p>`;
  if (cur.chatter) h += `<div class="fil" aria-label="${en ? 'Other traffic on frequency' : 'Autres avions sur la fréquence'}">${cur.chatter.map(l =>
    `<div class="bubble ${l.pilot ? 'pilot' : 'atc'} other"><div class="who">${esc(l.who)}</div><p class="msg ${listen ? 'hidden' : ''}" ${listen ? 'aria-hidden="true"' : ''}>${esc(l.text)}</p></div>`).join('')}</div>`;
  if (cur.atc) h += `<div class="bubble atc"><div class="who">${cur.who || 'ATC'}</div>
    <p class="msg ${listen ? 'hidden' : ''}" id="atc" ${listen ? 'aria-hidden="true"' : ''}>${cur.cut ? `${esc(cur.cut.heard)} <span class="cut">▒▒▒▒ ${en ? '(cut off)' : '(coupé)'}</span>` : esc(cur.atc)}</p>
    <div class="row tight"><button class="ghost" id="hear">🔊 ${listen ? 'Réécouter' : 'Écouter'}</button><span id="vstat" class="muted" role="status"></span>
    ${($('#busy').checked || val('niv') === '4') && !cur.pilote ? `<button class="ghost" id="nm" title="Ce message est pour un autre avion">🚫 ${en ? 'Not for me' : 'Pas pour moi'}</button>` : ''}</div></div>`;
  if (cur.pilote) h += `<div class="bubble pilot"><div class="who">${en ? 'Pilot' : 'Pilote'}</div><p class="msg">${esc(cur.pilote)}</p></div>`;
  h += `<p class="q">${esc(q)}</p>`;
  if (mode === 'qcm') {
    const opts = [cur.answers[0], ...cur.wrong].sort(() => Math.random() - 0.5);
    h += `<div class="opts">${opts.map((o, i) => `<button data-o="${esc(o)}"><span class="n">${i + 1}</span><span>${esc(o)}</span></button>`).join('')}</div>`;
  } else if (mode === 'ecrit' || mode === 'dictee') {
    h += `<textarea id="txt" aria-label="${en ? 'Your answer' : 'Votre réponse'}" placeholder=""${cur.dictee ? (en ? 'The message…' : 'Le message…') : en ? 'Your readback…' : 'Votre collationnement…'}"></textarea>
      <div class="row"><button class="primary" id="go">Valider</button></div>`;
  } else {
    h += SR ? `<div class="row"><button class="primary mic" id="mic" title="Ou maintenez la barre Espace (alternat)">🎤 Appuyer pour parler · ⎵ Espace</button><span id="heard" class="muted"></span></div>`
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
  if (listen) say(undefined, 500 + Math.random() * 900); else prefetchVoice(); // le contrôleur ne parle pas instantanément
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
// Niveaux : débit de la voix du système, souffle radio, distorsion de la radio, écoute seule imposée.
// Débit proche d'un vrai contrôleur à tous les niveaux : la difficulté vient du bruit et des messages, pas de la vitesse.
// drops : nombre de brèves pertes de signal pendant un message (réception dégradée, lisibilité 3).
const LEVELS = { 1: { rate: 0.85, hiss: 0.004, drive: 1.2, drops: 0 }, 2: { rate: 0.95, hiss: 0.012, drive: 1.8, drops: 0 },
  3: { rate: 1, hiss: 0.022, drive: 2.5, drops: 1, listen: true }, 4: { rate: 1.05, hiss: 0.032, drive: 3.2, drops: 2, listen: true } };
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
// Bruit blanc filtré : bande radio VHF (souffle) ou grave (moteur dans le micro du pilote) ; `secs` = durée, sinon en boucle.
function noise(vol, secs, type = 'bandpass', freq = 1400) {
  const c = audio(), src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  src.buffer = noiseBuf; src.loop = !secs;
  f.type = type; f.frequency.value = freq; f.Q.value = 0.8; g.gain.value = vol;
  src.connect(f).connect(g).connect(c.destination);
  src.start();
  if (secs) src.stop(c.currentTime + secs);
  return src;
}
let rumbleNode = null;
function stopHiss() { for (const n of [hissNode, rumbleNode]) try { n?.stop(); } catch {} hissNode = rumbleNode = null; }

// ── Voix réaliste : synthèse neuronale Piper (calcul dans tts-worker.js, sans figer la page) passée dans un
// filtre radio VHF. Chaque voix est téléchargée une fois (≈ 60 Mo) puis gardée par le navigateur.
// En cas d'échec (hors ligne, navigateur trop ancien) : voix du système.
const NEURAL = { fr: ['fr_FR-tom-medium', 'fr_FR-siwis-medium'],
  en: ['en_GB-alan-medium', 'en_GB-cori-medium', 'en_GB-northern_english_male-medium'] };
// Le contrôleur garde la voix de son poste ; un pilote prend une autre voix que celle du contrôleur.
function neuralVoice(lang, st, pilotCs) {
  const vs = NEURAL[lang] || NEURAL.fr, atc = val('niv') === '1' ? 0 : hash(st || '') % vs.length;
  return pilotCs ? vs[(atc + 1 + hash(pilotCs) % (vs.length - 1)) % vs.length] : vs[atc];
}
// Débit : celui, naturel, du modèle ; un peu plus posé en Débutant (durée × 1,12).
const SLOW = { 1: 1.12, 2: 1, 3: 1, 4: 1 };
let ttsWorker = null, ttsSeq = 0, saySrc = null, sayTok = 0;
const audioCache = new Map(), ttsWait = new Map();
let ttsProgress = () => {};
function neuralAudio(text, voiceId) {
  const slow = SLOW[val('niv')], k = `${voiceId}|${slow}|${text}`;
  if (audioCache.size > 40) audioCache.delete(audioCache.keys().next().value); // ≈ 440 Ko par message de 5 s : on garde les 40 derniers
  if (!audioCache.has(k)) audioCache.set(k, new Promise((resolve, reject) => {
    if (!ttsWorker) {
      ttsWorker = new Worker('tts-worker.js', { type: 'module' });
      ttsWorker.onmessage = ({ data: d }) => {
        if (d.progress != null) return ttsProgress(d.progress);
        const w = ttsWait.get(d.id); ttsWait.delete(d.id);
        if (!w) return;
        if (d.error) return w.reject(new Error(d.error));
        const b = audio().createBuffer(1, d.pcm.length, d.rate); b.copyToChannel(d.pcm, 0); w.resolve(b);
      };
      ttsWorker.onerror = e => { for (const w of ttsWait.values()) w.reject(e); ttsWait.clear(); ttsWorker = null; };
    }
    const id = ++ttsSeq;
    ttsWait.set(id, { resolve, reject });
    ttsWorker.postMessage({ id, text, voiceId, slow });
  }).catch(e => { audioCache.delete(k); throw e; }));
  return audioCache.get(k);
}
const lineAudio = l => neuralAudio(speakable(l.text, l.lang), neuralVoice(l.lang, l.st, l.pilot && l.cs));
function cardLines(text) {
  const main = text ?? (cur.cut ? cur.cut.heard : cur.atc);
  const lines = [...(cur.chatter && !cur.chatterDone ? cur.chatter : []), { text: main, lang: cur.lang, st: cur.st, cut: !!cur.cut && main === cur.cut.heard }];
  if (text == null && cur.pilote) lines.push({ text: cur.pilote, lang: cur.lang, st: cur.st, pilot: true, cs: cur.shown }); // pilote fautif : on l'entend collationner
  return lines;
}
// Préparation à l'avance (dans le worker, sans figer la page) dès que la carte s'affiche.
function prefetchVoice() {
  if (!ttsWorker || !$('#neural').checked || !cur?.atc) return; // seulement si la voix est déjà utilisée (pas de téléchargement imposé)
  cardLines().forEach(l => lineAudio(l).catch(() => {}));
}
// Chaîne radio : bande passante 300–3000 Hz, présence vers 1,8 kHz, saturation douce, compression.
const clipCurve = k => Float32Array.from({ length: 1024 }, (_, i) => Math.tanh(k * (i / 512 - 1)) / Math.tanh(k));
function playRadio(buf, L, onend, vol = 1) {
  const c = audio(), src = c.createBufferSource();
  const hp = c.createBiquadFilter(), lp = c.createBiquadFilter(), pk = c.createBiquadFilter(), sh = c.createWaveShaper(), comp = c.createDynamicsCompressor();
  hp.type = 'highpass'; hp.frequency.value = 300; lp.type = 'lowpass'; lp.frequency.value = 3000;
  pk.type = 'peaking'; pk.frequency.value = 1800; pk.gain.value = 5; sh.curve = clipCurve(L.drive);
  if (!buf.peak) { buf.peak = 0.01; for (const x of buf.getChannelData(0)) buf.peak = Math.max(buf.peak, Math.abs(x)); }
  const g = c.createGain(), base = 0.8 * vol / buf.peak, t0 = c.currentTime + 0.05; // volume normalisé avant la saturation
  g.gain.setValueAtTime(base, t0);
  for (let i = 0; i < L.drops; i++) { // perte de signal : le souffle reste, la voix disparaît un instant
    const t = t0 + 0.4 + Math.random() * Math.max(0.1, buf.duration - 0.8), d = 0.08 + Math.random() * 0.15;
    g.gain.setValueAtTime(base, t); g.gain.linearRampToValueAtTime(base * 0.08, t + 0.03);
    g.gain.setValueAtTime(base * 0.08, t + d); g.gain.linearRampToValueAtTime(base, t + d + 0.03);
  }
  src.buffer = buf; src.onended = onend;
  src.connect(g).connect(hp).connect(lp).connect(pk).connect(sh).connect(comp).connect(c.destination);
  src.start(t0);
  return src;
}
function hush() { sayTok++; speechSynthesis.cancel(); try { saySrc?.stop(); } catch {} saySrc = null; stopHiss(); }
const vstat = t => { if ($('#vstat')) $('#vstat').textContent = t; };
const pause = ms => new Promise(r => setTimeout(r, ms));

// Une transmission radio : { text, lang, st, pilot, cs, cut }. Un pilote émet avec plus de souffle et le bruit du moteur.
function transmit(l, tok, L) {
  return new Promise(resolve => {
    const hissV = (l.pilot ? L.hiss * 1.5 + 0.006 : L.hiss) * (l.far ? 2 : 1);
    const tx = () => {
      if (tok !== sayTok) return;
      vstat(''); $('#led')?.classList.add('tx'); noise(hissV * 6, 0.08); hissNode = noise(hissV); // alternat + souffle porteuse
      if (l.pilot) rumbleNode = noise(0.06, 0, 'lowpass', 170);
    };
    const rx = () => {
      if (tok !== sayTok) return resolve();
      $('#led')?.classList.remove('tx'); stopHiss(); noise(hissV * 6, 0.12); // squelch de fin d'émission
      if (l.cut) noise(0.15, 1.2); // la fin du message est couverte par le bruit
      resolve();
    };
    const sys = () => sysSay(l, L, tx, rx);
    if (!$('#neural').checked) return sys();
    ttsProgress = p => tok === sayTok && vstat(`Téléchargement de la voix (une seule fois) : ${Math.round(100 * p)} %`);
    lineAudio(l).then(buf => {
      if (tok !== sayTok) return resolve();
      tx();
      setTimeout(() => { if (tok === sayTok) saySrc = playRadio(buf, L, rx, l.far ? 0.55 : 1); else resolve(); }, 150);
    }).catch(() => { if (tok !== sayTok) return resolve(); vstat('Voix réaliste indisponible : voix du système.'); sys(); });
  });
}
// Plusieurs transmissions à la suite, avec un court silence entre deux, comme sur une vraie fréquence.
async function play(lines, delay = 0) {
  hush();
  const tok = sayTok, L = LEVELS[val('niv')];
  vstat('Préparation de la voix…');
  if ($('#neural').checked) lines.forEach(l => lineAudio(l).catch(() => {})); // tout se prépare en parallèle
  if (delay) { await pause(delay); if (tok !== sayTok) return; }
  for (const [i, l] of lines.entries()) {
    if (tok !== sayTok) return;
    if (i) await pause(350 + Math.random() * 700);
    await transmit(l, tok, L);
  }
}
// `text` par défaut : le message de la carte (ou sa partie reçue si la fin est coupée), précédé la première fois
// des échanges des autres avions sur la fréquence.
function say(text, delay = 0) {
  const lines = cardLines(text);
  if (cur.chatter) cur.chatterDone = true;
  return play(lines, delay);
}

// Voix du système (voix installées sur l'appareil), sans filtre radio possible.
function sysSay(l, L, tx, rx) {
  const v = pickVoice(l.lang, l.pilot ? `${l.st}|${l.cs}` : l.st);
  const u = new SpeechSynthesisUtterance(speakable(l.text, l.lang));
  u.lang = v?.lang || (l.lang === 'en' ? 'en-GB' : 'fr-FR');
  if (v) u.voice = v;
  u.rate = L.rate;
  u.pitch = 0.9 + (hash(l.pilot ? l.cs : l.st || '') % 3) * 0.08;
  u.onend = u.onerror = rx;
  tx();
  setTimeout(() => speechSynthesis.speak(u), 150);
}
speechSynthesis.onvoiceschanged = () => {}; // force le chargement de la liste des voix (Chrome)

function pick(b) {
  if (answered) return;
  const good = !cur.notMine && b.dataset.o === cur.answers[0];
  $$('.opts button').forEach(x => { x.disabled = true; if (!cur.notMine && x.dataset.o === cur.answers[0]) x.classList.add('good'); });
  if (!good) b.classList.add('bad');
  if (!cur.pilote) { feedback(good, { chosen: b.dataset.o }); return transmitChoice(b.dataset.o, good); }
  const ans = check(cur.pilote, cur.orig.answers, cur.callsigns).ans; // variante la plus proche
  const d = cur.pilote === ans ? null : diffWords(cur.pilote, ans, cur.callsigns);
  feedback(good, { chosen: b.dataset.o, said: cur.pilote, diff: d, notes: d?.notes || [], ans });
}

// QCM réaliste : votre choix part sur la fréquence (avec votre voix de pilote) ; à un collationnement faux, le
// contrôleur répond « Négatif je répète » suivi de la clairance correcte (SERA.14075 d)).
function transmitChoice(text, good) {
  if (session?.type === 'exam' || !cur.atc || cur.q) return;
  const en = cur.lang === 'en', me = { text, lang: cur.lang, st: cur.st, pilot: true, cs: series };
  const lines = [me], bubble = (cls, who, t) => `<div class="bubble ${cls}"><div class="who">${esc(who)}</div><p class="msg">${esc(t)}</p></div>`;
  let h = bubble('pilot', en ? `You (${cur.shown})` : `Vous (${cur.shown})`, text);
  if (!good && !cur.notMine && !cur.cut && !cur.dictee) {
    const atc = `${cur.shown}, ${en ? 'negative I say again' : 'négatif je répète'}, ${cur.atc.replace(/^[^,]+,\s*/, '')}`;
    lines.push({ text: atc, lang: cur.lang, st: cur.st });
    h += bubble('atc', 'ATC', atc);
  }
  $('#fb').insertAdjacentHTML('beforebegin', `<div class="reply">${h}</div>`);
  play(lines);
}

let recNow = null; // reconnaissance en cours (alternat : relâcher Espace l'arrête)
function listenMic() {
  if (recNow) return;
  const rec = recNow = new SR(), mic = $('#mic');
  noise(0.03, 0.06); // clic d'alternat
  rec.lang = cur.lang === 'en' ? 'en-GB' : 'fr-FR';
  mic.disabled = true; mic.classList.add('on'); mic.textContent = '🔴 À vous…';
  rec.onresult = e => grade(e.results[0][0].transcript);
  rec.onerror = e => { $('#heard').textContent = `Erreur micro : ${e.error}`; };
  rec.onend = () => { recNow = null; stopRecording(); if (!answered) { mic.disabled = false; mic.classList.remove('on'); mic.textContent = '🎤 Réessayer'; } };
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
  $('#myVoice').addEventListener('click', () => { hush(); new Audio(myAudio).play(); });
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
    if (!cur.notMine && !cur.cut && !cur.dictee && !cur.pilote && !cur.live) record(good); // ces cartes ne touchent pas la révision
    total++; if (good) { ok++; streak++; } else streak = 0;
    extra.best = Math.max(extra.best || 0, streak);
    if (!good && !cur.pilote) for (const k of classify(notes, said)) (extra.tally ||= {})[k] = (extra.tally[k] || 0) + 1; // pour le bilan
    save();
  }
  if (session) session.log.push({ q: cur, good, chosen: chosen || said });
  if (session?.type === 'exam') return next(); // examen : correction seulement à la fin
  stats();
  $$('#card .msg.hidden').forEach(x => { x.classList.remove('hidden'); x.removeAttribute('aria-hidden'); });
  if ($('#go')) $('#go').disabled = true;
  if ($('#mic')) { $('#mic').disabled = true; $('#mic').classList.remove('on'); $('#mic').textContent = '🎤'; }
  let head = good ? '✅ Correct' : '❌ À revoir';
  if (cur.notMine) head = good ? `✅ Bien vu : ce message était pour ${cur.notMine}, on ne répond pas.`
    : `❌ Ce message était pour ${cur.notMine}, pas pour vous (${cur.shown}) : il ne fallait pas répondre.`;
  else if (nm) head = `❌ Ce message était pour vous (${cur.shown}) : il fallait répondre.`;
  if (cur.retry) head = `2e essai (non compté) : ${head}`;
  const canRetry = !good && !cur.retry && !cur.notMine && !nm && !cur.cut && !cur.elements && !cur.dictee && !cur.pilote && cur.atc && modeNow() !== 'qcm';
  if (cur.pilote) head = good ? `✅ Bien vu : le collationnement était ${cur.answers[0] === 'Correct' ? 'correct' : 'faux'}.`
    : `❌ Le collationnement était ${cur.answers[0] === 'Correct' ? 'correct' : 'faux'}.`;
  const why = whyRules(cur.orig || cur), fiche = FICHES.find(f => f.id === why.fiche);
  $('#fb').innerHTML = `<div class="fb ${good ? 'ok' : 'ko'}">
    <p><strong>${esc(head)}</strong></p>
    ${notes.length ? `<ul class="notes">${notes.slice(0, 6).map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
    ${said ? `<p>${cur.pilote ? 'Le pilote a dit' : 'Votre réponse'} : <span class="said">${diff ? paint(diff.U, 'extra') : esc(said)}</span></p>` : ''}
    ${cur.notMine ? '' : `<p>${cur.pilote ? 'Collationnement attendu' : 'Réponse attendue'} : <strong>${diff ? paint(diff.E, 'miss') : esc(ans)}</strong></p>`}
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
  clearInterval(timer); hush();
  stats();
  const n = session?.type === 'exam' ? pool.length : total; // examen : les questions sans réponse comptent fausses
  const pct = n ? Math.round(100 * ok / n) : 0;
  let title = 'FIN DE SÉRIE', body = `<p class="ctx">Série terminée : ${ok} / ${total} (${pct} %)</p>`;
  if (session?.type === 'exam') {
    const mins = Math.round((Date.now() - session.t0) / 60000);
    (extra.exams ||= []).push({ date: today(), pct }); save();
    const ko = session.log.filter(x => !x.good);
    title = 'EXAMEN BLANC';
    body = `<p class="ctx">${pct >= EXAM_OK ? '✅' : '❌'} Note : ${ok} / ${n} (${pct} %) en ${mins} min.
      ${n > total ? `${n - total} question(s) sans réponse (temps écoulé).` : ''}</p>
      <p class="muted" style="margin:0 20px">Format d'entraînement (${EXAM_N} questions, ${EXAM_MIN} min, réussite à ${EXAM_OK} %) : ce n'est pas le format officiel d'un examen.</p>
      ${ko.length ? `<ol class="review">${ko.map(x => `<li><strong>${esc(x.q.q || x.q.atc)}</strong><br>
        Votre réponse : <span class="extra">${esc(x.chosen)}</span><br>Bonne réponse : <strong>${esc(x.q.answers[0])}</strong>
        <br><span class="src">📘 ${esc(x.q.src)}</span></li>`).join('')}</ol>` : '<p class="ctx">Aucune erreur. Bravo !</p>'}`;
  } else if (session?.type === 'defi') {
    (extra.defi ||= {})[today()] = ok; save();
    const last = Object.entries(extra.defi).sort().slice(-7).map(([d, s]) => `${d.slice(5)} : ${s}/10`).join(' · ');
    title = 'DÉFI DU JOUR';
    body = `<p class="ctx">🏆 Défi du ${today()} : ${ok} / ${total}. Revenez demain pour un nouveau défi.</p>
      <p class="muted" style="margin:0 20px">Vos derniers défis : ${esc(last)}</p>`;
  } else if (session?.type === 'lecon') {
    const ls = parcours(QUESTIONS.filter(langOk), prog);
    const L = ls[session.n], nx = ls[session.n + 1];
    title = 'PARCOURS';
    body = `<p class="ctx">🧭 ${esc(L.titre)} : ${ok} / ${total} dans cette série. Leçon réussie à ${Math.round(100 * L.pct)} %
      (${L.done} / ${L.qs.length} exercices justes).</p><p class="muted" style="margin:0 20px">${nx ? (nx.open ? `✅ Leçon suivante débloquée : ${esc(nx.titre)}.`
      : `Il faut 80 % pour débloquer « ${esc(nx.titre)} ».`) : 'Dernière leçon du parcours.'}</p>`;
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

function showParcours() {
  const ls = parcours(QUESTIONS.filter(langOk), prog);
  $('#parcoursBody').innerHTML = ls.map((x, i) => `<li class="${x.open ? '' : 'lock'}">
    <span>${x.pct >= SEUIL ? '✅' : x.open ? '▶️' : '🔒'} ${esc(x.titre)}</span>
    <div class="meter" aria-hidden="true"><div style="width:${Math.round(100 * x.pct)}%;background:var(--ok)"></div></div>
    <span class="num">${x.done} / ${x.qs.length}</span>
    <button class="ghost" data-l="${i}" ${x.open ? '' : 'disabled'}>${x.open ? (x.done ? 'Continuer' : 'Commencer') : 'Verrouillée'}</button></li>`).join('');
  $$('#parcoursBody [data-l]').forEach(b => b.addEventListener('click', () => { $('#parcours').close(); start({ type: 'lecon', n: +b.dataset.l }); }));
  $('#parcours').showModal();
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
  if (e.code === 'Space' && $('#mic')) { // alternat : maintenir Espace pour parler
    e.preventDefault();
    if (!e.repeat && !answered && !$('#mic').disabled) listenMic();
    return;
  }
  if (!answered && /^[1-4]$/.test(e.key)) $$('.opts button')[e.key - 1]?.click();
});

document.addEventListener('keyup', e => {
  if (e.code !== 'Space' || !$('#mic') || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName) || $('dialog[open]')) return;
  e.preventDefault(); recNow?.stop(); // relâcher l'alternat
});
$('#sujet').insertAdjacentHTML('beforeend', Object.entries(SUJETS).map(([k, v]) => `<option value="${k}">${v}</option>`).join(''));
$('#terrain').insertAdjacentHTML('beforeend', TERRAINS.map(t => `<option value="${t.icao}">${t.nom} (${t.icao})</option>`).join(''));
$$('.settings input, #sujet, #terrain').forEach(i => i.addEventListener('change', () => start()));
$('#statsBtn').addEventListener('click', showStats);
$('#parcoursBtn').addEventListener('click', showParcours);
fetch('metar.json', { cache: 'no-store' }).then(r => (r.ok ? r.json() : [])).then(j => { METAR = j; if ($('#terrain').value) start(); }).catch(() => {});
$('#examBtn').addEventListener('click', () => {
  if (confirm(`Examen blanc : ${EXAM_N} questions en QCM, ${EXAM_MIN} minutes, réussite à ${EXAM_OK} %, correction à la fin. Commencer ?`)) start({ type: 'exam' });
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
// q.nav : les étapes de la navigation reprennent des exercices de base mot pour mot, elles ont leur propre progression
QUESTIONS.forEach(q => { q.id = hash([q.lang, q.regle, q.atc, q.q, q.ctx, ...(q.nav ? [q.nav] : [])].join('|')).toString(36); });
errCount();
start();
