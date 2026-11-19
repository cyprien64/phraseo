// Étape 3 – réalisme : valeurs aléatoires, indicatif abrégé, fréquence encombrée, coupures radio, premier appel libre.
// Fonctions pures (testées dans test.js) ; l'interface est dans app.js.
const BASE_CS = 'F-GBCD';
const LETTERS_AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const csKey = cs => cs.replace(/-/g, '').toLowerCase();

// Immatriculation française fictive F-Gxxx.
function newCallsign(rnd = Math.random) {
  let cs;
  do cs = 'F-G' + [0, 1, 2].map(() => LETTERS_AZ[Math.floor(rnd() * 26)]).join(''); while (cs === BASE_CS);
  return cs;
}
// Indicatif abrégé type a) : premier caractère + deux derniers (Manuel DSNA p. 18 ; SERA.14055).
const abbrev = cs => `${cs[0]}-${cs.slice(-2)}`;
// Indicatif proche (risque de confusion, Manuel p. 24) : seule la dernière lettre change.
function similarCallsign(cs, rnd = Math.random) {
  let l;
  do l = LETTERS_AZ[Math.floor(rnd() * 26)]; while (l === cs.slice(-1));
  return cs.slice(0, -1) + l;
}

// Transforme `d` comme `base` a été transformé en `nu` (mêmes chiffres permutés) : la mauvaise réponse
// « piste 42 » pour « piste 24 » reste l'inversion de la nouvelle piste.
function permMap(base, nu) {
  const distinct = new Set(base).size === base.length;
  return d => {
    if (d === base) return nu;
    if (!distinct || d.length !== base.length || [...d].sort().join() !== [...base].sort().join()) return d;
    return [...d].map(c => nu[base.indexOf(c)]).join('');
  };
}

const RW_RE = /\b(piste|runway|bay|attente|service|use)(\s+)(\d{2})\b/gi;
const SQ_RE = /\b(transpondeur|squawk|squawking)(\s+)(\d{4})\b/gi;
const SPECIAL_SQ = /^(7500|7600|7700|7000|2000)$/;

// Copie de l'exercice avec un autre indicatif, une autre piste et un autre code transpondeur.
// `shown` = indicatif utilisé dans le message (complet ou abrégé). Si une mauvaise réponse devenait
// identique à la bonne, seule la substitution d'indicatif est gardée.
// `memo` : valeurs déjà tirées pour la série (même piste et même code pendant tout le vol).
function vary(q, { cs, shown = cs, values = true, rnd = Math.random, memo = {} }) {
  const all = [q.atc, ...q.answers].join(' ');
  const rw = [...all.matchAll(RW_RE)][0]?.[3], sq = [...all.matchAll(SQ_RE)][0]?.[3];
  let mapRw = d => d, mapSq = d => d;
  if (values && rw && rw[0] !== rw[1]) {
    let n = memo['rw' + rw];
    if (!n) do n = String(1 + Math.floor(rnd() * 36)).padStart(2, '0'); while (n[0] === n[1] || n === rw);
    mapRw = permMap(rw, memo['rw' + rw] = n);
  }
  if (values && sq && !SPECIAL_SQ.test(sq) && new Set(sq).size === 4) {
    let n = memo['sq' + sq];
    if (!n) do n = [0, 1, 2, 3].map(() => Math.floor(rnd() * 8)).join(''); while (new Set(n).size < 4 || n === sq);
    mapSq = permMap(sq, memo['sq' + sq] = n);
  }
  // le vent tourne avec la piste : même écart angulaire qu'à l'origine (sinon vent arrière)
  const turn = rw && mapRw(rw) !== rw ? (+mapRw(rw) - +rw) * 10 : 0;
  const wind = d => String(((+d + turn) % 360 + 360) % 360 || 360).padStart(3, '0');
  const sub = (s = '', csText) => s.replace(/F-GBCD/g, csText)
    .replace(/\b(\d{3})( degrés| degrees)/g, (_, d, u) => wind(d) + u)
    .replace(RW_RE, (_, a, sp, d) => a + sp + mapRw(d))
    .replace(SQ_RE, (_, a, sp, d) => a + sp + mapSq(d))
    .replace(/^\d{2}$/, mapRw).replace(/^\d{4}$/, mapSq); // réponses ATIS isolées (« 24 »)
  const out = { ...q, ctx: sub(q.ctx, cs), atc: sub(q.atc, shown), answers: q.answers.map(a => sub(a, shown)), wrong: q.wrong.map(w => sub(w, shown)),
    callsigns: [csKey(cs), csKey(shown)] };
  if (out.wrong.includes(out.answers[0])) return values ? vary(q, { cs, shown, values: false, rnd, memo }) : out;
  return out;
}

