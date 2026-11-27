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

// Éléments du collationnement (écrit, oral) : part des collationnements où l'élément a été oublié ou faux.
const ELEM_NOM = { indicatif: 'l’indicatif', qnh: 'le QNH', piste: 'la piste', transpondeur: 'le code transpondeur', niveau: 'le niveau ou l’altitude', cap: 'le cap', sens: 'gauche / droite' };
function elemRows() {
  const E = Object.entries(extra.elem || {}).filter(([k, [n]]) => ELEM_NOM[k] && n).map(([k, [n, m]]) => [k, n, m, Math.round(100 * m / n)]).sort((a, b) => b[3] - a[3]);
  if (!E.length) return '<h3>🔎 Éléments du collationnement</h3><p class="muted">Répondez à l’écrit ou à l’oral pour voir ce que vous oubliez le plus.</p>';
  const [k0, n0, , p0] = E[0];
  return `<h3>🔎 Éléments du collationnement</h3>${n0 >= 5 && p0 ? `<p>Vous oubliez ou vous trompez sur <strong>${ELEM_NOM[k0]}</strong> dans ${p0} % des collationnements.</p>` : ''}
    <table>${E.map(([k, n, , p]) => `<tr><td>${esc(ELEM_NOM[k])}</td><td><div class="meter"><div style="width:${p}%;background:${p >= 20 ? 'var(--ko)' : p >= 10 ? '#d97706' : 'var(--ok)'}"></div></div></td>
      <td class="num">${p} % <span class="muted">(${n})</span></td><td>${n >= 5 && p ? `<button class="ghost" data-cible="${k}">🎯 Série ciblée</button>` : ''}</td></tr>`).join('')}</table>`;
}
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
    ${elemRows()}
    <h3>🏅 Badges</h3><div class="badges">${badges(QUESTIONS, prog, extra).map(x =>
      `<span class="badge ${x.ok ? 'got' : ''}" title="${esc(x.desc)}">${x.icon} ${esc(x.nom)}<small>${esc(x.desc)}</small></span>`).join('')}</div>
    <h3>📊 Réussite par catégorie</h3><table>${rows}</table>
    ${Object.keys(extra.terr || {}).length ? `<h3>🗺️ Réussite par terrain réel</h3><table>${Object.entries(extra.terr).map(([icao, [o, k]]) => {
      const n = o + k, p = n ? Math.round(100 * o / n) : null, t = TERRAINS.find(x => x.icao === icao);
      return `<tr><td>${esc(t ? t.nom : icao)}</td><td><div class="meter"><div style="width:${p ?? 0}%;background:${color(p)}"></div></div></td><td class="num">${p ?? '—'} % <span class="muted">(${n})</span></td></tr>`; }).join('')}</table>` : ''}`;
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
  if (session && !/cible|lecon|rare|refresh|prepa/.test(session.type)) return 'qcm';
  return session?.type === 'lecon' ? ({ dictee: 'ecrit', fautif: 'qcm' }[m] || m) : m;
};
const navOrder = (a, b) => b.lang.localeCompare(a.lang) || a.nav - b.nav; // français puis anglais, dans l'ordre du vol
const words = s => s.split(' ').length;

// exercices de la langue choisie (l'alphabet est dans toutes les langues)
const langOk = q => val('lang') === 'all' || q.regle === 'alpha' || q.lang === val('lang');

const GOAROUND = /^F-GBCD, (remettez les gaz|go around)\b/; // remises de gaz du manuel (p. 159), aussi dans « Imprévus »
const NIV = { 1: 'Débutant', 2: 'Confirmé', 3: 'Expert', 4: 'Expert+' };
// Niveau adaptatif (option, entraînement libre) : 10 bonnes réponses d'affilée → niveau au-dessus ; 3 erreurs sur les
// 5 dernières réponses → niveau en dessous, et le message raté revient 3 cartes plus loin. Règle d'entraînement du site.
// Le nouveau niveau vaut pour les messages suivants (voix, bruit, écoute seule) ; la série en cours garde ses exercices.
let recent = [], adaptMsg = '';
function adaptLevel(good) {
  recent = [...recent, good].slice(-5);
  const n = +val('niv'), to = good && streak && streak % 10 === 0 && n < 4 ? n + 1 : !good && recent.filter(x => !x).length >= 3 && n > 1 ? n - 1 : 0;
  if (!to) return '';
  $(`#n-${to}`).checked = true; recent = [];
  if (to < n) pool.splice(Math.min(pool.length, idx + 3), 0, pool[idx - 1]);
  return to > n ? `📈 Niveau ${NIV[to]} : 10 bonnes réponses d’affilée.` : `📉 Retour au niveau ${NIV[to]} : 3 erreurs sur les 5 dernières réponses. Le message raté reviendra bientôt.`;
}
// Situations rares (ce qu'on pratique peu en vrai, compétence qui se perd vite) : interception, détresse et urgence,
// panne radio, VFR spécial. Les questions d'interception n'existent qu'en français.
function rarePool() {
  const sh = a => a.sort(() => Math.random() - 0.5), txt = q => `${q.ctx} ${q.q || ''} ${q.atc} ${q.answers[0]}`;
  const by = (f, n) => sh(QUESTIONS.filter(q => q.regle !== 'alpha' && f(q))).slice(0, n);
  return sh([...by(q => q.cat === 'intercept', 4), ...by(q => q.cat === 'urgence' && langOk(q) && /MAYDAY|PAN PAN/.test(txt(q)), 3),
    ...by(q => langOk(q) && /7600|panne radio|radio failure/i.test(txt(q)), 2), ...by(q => langOk(q) && /VFR spécial|special VFR/.test(txt(q)), 2)]);
}

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
  } else if (session?.type === 'rare') pool = rarePool();
  else if (session?.type === 'refresh') { // remise à niveau : points faibles (erreurs, révisions dues) puis situations rares
    const weak = QUESTIONS.filter(q => langOk(q) && q.regle !== 'alpha' && (isErr(q) || isDue(q)) && (q.niv || 1) <= +val('niv')).sort(() => Math.random() - 0.5);
    const fill = QUESTIONS.filter(q => langOk(q) && q.atc && !q.q && q.st && !q.cat && (q.niv || 1) <= +val('niv')).sort(() => Math.random() - 0.5);
    pool = [...new Set([...weak, ...fill])].slice(0, 10).concat(rarePool().slice(0, 5));
  } else if (session?.type === 'prepa') pool = []; // construite plus bas, une fois le terrain et la météo connus
  else if (session?.type === 'exam') // examen blanc : tous sujets, selon la langue choisie
    pool = QUESTIONS.filter(langOk).sort(() => Math.random() - 0.5).slice(0, EXAM_N);
  else {
    // la navigation complète (enchaînement) n'apparaît que dans son sujet, sauf en révision
    pool = QUESTIONS.filter(q => (r === 'alpha' || (su === 'all' ? q.cat !== 'nav' || r === 'err' || r === 'due' : (q.cat || 'base') === su || (su === 'imprevu' && GOAROUND.test(q.atc || '')))) &&
      (r === 'err' ? isErr(q) && langOk(q) : r === 'due' ? isDue(q) && langOk(q)
        : r === 'alpha' ? q.regle === 'alpha' : q.regle !== 'alpha' && (r === 'all' || q.regle === r) && langOk(q))
      && (m === 'qcm' || !q.qcmOnly) && (m !== 'dictee' || (q.atc && !q.q && words(q.atc) >= 8)) && (m !== 'fautif' || (q.atc && !q.q))
      && (val('niv') !== '4' || !q.atc || q.q || q.niv >= 2 || words(q.atc) >= 7) // Expert+ : messages longs ou combinés
      && (!chrono || r === 'alpha' || r === 'err' || q.st) && (q.niv || 1) <= +val('niv'));
    if (su === 'nav' && r !== 'err' && r !== 'due') pool.sort(navOrder);
    else if (!chrono) {
      if (r !== 'err' && r !== 'due') pool = pool.concat(pool.filter(isErr)); // les questions ratées reviennent deux fois plus souvent
      pool.sort(() => Math.random() - 0.5);
      if ($('#tempo').checked) { const n = q => words(q.atc || q.q || q.ctx || ''); pool.sort((a, b) => n(a) - n(b)); } // clairances de plus en plus longues
    }
  }
  if (session) {
    session.log = []; session.t0 = Date.now();
    if (session.type === 'exam') { session.deadline = session.t0 + EXAM_MIN * 60000; timer = setInterval(tick, 1000); }
  }
  idx = ok = total = streak = 0; tempoK = 0; recent = [];
  // un indicatif par série, comme un vrai vol ; F-GBCD pour le défi du jour (identique pour tous)
  series = $('#random').checked && session?.type !== 'defi' ? newCallsign() : 'F-GBCD';
  memo = {}; // même piste et mêmes codes pendant toute la série
  // terrain réel (pas pour le défi, identique pour tous) : piste face au vent du dernier METAR
  terrain = session?.type === 'defi' ? null : TERRAINS.find(t => t.icao === (session?.icao || $('#terrain').value)) || null;
  wx = terrain && wxOf(terrain.icao);
  near = nearTraffic(terrain);
  // piste en service (désignation complète, « 32R ») ; les exercices ne connaissent que les deux chiffres
  if (terrain) { memo.rwFull = bestRunway(terrain.pistes, wx?.wdir, wx?.wspd, terrain.pref); memo.rw24 = memo.rw32 = memo.rw12 = memo.rwFull.slice(0, 2); }
  memo.sidPick = Math.floor(Math.random() * 6); memo.from = Math.random() < 0.5 ? 'N' : 'S'; // provenance des arrivées
  runLog = [];
  atisLetter = terrain && wx ? atisFromMetar(wx.raw, terrain, memo.rwFull, 'fr')?.letter : null; // même lettre dans toute la série
  const live = terrain && wx && !session && !['alpha', 'err', 'due'].includes(val('regle')) && ['all', 'atis', 'base', 'nav', 'trafic'].includes($('#sujet').value)
    && !['fautif', 'dictee'].includes(val('mode')) ? liveAtis(val('lang') === 'all' ? (Math.random() < 0.5 ? 'fr' : 'en') : val('lang')) : [];
  if (live.length) pool = [...live, ...pool.filter(q => q.cat !== 'atis')]; // l'ATIS reconstitué remplace l'ATIS fictif de Saint-Exémery
  // météo réelle : visibilité ou plafond bas → VFR spécial ; vent fort ou rafales → remise de gaz (exercices vérifiés existants)
  const met = live.length && parseMetar(wx.raw);
  if (met && $('#sujet').value === 'all') {
    const low = (met.vis && met.vis < 5000) || met.clouds.some(c => /BKN|OVC/.test(c.c || '') && c.h < 1500);
    const windy = wx.wspd >= 20 || wx.gust >= 25;
    const m = val('mode'), tag = (re, note) => QUESTIONS.filter(q => langOk(q) && q.atc && re.test(q.atc) && (m === 'qcm' || !q.qcmOnly))
      .sort(() => Math.random() - 0.5).slice(0, 2).map(q => ({ ...q, ctx: `${note} ${q.ctx}` }));
    const extraWx = [...(low ? tag(/VFR spécial|special VFR/, '🌫️ Visibilité ou plafond bas au METAR.') : []),
      ...(windy ? tag(/remettez les gaz|go around/, '💨 Vent fort au METAR.') : [])];
    pool.splice(live.length, 0, ...extraWx);
  }
  // trafic réel autour du terrain (relevé OpenSky) : information de trafic juste après le décollage
  if (live.length && ['all', 'trafic'].includes($('#sujet').value)) pool.splice(live.length, 0, ...liveTraffic(live[0].lang));
  // approche ILS fictive : remplacée par l'approche publiée pour la piste en service ; aucune publiée : exercice écarté
  if (terrain && !terrain.appr?.[memo.rwFull]) pool = pool.filter(q => !/approche ILS|ILS approach/.test(`${q.ctx} ${q.atc} ${q.answers?.[0]}`));
  // départ normalisé fictif : remplacé par une SID publiée pour la piste ; aucune publiée : exercice écarté
  if (terrain && !terrain.sid?.[memo.rwFull]) pool = pool.filter(q => !/BALSI 6P/.test(q.atc || ''));
  const L1 = live[0]?.lang || (val('lang') === 'en' ? 'en' : 'fr');
  // météo sous les minima VFR : le VFR spécial est-il possible avec les minima du terrain ?
  if (live.length && ['all', 'trafic', 'base'].includes(su)) pool.splice(live.length, 0, ...liveSvfr(L1));
  // panne radio : conduite à tenir publiée sur la carte VAC du terrain
  if (live.length && ['all', 'urgence'].includes(su)) pool.splice(Math.min(pool.length, live.length + 5), 0, ...livePanne(L1));
  // transit réel de la zone par les itinéraires VFR publiés de la VAC
  if (live.length && ['all', 'transit'].includes(su)) pool.splice(live.length, 0, ...liveTransit(L1));
  // clairance conditionnelle derrière un avion réellement en courte finale (OpenSky)
  if (live.length && ['all', 'sol'].includes(su)) pool.splice(live.length, 0, ...liveCond(L1));
  // nuit aéronautique au terrain : deux questions de vol de nuit en tête de série
  night = !!terrain?.pos && isNight(terrain.pos);
  if (live.length && night && su === 'all') pool.splice(live.length, 0, ...QUESTIONS.filter(q => q.cat === 'nuit' && q.lang === live[0].lang
    && (!q.terrain || q.terrain === terrain.icao)).sort(() => Math.random() - 0.5).slice(0, 2));
  // détresse en situation : depuis un vrai point de la carte VAC, sur la vraie fréquence de la Tour
  if (live.length && ['all', 'urgence'].includes(su)) pool.splice(Math.min(pool.length, live.length + 3), 0, ...liveEmergency(live[0].lang));
  // navigations réelles (cartes VAC, METAR des deux terrains)
  if (su.startsWith('navreel:') && !session && !['alpha', 'err', 'due'].includes(r))
    pool = (val('lang') === 'all' ? ['fr', 'en'] : [val('lang')]).flatMap(l => liveNav(l, su.slice(8)));
  // un imprévu en plein vol (attente, 360, remise de gaz…) au milieu d'une série sur terrain réel
  if (live.length && su === 'all' && pool.length > 8) {
    const im = QUESTIONS.filter(q => (q.cat === 'imprevu' || GOAROUND.test(q.atc || '')) && q.lang === L1 && q.regle === 'vfr');
    pool.splice(live.length + 4 + Math.floor(Math.random() * 4), 0, im[Math.floor(Math.random() * im.length)]);
  }
  // situations rares avec un terrain réel : détresse depuis un point de la VAC et panne radio de la VAC
  if (session?.type === 'rare' && terrain && wx) pool.splice(4, 0, ...liveEmergency(L1), ...livePanne(L1));
  // préparation du vol de demain : ATIS (METAR du moment), fréquences, point d'entrée, TAF à l'heure prévue, panne radio, VFR spécial,
  // puis des exercices de base adaptés au terrain
  if (session?.type === 'prepa') pool = wx ? [...liveAtis(L1), ...livePrepa(L1, session.at), ...livePanne(L1), ...liveSvfr(L1),
    ...QUESTIONS.filter(q => !q.cat && q.regle === 'vfr' && q.lang === L1 && q.atc && !q.q && q.st && (q.niv || 1) <= +val('niv'))
      .sort(() => Math.random() - 0.5).slice(0, 8)] : [];
  // hors horaires ATS avec fréquence A/A publiée : la série passe en auto-information sur cette fréquence
  aaMode = !!(terrain?.aa && !atsOpen(terrain) && ['all', 'afis'].includes(su) && !session && !['alpha', 'err', 'due'].includes(r));
  if (aaMode) pool = [...live.filter(q => q.cat === 'atis'), ...liveAA(), ...QUESTIONS.filter(q => q.cat === 'afis' && q.lang === 'fr' && q.qcmOnly
    && /non contrôlé|sans ATS/.test(q.ctx)).sort(() => Math.random() - 0.5)];
  stats();
  next();
}

