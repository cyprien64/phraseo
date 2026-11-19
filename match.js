// Correction automatique des réponses écrites/orales : normalise le texte puis compare mot à mot.
const NUM = { zero: '0', one: '1', two: '2', three: '3', tree: '3', four: '4', fower: '4', five: '5', fife: '5',
  six: '6', seven: '7', eight: '8', nine: '9', niner: '9', unite: '1', un: '1', deux: '2', trois: '3', quatre: '4',
  cinq: '5', sept: '7', huit: '8', neuf: '9' };
const MULT = { hundred: 'H', cent: 'H', cents: 'H', thousand: 'K', tousand: 'K', mille: 'K' };
const LETTERS = { alfa: 'a', alpha: 'a', bravo: 'b', charlie: 'c', delta: 'd', echo: 'e', fox: 'f', foxtrot: 'f',
  golf: 'g', hotel: 'h', india: 'i', juliett: 'j', juliet: 'j', kilo: 'k', lima: 'l', mike: 'm', november: 'n',
  oscar: 'o', papa: 'p', quebec: 'q', romeo: 'r', sierra: 's', tango: 't', uniform: 'u', victor: 'v',
  whiskey: 'w', whisky: 'w', xray: 'x', yankee: 'y', zulu: 'z' };
// Alphabet d'épellation radiotéléphonique — SERA.14020, tableau S14-2.
const ICAO = { A: 'Alfa', B: 'Bravo', C: 'Charlie', D: 'Delta', E: 'Echo', F: 'Foxtrot', G: 'Golf', H: 'Hotel',
  I: 'India', J: 'Juliett', K: 'Kilo', L: 'Lima', M: 'Mike', N: 'November', O: 'Oscar', P: 'Papa', Q: 'Quebec',
  R: 'Romeo', S: 'Sierra', T: 'Tango', U: 'Uniform', V: 'Victor', W: 'Whiskey', X: 'X-ray', Y: 'Yankee', Z: 'Zulu' };
const spell = s => [...s].map(c => ICAO[c] || c).join(' ');

// Texte tel qu'il est prononcé à la radio : indicatifs et lettres isolées épelés en OACI.
function radio(t) {
  return t.replace(/\b([A-Z])-([A-Z]{2,4})\b/g, (_, a, b) => `${ICAO[a]} ${spell(b)}`)
    .replace(/\b(\d+)([A-Z])\b/g, (_, n, l) => `${n} ${ICAO[l]}`)
    .replace(/(^|[\s,(])([A-Z])(?=$|[\s,.)])/g, (_, b, l) => `${b}${ICAO[l]}`); // points et lettres isolés : « W D »
}

// Pour la synthèse vocale, selon le Manuel de phraséologie DSNA (10e éd.) p. 13-17 :
// - en français, les nombres peuvent se dire comme dans la vie courante ; « décimale » dans les fréquences ;
// - en anglais, chiffre par chiffre (« niner », SERA tableau S14-3), sauf centaines/milliers entiers
//   (« level one hundred », « squawk two thousand », « Q_N_H one thousand », « three thousand five hundred feet »)
//   et fréquences : les 5e et 6e chiffres ne sont pas énoncés s'ils sont nuls (118.100 = « decimal one »).
const DIG = 'zero one two three four five six seven eight niner'.split(' ');
function speakable(t, lang) {
  t = radio(t);
  if (lang === 'fr') return t.replace(/(\d+),(\d+)/g, '$1 décimale $2');
  const digits = s => [...String(s)].map(c => DIG[c]).join(' ');
  const round = n => { // multiples entiers de cent / mille ; sinon chiffre par chiffre
    if (n % 100) return digits(n);
    const th = Math.floor(n / 1000), h = n % 1000 / 100;
    return [th ? `${digits(th)} thousand` : '', h ? `${DIG[h]} hundred` : ''].filter(Boolean).join(' ');
  };
  return t
    .replace(/(\d+)\s*feet/g, (_, n) => `${round(+n)} feet`)
    .replace(/\b(level|speed|squawk|QNH) (\d+)/g, (_, w, n) => `${w} ${+n % 100 ? digits(n) : round(+n)}`)
    .replace(/(\d+)\.(\d+)/g, (_, a, b) => `${digits(a)} decimal ${digits(b.length === 3 && b.endsWith('00') ? b[0] : b)}`)
    .replace(/\d+/g, digits);
}

