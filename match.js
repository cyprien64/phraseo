// Correction automatique des réponses écrites/orales : normalise le texte puis compare mot à mot.
const NUM = { zero: '0', one: '1', two: '2', three: '3', tree: '3', four: '4', fower: '4', five: '5', fife: '5',
  six: '6', seven: '7', eight: '8', nine: '9', niner: '9', unite: '1', un: '1', deux: '2', trois: '3', quatre: '4',
  cinq: '5', sept: '7', huit: '8', neuf: '9' };
const MULT = { hundred: 'H', cent: 'H', cents: 'H', thousand: 'K', tousand: 'K', mille: 'K' };
const LETTERS = { alfa: 'a', alpha: 'a', bravo: 'b', charlie: 'c', delta: 'd', echo: 'e', fox: 'f', foxtrot: 'f',
  golf: 'g', hotel: 'h', india: 'i', juliett: 'j', juliet: 'j', kilo: 'k', lima: 'l', mike: 'm', november: 'n',
  oscar: 'o', papa: 'p', quebec: 'q', romeo: 'r', sierra: 's', tango: 't', uniform: 'u', victor: 'v',
  whiskey: 'w', whisky: 'w', xray: 'x', yankee: 'y', zulu: 'z' };
// Alphabet d'épellation OACI (Annexe 10, Vol. II) — orthographe officielle.
const ICAO = { A: 'Alfa', B: 'Bravo', C: 'Charlie', D: 'Delta', E: 'Echo', F: 'Foxtrot', G: 'Golf', H: 'Hotel',
  I: 'India', J: 'Juliett', K: 'Kilo', L: 'Lima', M: 'Mike', N: 'November', O: 'Oscar', P: 'Papa', Q: 'Quebec',
  R: 'Romeo', S: 'Sierra', T: 'Tango', U: 'Uniform', V: 'Victor', W: 'Whiskey', X: 'X-ray', Y: 'Yankee', Z: 'Zulu' };
const spell = s => [...s].map(c => ICAO[c] || c).join(' ');

// Texte tel qu'il est prononcé à la radio : indicatifs et lettres isolées épelés en OACI.
function radio(t) {
  return t.replace(/\b([A-Z])-([A-Z]{2,4})\b/g, (_, a, b) => `${ICAO[a]} ${spell(b)}`)
    .replace(/\b(\d+)([A-Z])\b/g, (_, n, l) => `${n} ${ICAO[l]}`);
}

// Pour la synthèse vocale : chiffres un par un (« niner »), milliers pour les altitudes, « décimal » pour les fréquences.
const DIG = { en: 'zero one two three four five six seven eight niner'.split(' '),
  fr: 'zéro un deux trois quatre cinq six sept huit neuf'.split(' ') };
function speakable(t, lang) {
  const d = DIG[lang], digits = s => [...s].map(c => d[c]).join(' ');
  const alt = n => {
    const th = Math.floor(n / 1000), h = Math.floor(n % 1000 / 100), w = [];
    if (th) w.push(lang === 'en' ? `${digits(String(th))} thousand` : (th > 1 ? `${digits(String(th))} mille` : 'mille'));
    if (h) w.push(lang === 'en' ? `${d[h]} hundred` : (h > 1 ? `${d[h]} cents` : 'cent'));
    return w.join(' ') || digits(String(n));
  };
  return radio(t)
    .replace(/(\d+)\s*(feet|pieds)/g, (_, n, u) => `${alt(+n)} ${u}`)
    .replace(/(\d+)[.,](\d+)/g, (_, a, b) => `${digits(a)} ${lang === 'en' ? 'decimal' : 'décimal'} ${digits(b)}`)
    .replace(/\d+/g, digits);
}

const ABBR ={ fl: 'flight level', ft: 'feet', kt: 'knots', kts: 'knots' };
const DROP = new Set(['decimal', 'virgule', 'and', 'et', 'the', 'le', 'la', 'les', 'to', 'de', 'du', 'd', 'l']);

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
  const toks = s.toLowerCase().replace(/œ/g, 'oe').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/(\d)[.,](\d)/g, '$1$2').replace(/-/g, '')
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

// Réussi si : indicatif présent, mêmes nombres dans le même ordre, et ≥ 85 % de mots corrects.
function check(user, answers, callsign = 'fgbcd') {
  const u = normalize(user);
  let best = null;
  for (const ans of answers) {
    const e = normalize(ans);
    // l'indicatif épelé peut être collé à une lettre voisine (« via Alfa, F-GBCD » -> "afgbcd")
    const has = a => a.some(t => t.includes(callsign)), strip = a => a.map(t => t.replace(callsign, '')).filter(Boolean);
    const csOk = !has(e) || has(u);
    const ue = strip(u), ee = strip(e);
    const nums = a => a.filter(t => /^\d+$/.test(t)).join(',');
    const numbersOk = nums(ue) === nums(ee);
    const score = 1 - lev(ue, ee) / Math.max(ue.length, ee.length, 1);
    const r = { pass: csOk && numbersOk && score >= 0.85, score, numbersOk, csOk };
    if (!best || r.pass > best.pass || (r.pass === best.pass && r.score > best.score)) best = r;
  }
  return best;
}

if (typeof module !== 'undefined') module.exports = { normalize, check, radio, speakable, ICAO };