// ── Réalisme : prépare la carte (valeurs aléatoires, indicatif abrégé, message pour un autre avion, coupure) ──
let series = 'F-GBCD', memo = {}, terrain = null, wx = null, atisLetter = null, night = false, near = 0, aaMode = false, runLog = [], TAF = [];
// METAR officiels récupérés par GitHub toutes les 30 min (metar.json, format aviationweather.gov) ; trop ancien = ignoré
let METAR = [];
function wxOf(icao) {
  const m = Array.isArray(METAR) && METAR.find(x => x.icaoId === icao);
  // GitHub ne lance la mise à jour planifiée que toutes les quelques heures : relevé gardé 12 h (24 h hors ligne), âge affiché
  const age = m && (Date.now() / 1000 - m.obsTime) / 3600;
  if (!m || age > (navigator.onLine === false ? 24 : 12)) return null;
  return { wdir: m.wdir, wspd: m.wspd, gust: m.wgst || null, qnh: Math.round(m.altim), raw: m.rawOb, age: Math.floor(age) };
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
  if (terrain) c = realTerrain(c, terrain, wx, atisLetter, memo.rwFull, memo.sidPick, memo.from);
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
  // transmissions simultanées : un autre avion émet en même temps que le contrôleur (sifflement, message brouillé)
  if (+val('niv') >= 2 && c.atc && c.st && !c.q && !c.elements && c.cat !== 'atis' && Math.random() < (xp ? 0.15 : 0.08)) {
    const o = QUESTIONS.filter(x => x.lang === c.lang && x.st && x.atc && !x.q && !x.elements && x.cat !== 'nav');
    const ocs = newCallsign();
    let ov = vary(o[Math.floor(Math.random() * o.length)], { cs: ocs, values: true, memo: { ...memo } }); // même piste, mêmes valeurs
    if (terrain) ov = realTerrain(ov, terrain, wx, atisLetter, memo.rwFull, memo.sidPick, memo.from);
    return { ...c, blocked: { text: ov.answers[0], lang: c.lang, st: c.st, pilot: true, cs: ocs }, full: c, qcmOnly: false, niv: 1,
      q: en ? 'Two stations transmitted at the same time: the message is garbled. What do you say?'
        : 'Deux stations ont émis en même temps : le message est brouillé. Que dites-vous ?',
      answers: [en ? `Say again, ${shown}` : `Répétez, ${shown}`],
      wrong: [...new Set([c.answers[0], en ? `Roger, ${shown}` : `Reçu, ${shown}`, `Wilco, ${shown}`, en ? `Affirm, ${shown}` : `Roger, ${shown}`])].slice(0, 3),
      src: `${SERA('SERA.14045, tableau S14-4')} (RÉPÉTEZ / SAY AGAIN) ; ${MANUEL(24)} (transmissions simultanées : le contrôleur fait retransmettre)` };
  }
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
  // fréquence chargée : chaque avion relevé autour du terrain (OpenSky) ajoute des échanges
  const p = Math.min(0.85, ({ 2: 0.25, 3: 0.4, 4: 0.6 }[val('niv')] || 0) + Math.min(0.35, near * 0.03));
  if (session || !c.atc || !q.st || Math.random() >= p) return null;
  const others = QUESTIONS.filter(x => x.st === q.st && x.lang === q.lang && x.atc && !x.q && !x.elements && x.cat !== 'nav' && x !== q);
  if (!others.length) return null;
  const x = others[Math.floor(Math.random() * others.length)];
  const cs = val('niv') === '4' && Math.random() < 0.5 ? similarCallsign(series) : newCallsign(); // Expert+ : indicatif proche
  let v = vary(x, { cs, values: true, memo: { ...memo } });
  if (terrain) v = realTerrain(v, terrain, wx, atisLetter, memo.rwFull, memo.sidPick, memo.from);
  const ex = [{ text: v.atc, lang: q.lang, st: c.st, who: `ATC → ${cs}` }, { text: v.answers[0], lang: q.lang, st: c.st, pilot: true, far: true, cs, who: cs }];
  return near >= 10 && Math.random() < 0.5 ? [...ex, ...(chatterFor({ ...q, x: 1 }, c) || [])].slice(0, 4) : ex; // très chargée : deux échanges
}
// Avions en vol relevés à moins de 30 NM du terrain et sous 3000 m (OpenSky, relevé de moins de 2 h).
function nearTraffic(t) {
  if (!t?.pos || !TRAFFIC?.states || Date.now() / 1000 - TRAFFIC.time > 2 * 3600) return 0;
  const k = Math.cos(t.pos[0] * Math.PI / 180);
  return TRAFFIC.states.filter(s => !s[8] && s[6] != null && s[7] != null && s[7] < 3000
    && Math.hypot((s[6] - t.pos[0]) * 60, (s[5] - t.pos[1]) * 60 * k) <= 30).length;
}

// Détresse en situation sur le terrain réel : message MAYDAY depuis le point d'entrée de la carte VAC, sur la
// fréquence de la Tour (ordre des éléments : SERA.14095, Manuel p. 238), puis 121,5 MHz (AIP GEN 3.6.5.3 c)).
function liveEmergency(lang) {
  const en = lang === 'en', cs = series, [P, aP] = entryPoint(terrain, memo.rwFull, memo.from);
  if (!P) return [];
  const twr = `${terrain.radio} ${en ? 'Tower' : 'Tour'}`, f = en ? terrain.tour.replace(',', '.') : terrain.tour;
  const alt = aP || terrain.tdp, cap = String(10 * (1 + Math.floor(Math.random() * 36))).padStart(3, '0');
  const base = { live: true, prepared: true, cat: 'urgence', lang, regle: 'vfr', qcmOnly: true, shown: cs, callsigns: [csKey(cs)], atc: '',
    st: `${twr} ${f}`, metar: wx?.raw };
  const vac = `${en ? 'VAC chart' : 'carte VAC'} ${terrain.icao} (SIA, AIRAC 29/10/2026)`;
  return [
    { ...base, q: en ? 'Which distress message is correctly built?' : 'Quel message de détresse est correctement construit ?',
      ctx: en ? `Engine fire at ${alt} feet over point ${P} (${terrain.nom} VAC chart), heading ${cap}. You will make a forced landing.`
        : `Moteur en feu à ${alt} pieds au point ${P} (carte VAC de ${terrain.nom}), cap ${cap}. Vous allez vous poser en campagne.`,
      answers: [en ? `MAYDAY MAYDAY MAYDAY, ${twr}, ${cs}, engine fire, forced landing, point ${P}, ${alt} feet, heading ${cap}`
        : `MAYDAY MAYDAY MAYDAY, ${twr}, ${cs}, feu moteur, atterrissage en campagne, point ${P}, ${alt} pieds, cap ${cap}`],
      wrong: en ? [`MAYDAY MAYDAY MAYDAY, ${cs}, point ${P}, ${twr}, forced landing, engine fire`,
        `PAN PAN, PAN PAN, PAN PAN, ${twr}, ${cs}, engine fire, forced landing, point ${P}`, `${twr}, ${cs}, MAYDAY, engine fire`]
        : [`MAYDAY MAYDAY MAYDAY, ${cs}, point ${P}, ${twr}, atterrissage en campagne, feu moteur`,
          `PAN PAN, PAN PAN, PAN PAN, ${twr}, ${cs}, feu moteur, atterrissage en campagne, point ${P}`, `${twr}, ${cs}, MAYDAY, feu moteur`],
      src: `${SERA('SERA.14095')} ; ${MANUEL(238)} ; point et fréquence : ${vac}, ${AIP_AD(terrain.icao)}` },
    { ...base, q: en ? 'What can you do?' : 'Que pouvez-vous faire ?',
      ctx: en ? `You transmitted your MAYDAY on ${twr} ${f}: no answer.` : `Vous avez transmis votre MAYDAY sur ${twr} ${f} : aucune réponse.`,
      answers: [en ? 'Transmit the MAYDAY again on 121.5 MHz' : 'Retransmettre le MAYDAY sur 121,5 MHz'],
      wrong: en ? ['Wait without transmitting', 'Transmit the MAYDAY again on 123.5 MHz', 'Downgrade to PAN PAN on the same frequency']
        : ['Attendre sans rien émettre', 'Retransmettre le MAYDAY sur 123,5 MHz', 'Passer en PAN PAN sur la même fréquence'],
      src: `${AIP('GEN 3.6.5.3 c)')} : message de détresse sur la fréquence en cours, puis éventuellement sur 121,5 MHz` },
  ];
}