const ABBR ={ fl: 'flight level', ft: 'feet', kt: 'knots', kts: 'knots' };
const DROP = new Set(['decimal', 'virgule', 'and', 'et', 'the', 'le', 'la', 'les', 'to', 'de', 'du']);

const isNumTok = t => /^\d+$/.test(t) || t === 'H' || t === 'K';

function evalNum(g) {
  if (!g.includes('H') && !g.includes('K')) return g.join('');
  let total = 0, buf = '';
  for (const x of g) {
    if (x === 'K') { total += (+buf || 1) * 1000; buf = ''; }
    else if (x === 'H') { total += (+buf || 1) * 100; buf = ''; }
    else buf += x;
  }
  return String(total + (+buf || 0));
}

function normalize(s) {
  const toks = s.toLowerCase().replace(/\b(?:[dljmnst]|qu)['’]/g, '').replace(/œ/g, 'oe').normalize('NFD').replace(/[̀-ͯ]/g, '')
    // fréquences : 118.700 s'énonce « one one eight decimal seven » (Manuel p. 13) -> mêmes chiffres « 1187 »
    .replace(/(\d)[.,](\d)00(?!\d)/g, '$1$2').replace(/(\d)[.,](\d)/g, '$1$2').replace(/-/g, '')
    .replace(/([a-z])(\d)/g, '$1 $2').replace(/(\d)([a-z])/g, '$1 $2')
    .replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean)
    .flatMap(t => ABBR[t] ? ABBR[t].split(' ') : [t])
    .filter(t => !DROP.has(t))
    .map(t => NUM[t] || MULT[t] || LETTERS[t] || t);
  // regroupe les chiffres consécutifs ("1 0 1 3" -> "1013", "3 K 5 H" -> "3500")
  const nums = [];
  for (let i = 0; i < toks.length;) {
    if (!isNumTok(toks[i])) { nums.push(toks[i++]); continue; }
    const g = [];
    while (i < toks.length && isNumTok(toks[i])) g.push(toks[i++]);
    nums.push(evalNum(g));
  }
  // regroupe les lettres épelées ("f g b c d" -> "fgbcd")
  const out = [];
  let prevSingle = false;
  for (const t of nums) {
    const single = t.length === 1;
    if (single && prevSingle) out[out.length - 1] += t; else out.push(t);
    prevSingle = single;
  }
  return out;
}

function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

// Réussi si : indicatif présent, mêmes nombres et mots clés dans le même ordre, et ≥ 90 % de mots corrects.
// `callsign` : indicatif normalisé, ou liste des formes acceptées (complet et abrégé).
function check(user, answers, callsign = 'fgbcd') {
  const u = normalize(user), cs = [].concat(callsign).sort((a, b) => b.length - a.length);
  let best = null;
  for (const ans of answers) {
    const e = normalize(ans);
    // l'indicatif épelé peut être collé à une lettre voisine (« via Alfa, F-GBCD » -> "afgbcd")
    const has = a => a.some(t => cs.some(c => t.includes(c)));
    const strip = a => a.map(t => cs.reduce((x, c) => x.replace(c, ''), t)).filter(Boolean);
    const csOk = !has(e) || has(u);
    const ue = strip(u), ee = strip(e);
    // nombres, sens de virage et branches du circuit : la moindre erreur rend la réponse fausse
    const nums = a => a.filter(t => /^\d+$/.test(t)
      || /^(gauche|droite|left|right|base|arriere|downwind|final|finale|traversier|crosswind|haut|bas|above|below|monte|descends|climb|climbing|descend|descending|avant|before|apres|after|attends|wait|waiting|traverse|crossing|remonte|backtracking|numero|number|negatif|negative|affirme|affirm)$/.test(t)).join(',');
    const numbersOk = nums(ue) === nums(ee);
    const score = 1 - lev(ue, ee) / Math.max(ue.length, ee.length, 1);
    const r = { pass: csOk && numbersOk && score >= 0.9, score, numbersOk, csOk, ans };
    if (!best || r.pass > best.pass || (r.pass === best.pass && r.score > best.score)) best = r;
  }
  return best;
}

// Découpe en mots affichables ; les lettres/chiffres épelés un par un sont regroupés
// (« Foxtrot Golf Bravo Charlie Delta » = F-GBCD, « un zéro un trois » = 1013).
function chunks(s) {
  const out = [];
  for (const w of s.split(/\s+/).filter(Boolean)) {
    const key = normalize(w).join(''), last = out[out.length - 1];
    if (key.length === 1 && last?.single) { last.text += ' ' + w; last.key += key; }
    else out.push({ text: w, key, single: key.length === 1 });
  }
  return out;
}

// Correction mot à mot : marque `bad` sur les mots manquants/faux/en trop et produit des remarques lisibles.
function diffWords(user, expected, callsign = 'fgbcd') {
  const cs = [].concat(callsign);
  const E = chunks(expected), Uall = chunks(user), U = Uall.filter(c => c.key);
  const n = E.length, m = U.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = !E[i].key ? dp[i + 1][j] : E[i].key === U[j].key ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ops = [];
  for (let i = 0, j = 0; i < n || j < m;) {
    if (i < n && !E[i].key) ops.push({ t: '=', e: E[i++] });
    else if (i < n && j < m && E[i].key === U[j].key) ops.push({ t: '=', e: E[i++], u: U[j++] });
    else if (j < m && (i === n || dp[i][j + 1] >= dp[i + 1][j])) ops.push({ t: '+', u: U[j++] });
    else ops.push({ t: '-', e: E[i++] });
  }
  // un manquant suivi/précédé d'un en-trop au même endroit = une substitution (« 34 → 43 »)
  const out = [];
  for (let k = 0; k < ops.length;) {
    if (ops[k].t === '=') { out.push(ops[k++]); continue; }
    const minus = [], plus = [];
    while (k < ops.length && ops[k].t !== '=') (ops[k].t === '-' ? minus : plus).push(ops[k++]);
    const p = Math.min(minus.length, plus.length);
    for (let x = 0; x < p; x++) out.push({ t: '~', e: minus[x].e, u: plus[x].u });
    out.push(...minus.slice(p), ...plus.slice(p));
  }
  const clean = s => s.replace(/[,.;:!?]+$/, ''), notes = [];
  let prev = '', missing = [];
  const flush = () => { if (missing.length) notes.push(`${missing.join(' ')} oublié`); missing = []; };
  for (const o of out) {
    if (o.e && o.t !== '=') o.e.bad = true;
    if (o.u && o.t !== '=') o.u.bad = true;
    const label = o.e && /^\d+$/.test(o.e.key) && prev ? prev + ' ' : '';
    if (o.t === '-') {
      if (cs.some(c => o.e.key.includes(c))) { flush(); notes.push('indicatif oublié'); }
      else missing.push(missing.length ? clean(o.e.text) : label + clean(o.e.text));
    } else {
      flush();
      if (o.t === '~') notes.push(`${label}${clean(o.e.text)} → ${clean(o.u.text)}`);
      if (o.t === '+') notes.push(`« ${clean(o.u.text)} » en trop`);
    }
    if (o.e) prev = clean(o.e.text);
  }
  flush();
  return { E, U: Uall, notes };
}

if (typeof module !== 'undefined') module.exports = { normalize, check, radio, speakable, ICAO, diffWords };