// Coupure radio : on garde le début du message (au moins 3 mots après l'indicatif) et on coupe le reste.
// La bonne réponse est « RÉPÉTEZ TOUT APRÈS [dernier mot reçu] » (SERA.14075 c) 4)).
const STOP = /^(le|la|les|de|du|des|un|une|et|à|a|au|en|the|to|and|of|on|for|via|then|puis|cause|due|vous|je|you)$/i;
function cutMessage(atc, rnd = Math.random) {
  const words = atc.split(' ');
  // positions possibles : au moins 3 mots après l'indicatif, au moins 2 mots coupés, dernier mot reçu significatif
  const spots = [];
  for (let at = 4; at <= words.length - 2; at++) {
    const w = words[at - 1].replace(/[,.;:]$/, '');
    if (!STOP.test(w) && (w.length > 2 || /^\d+$/.test(w))) spots.push(at);
  }
  if (!spots.length) return null;
  const at = spots[Math.floor(rnd() * spots.length)];
  return { heard: words.slice(0, at).join(' '), word: words[at - 1].replace(/[,.;:]$/, '') };
}

// Premier appel libre : vérifie la présence et l'ordre des éléments obligatoires.
// `elements` = [[libellé, regex sur le texte normalisé | 'CS']].
function gradeElements(text, elements, callsigns) {
  const s = normalize(text).join(' ');
  const found = elements.map(([label, re]) => {
    const r = re === 'CS' ? new RegExp(callsigns.join('|')) : new RegExp(re);
    return { label, at: s.search(r) };
  });
  const notes = found.filter(f => f.at < 0).map(f => `${f.label} manquant`);
  const present = found.filter(f => f.at >= 0);
  for (let i = 1; i < present.length; i++)
    if (present[i].at < present[i - 1].at) notes.push(`ordre : « ${present[i].label} » doit venir après « ${present[i - 1].label} »`);
  return { pass: !notes.length, notes };
}

// Terrain réel : piste la plus face au vent du METAR (première piste si vent variable ou inconnu).
function bestRunway(pistes, wdir) {
  if (typeof wdir !== 'number') return pistes[0];
  const off = p => { const d = Math.abs(+p * 10 - wdir) % 360; return Math.min(d, 360 - d); };
  return pistes.reduce((a, b) => (off(b) < off(a) ? b : a));
}
// Après vary (la piste mémorisée est déjà la piste réelle) : nom du terrain, fréquence de la Tour ou du Sol,
// vent et QNH du METAR (`wx` = { wdir, wspd, qnh } ou null). Ni l'AFIS ni l'ATIS (fictifs) ne changent ;
// le terrain d'arrivée de la navigation (`dest`) garde sa météo.
function realTerrain(q, t, wx) {
  if (!t || /^(afis|atis)$/.test(q.cat || '')) return q;
  const en = q.lang === 'en', fq = f => (en ? f.replace(',', '.') : f);
  const name = s => s.replace(/Saint-Exémery(?= (Tour|Tower|Sol|Ground))/g, t.radio).replace(/Saint-Exémery/g, t.nom);
  let wind = s => s, qnh = s => s;
  if (wx && !q.dest) {
    if (typeof wx.wdir === 'number' || wx.wspd === 0) { // vent variable : on garde le vent de l'exercice
      const w = wx.wspd === 0 ? null : String(wx.wdir || 360).padStart(3, '0');
      wind = s => s.replace(/\bvent \d{3} degrés \d+ nœuds/g, w ? `vent ${w} degrés ${wx.wspd} nœuds` : 'vent calme')
        .replace(/\bwind \d{3} degrees \d+ knots/g, w ? `wind ${w} degrees ${wx.wspd} knots` : 'wind calm');
    }
    const orig = (`${q.atc} ${q.answers[0]}`.match(/QNH (\d{3,4})/) || [])[1];
    if (orig && wx.qnh) {
      const m = permMap(orig, String(wx.qnh));
      const sub = s => s.replace(/QNH (\d{3,4})/g, (_, d) => `QNH ${m(d)}`);
      if (!q.wrong.map(sub).includes(sub(q.answers[0]))) qnh = sub; // sinon une mauvaise réponse deviendrait juste
    }
  }
  const f = s => qnh(wind(name(s)));
  const st = (q.st || '').replace(/^(Tour|Tower) 118[,.]700$/, (_, x) => `${t.radio} ${x} ${fq(t.tour)}`)
    .replace(/^(Sol|Ground) 121[,.]800$/, (_, x) => `${t.radio} ${x} ${fq(t.sol)}`);
  return { ...q, st, ctx: f(q.ctx || ''), atc: f(q.atc), answers: q.answers.map(f), wrong: q.wrong.map(f) };
}

if (typeof module !== 'undefined') module.exports = { newCallsign, abbrev, similarCallsign, permMap, vary, cutMessage, gradeElements, csKey, bestRunway, realTerrain };