// Auto-information hors horaires ATS sur la fréquence A/A publiée (AD 2.18 ou VAC : « Absence ATS : A/A, FR seulement »).
function liveAA() {
  const t = terrain, src = `${AIP_AD(t.icao)} (AD 2.18) et carte VAC ${t.icao} ; ${ARRETE('partie B, § 9')}`;
  const base = { live: true, prepared: true, cat: 'afis', lang: 'fr', regle: 'vfr', qcmOnly: true, atc: '', shown: series, callsigns: [csKey(series)],
    st: `${t.radio} A/A ${t.aa}`, metar: wx?.raw, ctx: `${t.nom} : hors horaires ATS publiés (${t.atsTxt}). La carte VAC indique « Absence ATS : A/A ${t.aa} ».` };
  return [
    { ...base, q: 'Sur quelle fréquence transmettez-vous vos messages d’auto-information ?', answers: [`${t.aa} MHz, la fréquence A/A publiée pour ${t.radio}`],
      wrong: ['123,500 MHz, la fréquence commune d’auto-information', `${swapFreq(t.aa)} MHz`, '121,500 MHz'], src },
    { ...base, q: 'En quelle langue transmettez-vous ?', answers: ['En français uniquement'],
      wrong: ['En anglais uniquement', 'En français ou en anglais', 'Dans la langue de votre choix'], src: `Carte VAC ${t.icao} (« A/A … FR seulement »)` },
    { ...base, q: `Qui vous autorise à atterrir à ${t.radio} à cette heure-ci ?`, answers: ['Personne : pas de contrôle, vous annoncez votre position et vos intentions'],
      wrong: [`${t.radio} Tour, sur ${t.tour}`, `${t.app?.nom || 'L’approche'} Approche`, 'L’agent AFIS'], src: `${src} ; ${ARRETE('partie B, § 8.2 a)')}` },
  ];
}

// VFR spécial : le METAR réel permet-il le VFR spécial avec les minima publiés sur la VAC du terrain (ou ceux de SERA.5010) ?
function liveSvfr(lang) {
  const t = terrain, m = wx && parseMetar(wx.raw.split(/ (?:TEMPO|BECMG) /)[0]);
  if (!t.svfr || !m) return [];
  const ceil = Math.min(...m.clouds.filter(c => /BKN|OVC/.test(c.c || '')).map(c => c.h)), vis = m.cavok ? 10000 : m.vis;
  if (vis >= 5000 && !(ceil < 1500)) return []; // VFR normal possible : pas d'exercice
  const en = lang === 'en', okc = t.svfr.filter(([, v, c]) => vis >= v && !(ceil < c));
  const lab = l => (en ? { 'en présence de trafic IFR': 'with IFR traffic', 'sans trafic IFR': 'without IFR traffic', 'à l’arrivée': 'on arrival',
    'au départ et en tour de piste': 'for departure and circuits', 'VFR spécial': 'special VFR' }[l] || 'without IFR traffic in the CTR' : l);
  const one = t.svfr.length === 1, no = en ? 'No: below the special VFR minima' : 'Non : sous les minima du VFR spécial';
  const yes = one ? (en ? 'Yes: special VFR minima met' : 'Oui : minima du VFR spécial respectés') : (en ? 'Yes, in every published case' : 'Oui, dans tous les cas publiés');
  const only = c => (en ? `Only ${lab(c[0])}` : `Seulement ${c[0]}`);
  const ans = okc.length === t.svfr.length ? yes : okc.length ? only(okc[0]) : no;
  const opts = [yes, no, ...(one ? [] : t.svfr.map(only)), en ? 'Yes: normal VFR is enough' : 'Oui : le VFR normal suffit', en ? 'Only at night' : 'Seulement de nuit'];
  const wrong = [...new Set(opts.filter(o => o !== ans))].slice(0, 3);
  const mins = t.svfr.map(([l, v, c]) => `${lab(l)} : ${v} m${c ? `, ${c} ft` : ''}`).join(' ; ');
  return [{ live: true, prepared: true, cat: 'base', lang, regle: 'vfr', qcmOnly: true, atc: '', shown: series, callsigns: [csKey(series)],
    st: `${t.radio} ${en ? 'Tower' : 'Tour'} ${en ? t.tour.replace(',', '.') : t.tour}`, metar: wx.raw,
    ctx: en ? `Real METAR at ${t.nom}: visibility ${vis} m${isFinite(ceil) ? `, ceiling ${ceil} ft` : ''}. You want to fly under special VFR.`
      : `METAR réel de ${t.nom} : visibilité ${vis} m${isFinite(ceil) ? `, plafond ${ceil} ft` : ''}. Vous voulez voler en VFR spécial.`,
    q: en ? 'Is special VFR possible with the published minima?' : 'Le VFR spécial est-il possible avec les minima publiés ?', answers: [ans], wrong,
    src: `Minima ${mins} — ${t.svfrSera ? SERA('SERA.5010') + (t.icao === 'LFRS' ? ' ; carte VAC LFRS (non autorisé avec du trafic IFR dans la CTR)' : '') : `carte VAC ${t.icao}, consignes particulières « VFR spécial »`}` }];
}

// Panne radio : conduite publiée sur la carte VAC du terrain, pour une situation tirée au hasard.
function livePanne(lang) {
  const t = terrain, keys = Object.keys(t.panne || {});
  if (!keys.length) return [];
  const k = keys[Math.floor(Math.random() * keys.length)], i = lang === 'en' ? 1 : 0, ans = t.panne[k][i];
  const close = (a, b) => a.slice(0, 25) === b.slice(0, 25);
  const wrong = PANNE_FAUX[k].map(x => x[i]).filter(x => !close(x, ans)).sort(() => Math.random() - 0.5).slice(0, 3);
  return [{ live: true, prepared: true, cat: 'urgence', lang, regle: 'vfr', qcmOnly: true, atc: '', shown: series, callsigns: [csKey(series)],
    st: `${t.radio} ${i ? 'Tower' : 'Tour'} ${i ? t.tour.replace(',', '.') : t.tour}`, metar: wx?.raw,
    ctx: `${PANNE[k][i]} (${t.nom})`, q: i ? 'What do you do (VAC chart procedure)?' : 'Que faites-vous (procédure de la carte VAC) ?', answers: [ans], wrong,
    src: `Carte VAC ${t.icao}, consignes particulières de radiocommunication (SIA, AIRAC 29/10/2026) ; code 7600 : ${SERA('SERA.13005 a) 2)')}` }];
}

// Transit de la CTR par les itinéraires VFR publiés sur la VAC (Bordeaux : « itinéraires à double sens, utilisables pour
// les départs, les arrivées et les transits », altitude de survol 1500 ft), sur le modèle du manuel p. 178-179.
// Pau ne publie pas d'itinéraire de transit : pas d'exercice.
const TRANSIT = { LFBD: { alt: 1500, n: 'N', s: 'S', via: { 23: ['NA', 'SA'], '05': ['NA', 'SA'], 29: ['EA', 'SA'], 11: ['EA', 'OA'] },
  vac: 'carte VAC LFBD, TXT 01-02 (itinéraires VFR à double sens, altitude de survol 1500 ft)' } };
function liveTransit(lang) {
  const t = terrain, d = TRANSIT[t.icao], via = d?.via[memo.rwFull];
  if (!via) return [];
  const en = lang === 'en', cs = series, mm = String((new Date().getUTCMinutes() + 10) % 60).padStart(2, '0'), [a, b] = via;
  const st = `${t.radio} ${en ? 'Tower' : 'Tour'} ${en ? t.tour.replace(',', '.') : t.tour}`, twr = `${t.radio} ${en ? 'Tower' : 'Tour'}`;
  const base = { live: true, prepared: true, cat: 'transit', lang, regle: 'vfr', st, shown: cs, callsigns: [csKey(cs), csKey(abbrev(cs))], metar: wx?.raw };
  const src = `${MANUEL(178)} ; ${MANUEL(179)} ; ${d.vac}`, alt = d.alt, ft = en ? 'feet' : 'pieds';
  return [
    { ...base, qcmOnly: true, atc: '', q: en ? 'What is your request?' : 'Quelle est votre demande ?', src,
      ctx: en ? `You want to cross the ${t.nom} control zone from north to south (points ${d.n} and ${d.s} of the VAC chart) at ${alt} feet; you estimate ${d.n} at ${mm}.`
        : `Vous voulez traverser la zone de ${t.nom} du nord au sud (points ${d.n} et ${d.s} de la carte VAC) à ${alt} pieds ; vous estimez ${d.n} à ${mm}.`,
      answers: [en ? `${twr}, ${cs}, request VFR transit, ${alt} feet from ${d.n} to ${d.s}, estimating ${d.n} at ${mm}` : `${twr}, ${cs}, demande transit VFR, ${alt} pieds, de ${d.n} à ${d.s}, j’estime ${d.n} à ${mm}`],
      wrong: en ? [`${twr}, ${cs}, crossing the zone`, `${cs}, request transit`, `${twr}, ${cs}, transit at ${alt} feet, roger`]
        : [`${twr}, ${cs}, je traverse la zone`, `${cs}, demande transit`, `${twr}, ${cs}, transit à ${alt} pieds, roger`] },
    { ...base, src, ctx: en ? 'You requested the transit.' : 'Vous avez demandé le transit.',
      atc: en ? `${cs}, transit via ${d.n}, ${a}, ${b}, then ${d.s}, maintain ${alt} feet and report before ${b}.`
        : `${cs}, transitez via ${d.n}, ${a}, ${b}, puis ${d.s}, maintenez ${alt} pieds, et rappelez avant ${b}.`,
      answers: [en ? `Roger, transiting via ${d.n}, ${a}, ${b}, then ${d.s}, maintaining ${alt} feet, calling back before ${b}, ${cs}`
        : `Roger, je transite via ${d.n}, ${a}, ${b}, puis ${d.s}, maintiens ${alt} pieds, et rappelle avant ${b}, ${cs}`],
      wrong: en ? [`Roger, ${cs}`, `Transiting via ${d.n}, ${a}, ${b}, then ${d.s}, ${cs}`, `Transiting via ${d.n}, ${a}, ${b}, then ${d.s}, maintaining ${alt + 1000} ${ft}, calling back before ${b}, ${cs}`]
        : [`Roger, ${cs}`, `Je transite via ${d.n}, ${a}, ${b}, puis ${d.s}, ${cs}`, `Je transite via ${d.n}, ${a}, ${b}, puis ${d.s}, maintiens ${alt + 1000} ${ft}, et rappelle avant ${b}, ${cs}`] },
    { ...base, src, ctx: en ? `Before ${b}; the departing traffic has passed.` : `Avant ${b} ; le départ qui vous gênait est passé.`,
      atc: en ? `${cs}, continue transit ${d.s}, report ${d.s} to leave.` : `${cs}, poursuivez transit vers ${d.s}, rappelez ${d.s} pour quitter.`,
      answers: [en ? `Continuing transit ${d.s}, reporting ${d.s} to leave, ${cs}` : `Je poursuis transit vers ${d.s}, et rappelle ${d.s} pour quitter, ${cs}`],
      wrong: en ? [`Roger, ${cs}`, `Continuing, ${cs}`, `Continuing transit ${d.n}, reporting ${d.n} to leave, ${cs}`]
        : [`Roger, ${cs}`, `Je poursuis, ${cs}`, `Je poursuis transit vers ${d.n}, et rappelle ${d.n} pour quitter, ${cs}`] },
  ];
}

// Clairance conditionnelle derrière un avion réellement en courte finale (OpenSky) : moins de 5 NM, aligné sur l'axe
// de la piste en service et en rapprochement, sous l'altitude du tour de piste + 1000 ft. Le type d'avion n'est pas connu :
// « le trafic » (le manuel nomme le type, p. 57-58).
function liveCond(lang) {
  const t = terrain;
  if (!t?.pos || !TRAFFIC?.states || Date.now() / 1000 - TRAFFIC.time > 2 * 3600) return [];
  const h = parseInt(memo.rwFull) * 10, k = Math.cos(t.pos[0] * Math.PI / 180), dif = (a, b) => Math.abs(((a - b) % 360 + 540) % 360 - 180);
  const fin = TRAFFIC.states.find(s => {
    if (s[8] || s[6] == null || s[7] == null || s[10] == null) return false;
    const dy = (s[6] - t.pos[0]) * 60, dx = (s[5] - t.pos[1]) * 60 * k, d = Math.hypot(dx, dy), brg = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
    return d <= 5 && dif(s[10], h) < 25 && dif(brg, h + 180) < 25 && s[7] * 3.28084 < t.tdp + 1000;
  });
  if (!fin) return [];
  const en = lang === 'en', cs = series, R = rwyName(memo.rwFull, en), bad = rwyName(memo.rwFull.replace(/^\d\d/, d => [...d].reverse().join('')), en);
  const hhmm = new Date(TRAFFIC.time * 1000).toISOString().slice(11, 16).replace(':', '');
  return [{ live: true, prepared: true, cat: 'sol', lang, regle: 'vfr', shown: cs, callsigns: [csKey(cs), csKey(abbrev(cs))], metar: wx?.raw,
    st: `${t.radio} ${en ? 'Tower' : 'Tour'} ${en ? t.tour.replace(',', '.') : t.tour}`,
    ctx: en ? `At the holding point runway ${R}. A real aircraft (${(fin[1] || '').trim() || 'unknown callsign'}) is on short final (OpenSky, ${hhmm} UTC); you reported it in sight.`
      : `Au point d'attente piste ${R}. Un avion réel (${(fin[1] || '').trim() || 'indicatif inconnu'}) est en courte finale (OpenSky, ${hhmm} UTC) ; vous l'avez annoncé en vue.`,
    atc: en ? `${cs}, behind traffic on short final, line up and wait runway ${R} behind.` : `${cs}, derrière le trafic en courte finale, alignez-vous et attendez piste ${R} derrière.`,
    answers: [en ? `Behind traffic on short final, lining up and waiting runway ${R} behind, ${cs}` : `Derrière le trafic en courte finale, je m'aligne et attends piste ${R} derrière, ${cs}`],
    wrong: en ? [`Lining up and waiting runway ${R}, ${cs}`, `Roger, ${cs}`, `Behind traffic on short final, lining up and waiting runway ${bad} behind, ${cs}`]
      : [`Je m'aligne et attends piste ${R}, ${cs}`, `Roger, ${cs}`, `Derrière le trafic en courte finale, je m'aligne et attends piste ${bad} derrière, ${cs}`],
    src: `${MANUEL(57)} ; ${MANUEL(58)} ; position réelle : The OpenSky Network (ADS-B, opensky-network.org)` }];
}

// Navigations réelles (NAV_REAL, data-lot3.js) : pistes face au vent des deux METAR, sortie par le point de la procédure
// de départ de la VAC, information de vol, entrée par le point publié, tour de piste de la VAC. Phraséologie du manuel,
// comme la navigation fictive. Temps de vol à 100 kt entre les points (heure UTC simulée affichée, vol en accéléré).
const nm = (a, b) => Math.hypot((a[0] - b[0]) * 60, (a[1] - b[1]) * 60 * Math.cos(a[0] * Math.PI / 180));
// TAF officielle à une heure donnée (arrivée estimée, vol de demain) : conditions sous les minima VFR d'une CTR ?
function tafQ(lang, icao, name, ms, day = false) {
  const taf = TAF.find(x => x.icaoId === icao), ft = taf && tafAt(taf, Math.round(ms / 1000));
  if (!ft) return null;
  const en = lang === 'en', d = new Date(ms).toISOString(), when = `${day ? `${d.slice(8, 10)}/${d.slice(5, 7)} ` : ''}${d.slice(11, 16).replace(':', '')} UTC`;
  const O = en ? { vfr: 'No: VFR conditions forecast', durable: 'Yes, lasting (base forecast or BECMG/FM)', temporaire: 'Only temporarily or with a probability (TEMPO / PROB)', hors: 'The TAF does not cover your arrival time' }
    : { vfr: 'Non : conditions VFR prévues', durable: 'Oui, de façon durable (prévision de base, BECMG ou FM)', temporaire: 'Seulement temporairement ou avec une probabilité (TEMPO / PROB)', hors: 'La TAF ne couvre pas votre heure d’arrivée' };
  return { ctx: en ? `Flight preparation. ${name} TAF: ${taf.rawTAF}. Estimated arrival ${when}.` : `Préparation du vol. TAF de ${name} : ${taf.rawTAF}. Arrivée estimée le ${when}.`,
    ans: O[ft], wrong: Object.values(O).filter(o => o !== O[ft]),
    src: `TAF officielle ${icao} (aviationweather.gov) ; minima : ${SERA('SERA.5005 b)')} (visibilité 5 km, plafond 1500 ft)`,
    q: en ? 'At your arrival time, does the TAF forecast conditions below the VFR minima of a control zone?' : 'À votre heure d’arrivée, la TAF prévoit-elle des conditions sous les minima VFR d’une zone de contrôle ?' };
}
// Préparation du vol de demain sur un terrain réel : fréquences (AIP), point d'entrée de la VAC pour la piste face au vent
// du METAR du moment, TAF à l'heure d'arrivée prévue.
function livePrepa(lang, at) {
  const t = terrain, en = lang === 'en', fq = f => (en ? f.replace(',', '.') : f), out = [];
  const card = (ctx, q, ans, wrong, src) => ({ live: true, prepared: true, cat: 'base', lang, regle: 'vfr', qcmOnly: true, atc: '', shown: series,
    callsigns: [csKey(series)], st: '', ctx, q, answers: [ans], wrong: [...new Set(wrong)].filter(w => w !== ans).slice(0, 3), src });
  const F = [[`${t.radio} ${en ? 'Tower' : 'Tour'}`, t.tour], [`${t.radio} ${en ? 'Ground' : 'Sol'}`, t.sol], [`${t.radio} ATIS`, t.atis]].filter(([, f]) => f);
  for (const [n, f] of F.slice(0, 2)) out.push(card(en ? `Flight to ${t.nom} tomorrow.` : `Vol vers ${t.nom} demain.`,
    en ? `What is the "${n}" frequency?` : `Quelle est la fréquence « ${n} » ?`, fq(f),
    [...F.filter(([, g]) => g !== f).map(([, g]) => fq(g)), fq(swapFreq(f))], AIP_AD(t.icao)));
  // point d'entrée : seulement quand la VAC le fixe selon la piste et la provenance (Pau) ; ailleurs la carte en propose
  // plusieurs et le choix dépend de la route suivie
  const [e, alt] = entryPoint(t, memo.rwFull, memo.from), pts = [...new Set(JSON.stringify(t.entree || '').match(/"[A-Z]{1,3}"/g) || [])].map(x => x.slice(1, -1));
  if (e && typeof t.entree === 'object') out.push(card(en ? `Runway in use with the current METAR wind: ${rwyName(memo.rwFull, true)}${typeof t.entree?.[memo.rwFull] === 'object' && !Array.isArray(t.entree[memo.rwFull]) ? `, arriving from the ${memo.from === 'S' ? 'south' : 'north'}` : ''}.`
      : `Piste en service avec le vent du METAR du moment : ${rwyName(memo.rwFull, false)}${typeof t.entree?.[memo.rwFull] === 'object' && !Array.isArray(t.entree[memo.rwFull]) ? `, arrivée du ${memo.from === 'S' ? 'sud' : 'nord'}` : ''}.`,
    en ? 'Which VAC entry point do you report?' : 'Par quel point d’entrée de la VAC arrivez-vous ?', `${e}${alt ? ` (${alt} ft)` : ''}`,
    pts.filter(p => p !== e).map(p => `${p}${alt ? ` (${alt} ft)` : ''}`), `Carte VAC ${t.icao} (SIA, AIRAC 29/10/2026)`));
  const tq = tafQ(lang, t.icao, t.nom, at, true);
  if (tq) out.push(card(tq.ctx, tq.q, tq.ans, tq.wrong, tq.src));
  return out;
}
function liveNav(lang, id) {
  const r = NAV_REAL[id], A = T_(r.from), B = T_(r.to), wa = wxOf(r.from), wb = wxOf(r.to);
  if (!wa || !wb) return [];
  const en = lang === 'en', cs = series, fq = f => (en ? f.replace(',', '.') : f), rev = x => [...x].reverse().join('');
  const ra = bestRunway(A.pistes, wa.wdir, wa.wspd, A.pref), RA = rwyName(ra, en);
  let rb = bestRunway(B.pistes, wb.wdir, wb.wspd, B.pref), nuit = '';
  if (B.icao === 'LFBT' && isNight(B.pos) && rb === '02') { rb = '20'; nuit = en ? ' At night, landing on runway 02 is prohibited (VAC).' : ' De nuit, l’atterrissage piste 02 est interdit (VAC).'; }
  const RB = rwyName(rb, en), side = B.circuit?.[rb], sideTxt = side ? (en ? `${side === 'droite' ? 'right' : 'left'}-hand ` : `main ${side} `) : '';
  const sideBad = side ? (en ? `${side === 'droite' ? 'left' : 'right'}-hand ` : `main ${side === 'droite' ? 'gauche' : 'droite'} `) : (en ? 'base ' : 'base ');
  const wind = w => (w.wspd === 0 ? (en ? ', wind calm' : ', vent calme') : typeof w.wdir !== 'number' ? '' // vent variable : non formulé
    : kt(`, ${en ? 'wind' : 'vent'} ${String(w.wdir || 360).padStart(3, '0')} ${en ? 'degrees' : 'degrés'} ${w.wspd} ${en ? 'knots' : 'nœuds'}${w.gust ? `, ${en ? 'gusting' : 'rafales'} ${w.gust} ${en ? 'knots' : 'nœuds'}` : ''}`));
  const [X, depFr, depEn, xPos] = r.dep[ra], X2 = ['SE', 'SW', 'NE', 'NW', 'S', 'N'].find(p => p !== X);
  const [Y, yPos] = Array.isArray(r.arr) ? r.arr : r.arr[rb];
  const twrA = `${A.radio} ${en ? 'Tower' : 'Tour'} ${fq(A.tour)}`, gndA = A.sol ? `${A.radio} ${en ? 'Ground' : 'Sol'} ${fq(A.sol)}` : twrA;
  const twrBn = `${B.radio} ${en ? 'Tower' : 'Tour'}`, twrB = `${twrBn} ${fq(B.tour)}`, info = ([n, f]) => `${n} Information ${fq(f)}`;
  const letter = atisFromMetar(wb.raw, B, rb, 'fr')?.letter, alt = r.alt;
  const cA = A.nom.split('-')[0], cB = B.nom.split('-')[0]; // villes (« de Pau à Tarbes »), pas l'indicatif radio
  // temps de vol (min) à 100 kt
  const t1 = Math.max(2, Math.round(nm(A.pos, xPos) * 0.6)), tc = Math.max(4, Math.round(nm(xPos, yPos) * 0.6)), t3 = Math.max(2, Math.round(nm(yPos, B.pos) * 0.6));
  const t0 = Date.now(), at = m => new Date(t0 + m * 60000), hm = m => at(m).toISOString().slice(11, 16).replace(':', '');
  const etaY = hm(4 + t1 + tc), mm = etaY.slice(2);
  const closed = !atsOpen(B, at(4 + t1 + tc + t3)) ? (en ? ` ⚠️ At your arrival time ${twrBn} is closed (AIP hours): for real, ${B.aa ? `self-announce on ${fq(B.aa)} (French only)` : 'no control service'}.`
    : ` ⚠️ À votre heure d’arrivée, ${twrBn} est fermée (horaires AIP) : en vrai, ${B.aa ? `auto-information sur ${B.aa} (en français)` : 'pas de contrôle'}.`) : '';
  const vacA = `carte VAC ${A.icao}, ${r.vacDep}`, vacB = `carte VAC ${B.icao}, ${r.vacArr}`;
  const S = (st, wait, ctx, atc, ans, wrong, src, q) => ({ st, wait, ctx, atc, ans, wrong, src, q });
  const L = [
    S(gndA, 0, en ? `Departure from ${A.nom} to ${B.nom} under VFR (real VAC charts, today's weather). At the apron, ATIS received, you requested taxi.`
      : `Départ de ${A.nom} vers ${B.nom} en VFR (cartes VAC réelles, météo du jour). Au parking, ATIS reçue, vous avez demandé le roulage.`,
    en ? `${cs}, taxi holding point runway ${RA}.` : `${cs}, roulez point d'attente piste ${RA}.`,
    en ? `Taxiing holding point runway ${RA}, ${cs}` : `Je roule point d'attente piste ${RA}, ${cs}`,
    en ? [`Roger, ${cs}`, `Taxiing, ${cs}`, `Taxiing holding point runway ${rev(ra.slice(0, 2))}, ${cs}`] : [`Roger, ${cs}`, `Je roule point d'attente, ${cs}`, `Je roule point d'attente piste ${rev(ra.slice(0, 2))}, ${cs}`], MANUEL(44)),
    S(twrA, 3, en ? 'At the holding point, ready for departure.' : "Au point d'attente, prêt au départ.",
      en ? `${cs}, line up and wait runway ${RA}.` : `${cs}, alignez-vous et attendez piste ${RA}.`,
      en ? `Lining up and waiting runway ${RA}, ${cs}` : `Je m'aligne et attends piste ${RA}, ${cs}`,
      en ? [`Roger, ${cs}`, `Lining up runway ${RA}, ${cs}`, `Runway ${RA}, taking-off, ${cs}`] : [`Roger, ${cs}`, `Je m'aligne piste ${RA}, ${cs}`, `Piste ${RA}, je décolle, ${cs}`], MANUEL(53)),
    S(twrA, 1, en ? `Lined up runway ${RA}.` : `Aligné piste ${RA}.`,
      en ? `${cs}, runway ${RA}, cleared for take-off${wind(wa)}.` : `${cs}, piste ${RA}, autorisé décollage${wind(wa)}.`,
      en ? `Runway ${RA}, taking-off, ${cs}` : `Piste ${RA}, je décolle, ${cs}`,
      en ? [`Roger, ${cs}`, `Taking-off, ${cs}`, `Runway ${rev(ra.slice(0, 2))}, taking-off, ${cs}`] : [`Je décolle, ${cs}`, `Roger, ${cs}`, `Piste ${rev(ra.slice(0, 2))}, je décolle, ${cs}`], MANUEL(59)),
    S(twrA, 1, en ? depEn : depFr, en ? `${cs}, report ${X}.` : `${cs}, rappelez ${X}.`, en ? `Reporting ${X}, ${cs}` : `Je rappelle ${X}, ${cs}`,
      en ? [`Roger, ${cs}`, `${X}, ${cs}`, `Reporting ${X2}, ${cs}`] : [`Roger, ${cs}`, `${X}, ${cs}`, `Je rappelle ${X2}, ${cs}`], `${MANUEL(149)} ; ${vacA}`),
  ];
  // information de vol puis, le cas échéant, l'organisme de premier contact demandé par la VAC d'arrivée
  const handoff = (st, wait, ctx, to) => S(st, wait, ctx, en ? `${cs}, contact ${to}.` : `${cs}, contactez ${to}.`, `${to}, ${cs}`,
    en ? [`Good day, ${cs}`, `Roger, ${cs}`, `${to.replace(/[\d.,]+$/, f => fq(swapFreq(f.replace('.', ','))))}, ${cs}`]
      : [`Au revoir, ${cs}`, `Roger, ${cs}`, `${to.replace(/[\d,]+$/, f => swapFreq(f))}, ${cs}`], `${MANUEL(15)} ; ${MANUEL(182)}`);
  L.push(handoff(twrA, t1, en ? `Passing ${X}, leaving the ${A.radio} zone towards ${B.nom}.` : `Vous passez ${X} et quittez la zone de ${A.radio} vers ${B.nom}.`, info(r.fis[0])));
  const arrStn = r.arrFis ? info(r.fis[r.fis.length - 1]) : twrB, arrName = arrStn.replace(/ [\d.,]+$/, '');
  r.fis.slice(1).forEach((f, k) => L.push(handoff(info(r.fis[k]), Math.round(tc / 2), en ? `Cruising at ${alt} feet towards ${B.nom}.` : `En croisière à ${alt} pieds vers ${B.nom}.`, info(f))));
  { const q = String(wb.qnh), sw = q.slice(0, -2) + [...q.slice(-2)].reverse().join(''), fisL = info(r.fis[r.fis.length - 1]);
    L.push(S(fisL, 0, en ? `The flight information service passes you the ${cB} QNH (real METAR).` : `L’information de vol vous transmet le QNH de ${cB} (METAR réel).`,
      `${cs}, QNH ${cB} ${q}.`, `QNH ${q}, ${cs}`,
      [`Roger, ${cs}`, `QNH ${sw === q ? +q + 1 : sw}, ${cs}`, `QNH ${+q - 1}, ${cs}`], `${SERA('SERA.8015 e) 1) iii)')} (calage altimétrique collationné) ; ${AIP('ENR 1.7.2.3')}`)); }
  if (!r.arrFis) L.push(handoff(info(r.fis[r.fis.length - 1]), Math.max(1, (r.fis.length > 1 ? Math.round(tc / 2) : tc) - 5),
    en ? `Cruising at ${alt} feet; point ${Y} of the ${B.nom} VAC chart is 5 minutes ahead.` : `En croisière à ${alt} pieds ; le point ${Y} de la carte VAC de ${B.nom} est à 5 minutes.`, twrB));
  L.push(S(arrStn, r.arrFis ? Math.max(1, Math.round(tc / 2) - 5) : 0,
    en ? `Arriving: DR400, ${alt} feet, estimating ${Y} at ${mm}${letter ? `, ATIS "${letter}" received` : ''}. Contact established ("${cs}, good morning, pass your message").${closed}`
      : `Arrivée : DR400, ${alt} pieds, estimé ${Y} à ${mm}${letter ? `, ATIS « ${letter} » écoutée` : ''}. Le contact est établi (« ${cs}, bonjour, j’écoute »).${closed}`, '',
    en ? `${cs}, DR400, VFR from ${cA} to ${cB} for landing, ${alt} feet, estimate ${Y} at ${mm}${letter ? `, information ${letter}` : ''}`
      : `${cs}, DR400, VFR de ${cA} à ${cB} pour atterrissage, ${alt} pieds, estimé ${Y} à ${mm}${letter ? `, information ${letter}` : ''}`,
    en ? [`${cs}, coming to land at ${cB}`, `${cs}, ${alt} feet, DR400${letter ? `, information ${letter}` : ''}`, `${cs}, DR400, VFR from ${cA} to ${cB} for landing`]
      : [`${cs}, je viens atterrir à ${cB}`, `${cs}, ${alt} pieds, DR400${letter ? `, information ${letter}` : ''}`, `${cs}, DR400, VFR de ${cA} à ${cB} pour atterrissage`],
    `${MANUEL(149)} ; ${vacB}`, en ? 'Which message do you send?' : 'Quel message envoyez-vous ?'));
  L.push(S(arrStn, 0, en ? 'You passed your arrival message.' : 'Vous avez donné votre message d’arrivée.', en ? `${cs}, roger, report ${Y}.` : `${cs}, roger, rappelez ${Y}.`,
    en ? `Reporting ${Y}, ${cs}` : `Je rappelle ${Y}, ${cs}`, en ? [`Roger, ${cs}`, `${Y}, ${cs}`, `Reporting downwind, ${cs}`] : [`Roger, ${cs}`, `${Y}, ${cs}`, `Je rappelle vent arrière, ${cs}`], MANUEL(149)));
  if (r.arrFis) L.push(handoff(arrStn, 5, en ? `Passing ${Y}.` : `Vous passez ${Y}.`, twrB));
  L.push(S(twrB, r.arrFis ? 0 : 5, (en ? `Passing ${Y} ("${twrBn}, ${cs}, passing ${Y}").` : `Vous passez ${Y} (« ${twrBn}, ${cs}, passe ${Y} »).`) + nuit,
    en ? `${cs}, join ${sideTxt}downwind runway ${RB}, report downwind.` : `${cs}, entrez vent arrière ${sideTxt}piste ${RB}, rappelez vent arrière.`,
    en ? `Reporting ${sideTxt}downwind runway ${RB}, ${cs}` : `Je rappelle vent arrière ${sideTxt}piste ${RB}, ${cs}`,
    en ? [`Roger, ${cs}`, `Downwind, ${cs}`, `Reporting ${sideBad}${side ? 'downwind' : 'leg'} runway ${RB}, ${cs}`]
      : [`Roger, ${cs}`, `Vent arrière, ${cs}`, side ? `Je rappelle vent arrière ${sideBad}piste ${RB}, ${cs}` : `Je rappelle base piste ${RB}, ${cs}`], `${MANUEL(149)} ; ${vacB}`));
  L.push(S(twrB, t3, en ? `${sideTxt}downwind runway ${RB}.`.replace(/^./, c => c.toUpperCase()) : `Vent arrière ${sideTxt}piste ${RB}.`,
    en ? `${cs}, report final runway ${RB}.` : `${cs}, rappelez finale piste ${RB}.`, en ? `Reporting final runway ${RB}, ${cs}` : `Je rappelle finale piste ${RB}, ${cs}`,
    en ? [`Roger, ${cs}`, `Final, ${cs}`, `Reporting base runway ${RB}, ${cs}`] : [`Roger, ${cs}`, `Finale, ${cs}`, `Je rappelle base piste ${RB}, ${cs}`], MANUEL(151)));
  L.push(S(twrB, 2, en ? `On final runway ${RB}.` : `En finale piste ${RB}.`, en ? `${cs}, runway ${RB}, cleared to land${wind(wb)}.` : `${cs}, piste ${RB}, autorisé atterrissage${wind(wb)}.`,
    en ? `Runway ${RB}, landing, ${cs}` : `Piste ${RB}, j'atterris, ${cs}`,
    en ? [`Roger, ${cs}`, `Landing, ${cs}`, `Runway ${rev(rb.slice(0, 2))}, landing, ${cs}`] : [`J'atterris, ${cs}`, `Roger, ${cs}`, `Piste ${rev(rb.slice(0, 2))}, j'atterris, ${cs}`], MANUEL(154)));
  L.push(S(twrB, 2, en ? 'Runway vacated after landing.' : 'Piste dégagée après l’atterrissage.', en ? `${cs}, taxi general aviation apron.` : `${cs}, roulez parking aviation générale.`,
    en ? `Taxiing general aviation apron, ${cs}` : `Je roule parking aviation générale, ${cs}`,
    en ? [`Roger, ${cs}`, `Apron, ${cs}`, `Taxiing holding point runway ${RB}, ${cs}`] : [`Roger, ${cs}`, `Parking, ${cs}`, `Je roule point d'attente piste ${RB}, ${cs}`], MANUEL(160)));
  // météo réelle sous les minima pour décoller ou atterrir en VFR en zone de contrôle (SERA.5005 b) : plafond 1500 ft,
  // visibilité 5 km) : on le signale au départ
  const low = [wa, wb].some(w => { const m = parseMetar(w.raw.split(/ (?:TEMPO|BECMG) /)[0]) || {};
    return (m.vis && m.vis < 5000) || (m.clouds || []).some(c => /BKN|OVC/.test(c.c || '') && c.h < 1500); });
  if (low) L[0].ctx += en ? ' ⚠️ Today the METAR is below the VFR minima of a control zone (ceiling 1,500 ft, visibility 5 km, SERA.5005 b)): for real, this flight would need a special VFR clearance or would not take place.'
    : ' ⚠️ Aujourd’hui, le METAR est sous les minima VFR d’une zone de contrôle (plafond 1500 ft, visibilité 5 km, SERA.5005 b)) : en vrai, il faudrait un VFR spécial, ou le vol n’aurait pas lieu.';
  // position simulée : roulage et attente (4 min) puis A → point de sortie → point d'entrée → B
  const legs = [[A.pos, xPos, t1], [xPos, yPos, tc], [yPos, B.pos, t3]];
  const where = min => { let m = min - 4; if (m <= 0) return A.pos;
    for (const [p, q, d] of legs) { if (m <= d) return [p[0] + (q[0] - p[0]) * m / d, p[1] + (q[1] - p[1]) * m / d]; m -= d; } return B.pos; };
  const pts = [[...A.pos, A.icao, 1], [...xPos, X], [...yPos, Y], [...B.pos, B.icao, 1]];
  // TAF de destination à l'heure d'arrivée estimée (avant le roulage)
  const tq = tafQ(lang, B.icao, cB, t0 + (4 + t1 + tc + t3) * 60000);
  if (tq) L.unshift({ st: '', wait: 0, atc: '', ...tq });
  let clock = 0;
  return L.map((c, i) => {
    clock += c.wait;
    c.map = { pts, plane: where(clock) };
    const atB = c.st.startsWith(B.radio) || c.st === arrStn;
    return { live: true, prepared: true, cat: 'nav', nav: i + 1, lang, regle: 'vfr', st: c.st, atc: c.atc, answers: [c.ans], wrong: c.wrong,
      icao: atB ? B.icao : A.icao, phase: / Information /.test(c.st) ? 'cruise' : atB ? 'arr' : 'dep', clock, route: `${cA} → ${cB}`,
      ctx: `${c.wait >= 2 ? `⏱ ${hm(clock)} UTC (+${c.wait} min${en ? '' : ''}). ` : ''}${c.ctx}`, wait: c.wait,
      src: `${c.src} ; ${atB ? AIP_AD(B.icao) : AIP_AD(A.icao)}`, shown: cs, callsigns: [csKey(cs), csKey(abbrev(cs))],
      metar: (atB ? wb : wa).raw, map: c.map, ...(c.q ? { q: c.q, qcmOnly: true } : {}) };
  });
}

// Trafic réel relevé par GitHub toutes les 30 min (traffic.json, OpenSky Network) ; relevé de plus de 2 h : ignoré.
let TRAFFIC = null;
function liveTraffic(lang) {
  const st = Array.isArray(METAR) && METAR.find(x => x.icaoId === terrain.icao);
  if (!TRAFFIC?.states || !st || Date.now() / 1000 - TRAFFIC.time > 2 * 3600) return [];
  const en = lang === 'en', rwy = rwyName(memo.rwFull, en), own = { lat: st.lat, lon: st.lon, hdg: parseInt(memo.rwFull) * 10, alt: terrain.tdp };
  const seen = TRAFFIC.states.map(s => trafficInfo(own, s, lang)).filter(Boolean).sort((a, b) => a.dist - b.dist).slice(0, 2);
  const hhmm = new Date(TRAFFIC.time * 1000).toISOString().slice(11, 16).replace(':', '');
  const cs = series, callsigns = [csKey(cs), csKey(abbrev(cs))];
  const src = `Position réelle relevée à ${hhmm} UTC par The OpenSky Network (ADS-B, opensky-network.org) ; forme du ${MANUEL(89)} et p. 90-92`;
  const base = { live: true, prepared: true, cat: 'trafic', lang, regle: 'vfr', shown: cs, callsigns, src,
    st: `${terrain.radio} ${en ? 'Tower' : 'Tour'} ${en ? terrain.tour.replace(',', '.') : terrain.tour}`,
    ctx: en ? `Just airborne from runway ${rwy} at ${terrain.nom}, climbing through ${terrain.tdp} feet. Traffic picture recorded at ${hhmm} UTC.`
      : `Vous venez de décoller piste ${rwy} de ${terrain.nom}, vers ${terrain.tdp} pieds. Trafic réel relevé à ${hhmm} UTC.` };
  return seen.flatMap((t, i) => {
    const atc = `${cs}, ${t.text}.`;
    const card = { ...base, atc, answers: en ? [`Looking out, ${cs}`, `Roger, looking, ${cs}`] : [`Je surveille, ${cs}`, `Roger, je regarde, ${cs}`],
      wrong: en ? [`Traffic in sight, ${cs}`, `Wilco, ${cs}`, `Negative, ${cs}`] : [`Trafic en vue, ${cs}`, `Wilco, ${cs}`, `Négatif, ${cs}`] };
    if (i) return [card];
    // compréhension (QCM) : où est le trafic ?
    const other = h => (((t.clock + h - 1) % 12) + 12) % 12 + 1;
    const opt = h => t.pos.replace(/^\d+/, other(h)).replace(/^1 heures/, '1 heure').replace(/^(\d\d?) heure,/, (m, n) => (n > 1 ? `${n} heures,` : m));
    return [card, { ...base, atc, qcmOnly: true, q: en ? 'Where is the traffic?' : 'Où se trouve le trafic ?', answers: [t.pos], wrong: [opt(6), opt(1), opt(-2)] }];
  });
}

// ATIS du terrain réel, mis en forme à partir du dernier METAR (realism.js) : deux questions tirées au hasard.
function liveAtis(lang) {
  const a = atisFromMetar(wx.raw, terrain, memo.rwFull, lang);
  if (!a) return [];
  const en = lang === 'en', ch = atisChoices(a, terrain.pistes);
  const qs = [
    [en ? 'What is the information letter?' : 'Quelle est la lettre de l’information ?', a.letter, ch.letter],
    [en ? 'Which runway is in use?' : 'Quelle est la piste en service ?', a.piste, ch.piste],
    [en ? 'What is the QNH?' : 'Quel est le QNH ?', a.qnh, ch.qnh],
    [en ? 'What is the transition level?' : 'Quel est le niveau de transition ?', a.tl, ch.tl],
  ];
  if (a.wind) qs.push([en ? 'What is the wind?' : 'Quel est le vent ?', a.wind, ch.wind]);
  return qs.sort(() => Math.random() - 0.5).slice(0, 2).map(([q, ans, wrong]) => ({
    live: true, prepared: true, cat: 'atis', lang, regle: 'vfr', who: 'ATIS', shown: series,
    st: `${terrain.radio} ATIS ${en ? terrain.atis.replace(',', '.') : terrain.atis}`,
    ctx: en ? `ATIS rebuilt from the official ${terrain.nom} METAR (fictitious information letter; transition level computed from the QNH; no local instructions). It is broadcast in a loop: you tune in mid-message.`
      : `ATIS reconstitué d’après le METAR officiel de ${terrain.nom} (lettre d’information fictive ; niveau de transition calculé avec le QNH ; sans consignes locales). Diffusion en boucle : vous prenez l’écoute en cours de message.`,
    atc: a.text, q, answers: [ans], wrong,
    src: `ATIS reconstitué (pas la diffusion réelle) : METAR ${terrain.icao} officiel (aviationweather.gov), mis en forme selon le ${MANUEL(214)} et p. 215-218 ; niveau de transition : ${AIP('ENR 1.7.2.3')} (au moins 1000 ft au-dessus de l’altitude de transition de 5000 ft), calculé avec le QNH`,
  }));
}

function stats() {
  $('#score').textContent = `${ok} / ${total}`;
  $('#streak').textContent = `🔥 ${streak}`;
  const pc = pool.length ? Math.round(100 * idx / pool.length) : 0;
  $('#prog').style.width = pc + '%'; $('#bar').setAttribute('aria-valuenow', pc);
}

function next() {
  hush(); stopRecording(); clearTimeout(recallT);
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
    : session.type === 'cible' ? `🎯 ${esc(CONSEILS[session.kind]?.[0] || 'Entraînement ciblé')}` : session.type === 'rare' ? '🧯 Situations rares'
    : session.type === 'refresh' ? '🔁 Remise à niveau' : session.type === 'prepa' ? `✈️ Vol de demain : ${esc(terrain?.nom || '')}` : `🏆 Défi du ${today()}`}</span>` : '';
  const tempoTag = $('#tempo').checked && cur.atc ? `<span class="tag" title="Débit progressif">🏃 débit × ${(1 / slowNow()).toFixed(2).replace('.', ',')}</span>` : '';
  let h = `<div class="radio"><span class="led" id="led"></span><span>COM1</span><strong>${esc(cur.st || '—')}</strong>
    <span class="prog">${session?.type === 'exam' ? '<span id="timer" class="me"></span>' : ''}<span class="me" title="Votre indicatif">✈ ${esc(series)}</span> ${idx} / ${pool.length}</span></div>
    <div class="tags">${badge}${tempoTag}<span class="tag">${cur.regle === 'alpha' ? 'OACI' : cur.regle.toUpperCase()}</span>${cur.regle === 'alpha' ? '' : `<span class="tag">${en ? 'EN' : 'FR'}</span>`}${!session && isErr(cur) ? '<span class="tag err">À revoir</span>' : ''}</div>
    ${terrain && cur.st?.startsWith(terrain.radio) ? `<p class="metar">📡 ${wx ? `${esc(wx.raw)}${wx.age >= 2 ? ` <span class="closed">⚠️ relevé d’il y a ${wx.age} h</span>` : ''}` : 'METAR indisponible : vent et QNH de l’exercice.'}
      <span class="muted">${esc(terrain.nom)} · ${esc(AIP_AD(terrain.icao))}${night ? ` · 🌙 nuit aéronautique (jour à ${nightChange(terrain.pos)} UTC)` : ''}${near ? ` · ✈ ${near} avion${near > 1 ? 's' : ''} en vol à moins de 30 NM (OpenSky)` : ''}</span>
      ${atsOpen(terrain) ? '' : `<span class="closed">🌙 Hors horaires ATS publiés (${esc(terrain.atsTxt)}) : ${terrain.aa ? `auto-information sur ${esc(terrain.aa)} (A/A, en français).` : 'en réalité, pas de contrôle à cette heure-ci.'}</span>`}</p>`
    : cur.metar ? `<p class="metar">📡 ${esc(cur.metar)}</p>` : ''}
    ${cur.map ? navMap(cur.map, en) : ''}<p class="ctx">${esc(cur.ctx)}</p>`;
  if (cur.chatter) h += `<div class="fil" aria-label="${en ? 'Other traffic on frequency' : 'Autres avions sur la fréquence'}">${cur.chatter.map(l =>
    `<div class="bubble ${l.pilot ? 'pilot' : 'atc'} other"><div class="who">${esc(l.who)}</div><p class="msg ${listen ? 'hidden' : ''}" ${listen ? 'aria-hidden="true"' : ''}>${esc(l.text)}</p></div>`).join('')}</div>`;
  if (cur.atc) h += `<div class="bubble atc"><div class="who">${cur.who || 'ATC'}</div>
    <p class="msg ${listen ? 'hidden' : ''}" id="atc" ${listen ? 'aria-hidden="true"' : ''}>${cur.cut ? `${esc(cur.cut.heard)} <span class="cut">▒▒▒▒ ${en ? '(cut off)' : '(coupé)'}</span>`
      : cur.blocked ? `${esc(cur.atc.split(' ').slice(0, 2).join(' '))} <span class="cut">▒▒▒▒ ${en ? '(blocked: two stations at once)' : '(brouillé : deux stations à la fois)'}</span>` : esc(cur.atc)}</p>
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
  $('#txt')?.addEventListener('input', () => { cur.startAt ??= Date.now(); }, { once: true });
  const mic = $('#mic');
  if (mic) { // alternat : maintenir pour parler (relâcher = fin d'émission) ; appui court : arrêt au silence
    let t0 = 0;
    mic.addEventListener('pointerdown', e => { e.preventDefault(); t0 = Date.now(); if (!answered && !mic.disabled) listenMic(); });
    for (const ev of ['pointerup', 'pointercancel']) mic.addEventListener(ev, () => { if (Date.now() - t0 > 600) recNow?.stop(); });
    mic.addEventListener('contextmenu', e => e.preventDefault());
    if (matchMedia('(pointer: coarse)').matches) mic.textContent = '🎤 Maintenir pour parler';
  }
  if (listen) say(undefined, 500 + Math.random() * 900 + Math.min(3000, (cur.wait || 0) * 150)); else prefetchVoice(); // navigation : le temps passe // le contrôleur ne parle pas instantanément
  ($('#txt') || $('.opts button') || $('#mic'))?.focus();
  tick();
}

// Petite carte de la navigation réelle (SVG, sans fond de carte) : terrains, points VAC, route et position simulée.
function navMap({ pts, plane }, en) {
  const lat0 = pts.reduce((s, p) => s + p[0], 0) / pts.length, k = Math.cos(lat0 * Math.PI / 180);
  const xy = ([la, lo]) => [lo * k, -la], all = [...pts, plane].map(xy);
  const [x0, x1] = [Math.min(...all.map(p => p[0])), Math.max(...all.map(p => p[0]))], [y0, y1] = [Math.min(...all.map(p => p[1])), Math.max(...all.map(p => p[1]))];
  const W = 320, H = 150, pad = 26, sc = Math.min((W - 2 * pad) / (x1 - x0 || 1), (H - 2 * pad) / (y1 - y0 || 1));
  const P = p => { const [x, y] = xy(p); return [pad + (x - x0) * sc + ((W - 2 * pad) - (x1 - x0) * sc) / 2, pad + (y - y0) * sc + ((H - 2 * pad) - (y1 - y0) * sc) / 2].map(v => v.toFixed(1)); };
  const route = pts.map(p => P(p).join(',')).join(' '), [px, py] = P(plane);
  const marks = pts.map(p => { const [x, y] = P(p); return p[3] ? `<circle cx="${x}" cy="${y}" r="5" class="ad"/><text x="${x}" y="${+y - 9}">${esc(p[2])}</text>`
    : `<path d="M${x} ${+y - 5}L${+x + 5} ${+y + 4}L${+x - 5} ${+y + 4}Z" class="pt"/><text x="${x}" y="${+y + 15}">${esc(p[2])}</text>`; }).join('');
  return `<svg class="navmap" viewBox="0 0 ${W} ${H}" role="img" aria-label="${en ? 'Route map: simulated aircraft position' : 'Carte de la route : position simulée de l’avion'}">
    <polyline points="${route}" class="route"/>${marks}<circle cx="${px}" cy="${py}" r="6" class="me"/><text x="${px}" y="${+py - 10}" class="me">✈</text></svg>`;
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
  // accent choisi pour l'anglais ; « fr » : voix française ; « mix » : toutes les variantes, selon le poste
  const acc = lang === 'en' ? $('#accent').value : '';
  if (acc === 'fr') lang = 'fr';
  const want = { gb: /GB/, us: /US/, sco: /GB|IE/, fr: /FR/ }[acc] || (lang === 'fr' || val('niv') === '1' ? /GB|FR/ : null);
  const good = v => (/premium|enhanced|natural|neural|google/i.test(v.name) ? 2 : 0) + (want && want.test(v.lang) ? 1 : 0)
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
let rumbleNode = null, beatNode = null, overSrc = null;
function stopHiss() { for (const n of [hissNode, rumbleNode, beatNode, overSrc]) try { n?.stop(); } catch {} hissNode = rumbleNode = beatNode = overSrc = null; }
// Deux émetteurs en même temps : sifflement d'hétérodyne (battement des deux porteuses) et seconde voix par-dessus.
function blockWith(l, tok, L) {
  const c = audio(), o = c.createOscillator(), g = c.createGain();
  o.frequency.value = 500 + Math.random() * 1200; g.gain.value = 0.05;
  o.connect(g).connect(c.destination); o.start(); beatNode = o;
  if ($('#neural').checked) lineAudio(l.over).then(b => { if (tok === sayTok) overSrc = playRadio(b, L, null, 0.95); }).catch(() => {});
}

// ── Voix réaliste : synthèse neuronale Piper (calcul dans tts-worker.js, sans figer la page) passée dans un
// filtre radio VHF. Chaque voix est téléchargée une fois (≈ 60 Mo) puis gardée par le navigateur.
// En cas d'échec (hors ligne, navigateur trop ancien) : voix du système.
const NEURAL = { fr: ['fr_FR-tom-medium', 'fr_FR-siwis-medium'],
  en: ['en_GB-alan-medium', 'en_GB-cori-medium', 'en_GB-northern_english_male-medium'] };
// Accent des voix anglaises (option) ; « fr » : une voix française lit l'anglais, comme un contrôleur français.
const ACCENTS = { gb: NEURAL.en, us: ['en_US-ryan-medium', 'en_US-amy-medium'], sco: ['en_GB-alba-medium'], fr: NEURAL.fr,
  mix: ['en_GB-alan-medium', 'en_US-ryan-medium', 'en_GB-alba-medium', 'en_GB-northern_english_male-medium', 'fr_FR-tom-medium'] };
// Le contrôleur garde la voix de son poste ; un pilote prend une autre voix que celle du contrôleur.
function neuralVoice(lang, st, pilotCs) {
  const vs = lang === 'en' ? ACCENTS[$('#accent').value] || NEURAL.en : NEURAL.fr, atc = val('niv') === '1' ? 0 : hash(st || '') % vs.length;
  if (vs.length === 1) return vs[0];
  return pilotCs ? vs[(atc + 1 + hash(pilotCs) % (vs.length - 1)) % vs.length] : vs[atc];
}
// Débit : celui, naturel, du modèle ; un peu plus posé en Débutant (durée × 1,12).
const SLOW = { 1: 1.12, 2: 1, 3: 1, 4: 1 };
let ttsWorker = null, ttsSeq = 0, saySrc = null, sayTok = 0;
const audioCache = new Map(), ttsWait = new Map();
let ttsProgress = () => {};
// Débit progressif (option) : on part du débit posé d'un instructeur (durée × 1,25) ; chaque bonne réponse accélère, jusqu'à
// un débit plus rapide que le naturel (durée × 0,85), celui d'une fréquence chargée ; une erreur ralentit de deux crans.
// Règle d'entraînement du site, pas une norme officielle.
let tempoK = 0;
const slowNow = () => ($('#tempo').checked ? Math.max(0.85, 1.25 - 0.04 * tempoK) : SLOW[val('niv')]);
function neuralAudio(text, voiceId) {
  const slow = slowNow(), k = `${voiceId}|${slow}|${text}`;
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
  const lines = [...(cur.chatter && !cur.chatterDone ? cur.chatter : []), { text: main, lang: cur.lang, st: cur.st, cut: !!cur.cut && main === cur.cut.heard,
    over: text == null && cur.blocked ? cur.blocked : null }];
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
    // émetteurs d'approche et d'information de vol éloignés du terrain : réception plus bruitée que la Tour ou le Sol
    const remote = !l.pilot && /Approche|Approach|Information|Info |Contrôle|Control/.test(l.st || '');
    const hissV = (l.pilot ? L.hiss * 1.5 + 0.006 : L.hiss) * (l.far ? 2 : 1) * (remote ? 1.6 : 1);
    const tx = () => {
      if (tok !== sayTok) return;
      vstat(''); $('#led')?.classList.add('tx'); noise(hissV * 6, 0.08); hissNode = noise(hissV); // alternat + souffle porteuse
      if (l.pilot) rumbleNode = noise(0.06, 0, 'lowpass', 170);
      if (l.over) blockWith(l, tok, L);
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
  return tok === sayTok; // vrai si tout a été émis (pas interrompu)
}
// `text` par défaut : le message de la carte (ou sa partie reçue si la fin est coupée), précédé la première fois
// des échanges des autres avions sur la fréquence.
function say(text, delay = 0) {
  let lines = cardLines(text);
  // ATIS : diffusion en boucle ; on prend l'écoute en cours de message, puis le message complet repasse deux fois
  if (text == null && cur.cat === 'atis' && cur.live) {
    const ph = cur.atc.split(/(?<=\.) /), k = 1 + Math.floor(Math.random() * (ph.length - 2));
    lines = [ph.slice(k).join(' '), cur.atc, cur.atc].map(t => ({ text: t, lang: cur.lang, st: cur.st }));
  }
  if (cur.chatter) cur.chatterDone = true;
  const card = cur;
  return play(lines, delay).then(done => { if (done && text == null) { if (card === cur) cur.heardAt ??= Date.now(); armRecall(); } return done; });
}
// Pas de réponse au bout de 10 s (Expert, Expert+) : le contrôleur vous appelle (« F-CD, Pau Tour » : station appelée
// puis station appelante, SERA.14055 b)).
let recallT = null;
function armRecall() {
  clearTimeout(recallT);
  if (+val('niv') < 3 || answered || session?.type === 'exam' || !cur.atc || cur.q || cur.notMine || cur.dictee || cur.live || cur.pilote) return;
  const card = cur;
  recallT = setTimeout(() => {
    if (card !== cur || answered) return;
    const call = `${cur.shown}, ${cur.st.replace(/\s+[\d.,]+$/, '')}`;
    $('#fb').insertAdjacentHTML('beforebegin', `<div class="bubble atc"><div class="who">ATC</div><p class="msg">${esc(call)}</p></div>`);
    play([{ text: call, lang: cur.lang, st: cur.st }]);
  }, 10000);
}

// Voix du système (voix installées sur l'appareil), sans filtre radio possible.
function sysSay(l, L, tx, rx) {
  const v = pickVoice(l.lang, l.pilot ? `${l.st}|${l.cs}` : l.st);
  const u = new SpeechSynthesisUtterance(speakable(l.text, l.lang));
  u.lang = v?.lang || (l.lang === 'en' ? 'en-GB' : 'fr-FR');
  if (v) u.voice = v;
  u.rate = $('#tempo').checked ? 1 / slowNow() : L.rate;
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
  cur.startAt ??= Date.now(); // début de la réponse (temps de réaction)
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
// Réécoute de sa propre voix avec la même chaîne radio que le contrôleur (bande 300-3000 Hz, saturation, souffle,
// bruit du moteur dans le micro, squelch) : comme on vous entend sur la fréquence.
function playMine() {
  hush();
  const tok = sayTok, L = LEVELS[val('niv')];
  fetch(myAudio).then(r => r.arrayBuffer()).then(b => audio().decodeAudioData(b)).then(buf => {
    if (tok !== sayTok) return;
    const h = L.hiss * 1.5 + 0.006;
    noise(h * 6, 0.08); hissNode = noise(h); rumbleNode = noise(0.06, 0, 'lowpass', 170);
    saySrc = playRadio(buf, L, () => { if (tok === sayTok) { stopHiss(); noise(h * 6, 0.12); } });
  }).catch(() => new Audio(myAudio).play()); // décodage impossible : enregistrement brut
}
function stopRecording() { if (mediaRec?.state === 'recording') mediaRec.stop(); }
function showMyVoice() {
  const row = $('#fb .row');
  if (!row || !myAudio || $('#myVoice')) return;
  row.insertAdjacentHTML('afterbegin', '<button id="myVoice">▶️ Ma réponse</button><button id="atcVoice">🔊 Le contrôleur</button>');
  $('#myVoice').addEventListener('click', () => playMine());
  $('#atcVoice').addEventListener('click', () => say(cur.cut || cur.blocked ? cur.full.atc : cur.atc));
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
  const diff = diffWords(text, r.ans, cur.callsigns), late = lateBy();
  feedback(r.pass && !late, { said: text, diff, ans: r.ans, late,
    notes: [...diff.notes, ...(late ? [`collationnement trop tardif : ${late} s après la fin du message (au-delà de ${REACT_S} s)`] : [])] });
}
// Temps de réaction (Expert, Expert+, hors QCM et examen) : délai entre la fin du message du contrôleur et le début de
// votre réponse (première frappe ou appui sur le micro). Règle d'entraînement du site, pas une règle officielle ; même
// seuil que le rappel du contrôleur.
const REACT_S = 10;
function lateBy() {
  if (+val('niv') < 3 || session?.type === 'exam' || !cur.atc || cur.q || !cur.heardAt) return 0;
  const d = ((cur.startAt || Date.now()) - cur.heardAt) / 1000;
  return d > REACT_S ? Math.round(d) : 0;
}

const paint = (cs, cls) => cs.map(c => c.bad ? `<span class="${cls}">${esc(c.text)}</span>` : esc(c.text)).join(' ');

function feedback(good, { said = '', diff, notes = [], ans = cur.answers[0], nm = false, chosen = '', late = 0 } = {}) {
  answered = true;
  const counted = !cur.retry;
  if (counted) {
    if (!cur.notMine && !cur.cut && !cur.blocked && !cur.dictee && !cur.pilote && !cur.live) record(good); // ces cartes ne touchent pas la révision
    total++; if (good) { ok++; streak++; } else streak = 0;
    extra.best = Math.max(extra.best || 0, streak);
    if (!good && !cur.pilote) for (const k of classify(notes, said)) (extra.tally ||= {})[k] = (extra.tally[k] || 0) + 1; // pour le bilan
    const icao = cur.icao || terrain?.icao; // réussite par terrain réel
    if (icao) { const t = ((extra.terr ||= {})[icao] ||= [0, 0]); t[good ? 0 : 1]++; }
    // réussite par élément (écrit, oral) : chaque élément présent dans le collationnement attendu, oublié ou faux ?
    if (cur.atc && !cur.q && !cur.elements && !cur.notMine && !nm && !cur.pilote && !cur.dictee && modeNow() !== 'qcm') {
      const bad = good ? [] : classify(notes, said);
      for (const k of elemsOf(cur.answers[0])) { const e = ((extra.elem ||= {})[k] ||= [0, 0]); e[0]++; if (bad.includes(k)) e[1]++; }
    }
    extra.last = Date.now();
    tempoK = good ? tempoK + 1 : Math.max(0, tempoK - 2);
    if (!session && $('#adapt').checked) adaptMsg = adaptLevel(good) || adaptMsg;
    runLog.push({ q: pool[idx - 1], good, late });
    save();
  }
  if (session) session.log.push({ q: cur, good, chosen: chosen || said });
  if (session?.type === 'exam') return next(); // examen : correction seulement à la fin
  stats(); clearTimeout(recallT);
  // écrit / oral : comme à la radio, le contrôleur répond tout de suite « Négatif je répète » (SERA.14075 d)) ;
  // la correction détaillée vient après le 2e essai
  if (!good && !late && !cur.retry && !cur.notMine && !nm && !cur.cut && !cur.elements && !cur.dictee && !cur.pilote && cur.atc && !cur.q
    && modeNow() !== 'qcm') return retry(modeNow() === 'ecrit' ? said : '');
  $$('#card .msg.hidden').forEach(x => { x.classList.remove('hidden'); x.removeAttribute('aria-hidden'); });
  if ($('#go')) $('#go').disabled = true;
  if ($('#mic')) { $('#mic').disabled = true; $('#mic').classList.remove('on'); $('#mic').textContent = '🎤'; }
  let head = good ? '✅ Correct' : late ? `⏱ Trop tardif (${late} s)` : '❌ À revoir';
  if (cur.notMine) head = good ? `✅ Bien vu : ce message était pour ${cur.notMine}, on ne répond pas.`
    : `❌ Ce message était pour ${cur.notMine}, pas pour vous (${cur.shown}) : il ne fallait pas répondre.`;
  else if (nm) head = `❌ Ce message était pour vous (${cur.shown}) : il fallait répondre.`;
  if (cur.retry) head = `2e essai (non compté) : ${head}`;
  if (cur.pilote) head = good ? `✅ Bien vu : le collationnement était ${cur.answers[0] === 'Correct' ? 'correct' : 'faux'}.`
    : `❌ Le collationnement était ${cur.answers[0] === 'Correct' ? 'correct' : 'faux'}.`;
  const why = whyRules(cur.orig || cur), fiche = FICHES.find(f => f.id === why.fiche);
  $('#fb').innerHTML = `<div class="fb ${good ? 'ok' : 'ko'}">
    <p><strong>${esc(head)}</strong></p>
    ${notes.length ? `<ul class="notes">${notes.slice(0, 6).map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
    ${said ? `<p>${cur.pilote ? 'Le pilote a dit' : 'Votre réponse'} : <span class="said">${diff ? paint(diff.U, 'extra') : esc(said)}</span></p>` : ''}
    ${cur.notMine ? '' : `<p>${cur.pilote ? 'Collationnement attendu' : 'Réponse attendue'} : <strong>${diff ? paint(diff.E, 'miss') : esc(ans)}</strong></p>`}
    ${adaptMsg ? `<p class="adapt">${esc(adaptMsg)}</p>` : ''}
    <p class="src">📘 Source : ${esc(cur.notMine ? `${MANUEL(24)} (confusion d’indicatifs)` : cur.src)}</p>
    <details class="why"><summary>❓ Pourquoi ?</summary><ul>${why.regles.map(r => `<li>${esc(r.texte)} <span class="src">(${esc(r.src)})</span></li>`).join('')}</ul>
      ${fiche ? `<button class="ghost" data-fiche="${fiche.id}">📚 Fiche : ${esc(fiche.titre)}</button>` : ''}</details>
    <div class="row">
    <button class="primary" id="nx">Suivant →</button></div></div>`;
  adaptMsg = '';
  if (cur.cut || cur.blocked) pool.splice(idx, 0, cur.full); // le contrôleur répète : on collationne le message complet
  showMyVoice();
  $('#fb [data-fiche]')?.addEventListener('click', e => openFiche(e.target.dataset.fiche));
  $('#nx').addEventListener('click', next);
  $('#nx').focus();
}

// SERA.14075 d) : « NÉGATIF JE RÉPÈTE » suivi de la version correcte ; nouvel essai non compté.
// `said` : votre collationnement écrit, « transmis » avec votre voix de pilote avant la réponse du contrôleur.
function retry(said = '') {
  cur.retry = true; answered = false; cur.heardAt = cur.startAt = null; // le chrono repart après « négatif je répète »
  const en = cur.lang === 'en', body = cur.atc.replace(/^[^,]+,\s*/, '');
  const neg = `${cur.shown}, ${en ? 'negative I say again' : 'négatif je répète'}, ${body}`;
  const card = cur;
  play([...(said ? [{ text: said, lang: cur.lang, st: cur.st, pilot: true, cs: cur.shown }] : []), { text: neg, lang: cur.lang, st: cur.st }])
    .then(done => { if (done && card === cur) cur.heardAt = Date.now(); });
  $('#txt')?.addEventListener('input', () => { cur.startAt ??= Date.now(); }, { once: true });
  $('#fb').innerHTML = `<p class="muted">📻 ${en ? '« Negative I say again… »' : '« Négatif je répète… »'} : le contrôleur a relevé une erreur et répète
    la clairance. Collationnez à nouveau (essai non compté).</p>`;
  if ($('#txt')) { $('#txt').value = ''; $('#go').disabled = false; $('#txt').focus(); }
  if ($('#mic')) { $('#mic').disabled = false; $('#mic').classList.remove('on'); $('#mic').textContent = '🎤 Appuyer pour parler · ⎵ Espace'; }
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
  } else if (!session && pool.some(q => q.cat === 'nav' && q.live) && runLog.length) {
    // débriefing du vol : réussite par phase, collationnements tardifs, messages ratés à refaire
    const ph = { dep: 'Départ', cruise: 'Croisière', arr: 'Arrivée' }, by = {};
    for (const x of runLog) { const b = (by[x.q.phase] ||= [0, 0]); b[x.good ? 0 : 1]++; }
    const missed = runLog.filter(x => !x.good), late = runLog.filter(x => x.late).length, last = pool[pool.length - 1];
    title = 'DÉBRIEFING DU VOL';
    body = `<p class="ctx">🛬 ${esc(last.route || '')} : ${ok} / ${total} (${pct} %) ; temps de vol simulé ${last.clock || 0} min${late ? ` ; ${late} collationnement(s) tardif(s)` : ''}.</p>
      <table class="debrief">${Object.entries(ph).filter(([k]) => by[k]).map(([k, n]) => { const [o, b] = by[k];
        return `<tr><td>${n}</td><td><div class="meter"><div style="width:${Math.round(100 * o / (o + b))}%;background:${b ? '#d97706' : 'var(--ok)'}"></div></div></td><td class="num">${o} / ${o + b}</td></tr>`; }).join('')}</table>
      ${missed.length ? `<ol class="review">${missed.map(x => `<li><strong>${esc(x.q.atc || x.q.q)}</strong><br>Attendu : <strong>${esc(x.q.answers[0])}</strong></li>`).join('')}</ol>` : '<p class="ctx">Aucune erreur sur ce vol. Bravo !</p>'}`;
    if (missed.length) setTimeout(() => {
      $('#again').insertAdjacentHTML('afterend', '<button id="redo">🔁 Refaire les messages ratés</button>');
      $('#redo').addEventListener('click', () => { pool = missed.map(x => ({ ...x.q, retry: false, heardAt: null, startAt: null })); idx = ok = total = streak = 0; runLog = []; stats(); next(); });
    });
  } else if (/rare|refresh|prepa/.test(session?.type || '')) {
    title = { rare: 'SITUATIONS RARES', refresh: 'REMISE À NIVEAU', prepa: 'VOL DE DEMAIN' }[session.type];
    const ko = session.log.filter(x => !x.good);
    body = `<p class="ctx">${ok} / ${total} (${pct} %).</p>${ko.length ? `<ol class="review">${ko.map(x => `<li><strong>${esc(x.q.q || x.q.atc)}</strong><br>
      Attendu : <strong>${esc(x.q.answers[0])}</strong><br><span class="src">📘 ${esc(x.q.src)}</span></li>`).join('')}</ol>` : '<p class="ctx">Aucune erreur. Bravo !</p>'}`;
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
fetch('taf.json', { cache: 'no-store' }).then(r => (r.ok ? r.json() : [])).then(j => { TAF = Array.isArray(j) ? j : []; }).catch(() => {});
// mode hors ligne : application installable (sw.js)
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
fetch('traffic.json', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(j => { TRAFFIC = j; }).catch(() => {});
fetch('metar.json', { cache: 'no-store' }).then(r => (r.ok ? r.json() : [])).then(j => { METAR = j; if ($('#terrain').value) start(); }).catch(() => {});
$('#examBtn').addEventListener('click', () => {
  if (confirm(`Examen blanc : ${EXAM_N} questions en QCM, ${EXAM_MIN} minutes, réussite à ${EXAM_OK} %, correction à la fin. Commencer ?`)) start({ type: 'exam' });
});
$('#defiBtn').addEventListener('click', () => start({ type: 'defi' }));
$('#rareBtn').addEventListener('click', () => start({ type: 'rare' }));
$('#refreshBtn').addEventListener('click', () => start({ type: 'refresh' }));
// vol de demain : terrain, date et heure d'arrivée (UTC) ; METAR du moment pour la piste, TAF officielle pour l'heure prévue
$('#prepaT').insertAdjacentHTML('beforeend', TERRAINS.map(t => `<option value="${t.icao}">${t.nom} (${t.icao})</option>`).join(''));
$('#prepaBtn').addEventListener('click', () => {
  if ($('#terrain').value) $('#prepaT').value = $('#terrain').value;
  $('#prepaD').value = new Date(Date.now() + DAY).toISOString().slice(0, 10);
  $('#prepa').showModal();
});
$('#prepaGo').addEventListener('click', () => {
  const icao = $('#prepaT').value, at = Date.parse(`${$('#prepaD').value}T${$('#prepaH').value || '10:00'}:00Z`);
  $('#prepa').close(); $('#terrain').value = icao;
  if (!wxOf(icao)) return alert('METAR de ce terrain indisponible pour le moment : réessayez plus tard.');
  start({ type: 'prepa', icao, at: isNaN(at) ? Date.now() + DAY : at });
});
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
{ const gap = extra.last ? Math.floor((Date.now() - extra.last) / DAY) : 0;
  if (gap >= 21) { // remise à niveau proposée après 3 semaines sans s'entraîner (règle du site)
    $('#card').insertAdjacentHTML('beforebegin', `<p class="comeback" id="comeback">👋 Dernier entraînement il y a ${gap} jours.
      <button class="primary" id="comebackGo">🔁 Remise à niveau (10 min)</button></p>`);
    $('#comebackGo').addEventListener('click', () => { $('#comeback').remove(); start({ type: 'refresh' }); });
  } }
