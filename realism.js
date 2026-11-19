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

// QCM piégeux : mauvaises réponses fabriquées à partir de la bonne (une seule petite erreur), à la place
// des choix trop faciles (« Roger », réponse tronquée). Chaque piège est revérifié : il doit être refusé.
const FLIP = { gauche: 'droite', droite: 'gauche', left: 'right', right: 'left', avant: 'après', before: 'after', montez: 'descendez' };
const KEYNUM = /\b(QNH|piste|runway|niveau|level|cap|heading|transpondeur|squawk|squawking|altitude)\s+\d+[,.]?\s*/i;
function trickyWrongs(q, shown, rnd = Math.random) {
  const a = q.answers[0], out = new Set();
  const swap = a.replace(/\b\d{2,4}\b/, n => { // inversion de deux chiffres voisins différents
    for (let i = 0; i < n.length - 1; i++) if (n[i] !== n[i + 1]) return n.slice(0, i) + n[i + 1] + n[i] + n.slice(i + 2);
    return n;
  });
  out.add(swap);
  out.add(a.replace(/\b(gauche|droite|left|right|avant|before)\b/i, w => {
    const f = FLIP[w.toLowerCase()]; return w[0] === w[0].toUpperCase() ? f[0].toUpperCase() + f.slice(1) : f;
  }));
  const drop = a.replace(KEYNUM, m => (m.includes(',') ? ', ' : '')).replace(/\s+,/g, ',').replace(/^,\s*/, '').replace(/,\s*,/g, ',');
  out.add(drop[0] ? drop[0].toUpperCase() + drop.slice(1) : drop); // élément oublié
  if (shown) out.add(a.split(shown).join(similarCallsign(shown, rnd))); // indicatif d'un autre avion
  const traps = [...out].filter(w => w !== a && !q.answers.includes(w) && !check(w, q.answers, q.callsigns).pass)
    .sort(() => rnd() - 0.5);
  const hard = q.wrong.filter(w => !/^(Roger|Reçu|Wilco)\b/i.test(w) && w.split(' ').length > 3 && !traps.includes(w));
  const wrong = [...traps, ...hard, ...q.wrong.filter(w => !traps.includes(w) && !hard.includes(w))].slice(0, 3);
  return wrong.length === 3 ? { ...q, wrong } : q;
}

// ATIS réel construit à partir du METAR, sur le modèle du manuel DSNA (p. 214-215) avec ses expressions
// (temps présent et nuages p. 217-218, « CAVOK » p. 11, rafales p. 154). Renvoie null si le METAR contient un
// élément que le manuel ne permet pas de formuler (vent variable, RVR, phénomène non listé…) : on n'invente rien.
// Les tendances TEMPO / BECMG ne sont pas reprises (le manuel ne donne que « Tendance NOSIG »).
const ATIS_WX = { RA: ['pluie', 'rain'], '+RA': ['pluie forte', 'heavy rain'], SHRA: ['averse de pluie', 'rain shower'],
  BR: ['brume', 'mist'], FG: ['brouillard', 'fog'], BCFG: ['brouillard par bancs', 'fog patches'], MIFG: ['brouillard mince', 'shallow fog'],
  FZFG: ['brouillard givrant', 'freezing fog'], DZ: ['bruine', 'drizzle'], FZDZ: ['bruine givrante', 'freezing drizzle'],
  FZRA: ['pluie se congelant', 'freezing rain'], SN: ['neige', 'snow'], '+SN': ['neige forte', 'heavy snow'], TS: ['orage', 'thunderstorm'],
  GR: ['grêle', 'hail'], GS: ['grésil', 'light hail'], FU: ['fumée', 'smoke'], SQ: ['grain', 'squall'] };
const ATIS_CLD = { FEW: ['peu', 'few'], SCT: ['épars', 'scattered'], BKN: ['fragmenté', 'broken'], OVC: ['couvert', 'overcast'] };
const ATIS_TYPE = { CB: ['cumulonimbus', 'cumulonimbus'], TCU: ['cumulonimbus bourgeonnant', 'towering cumulus'] };
function parseMetar(raw) {
  const tk = raw.trim().split(/\s+/), m = { wx: [], clouds: [] };
  for (const t of tk.slice(2)) {
    let r;
    if (/^(TEMPO|BECMG|RMK)$/.test(t)) break;
    if (t === 'AUTO' || t === 'COR' || /^\d{3}V\d{3}$/.test(t) || /^(NSC|NCD|SKC)$/.test(t)) continue;
    if ((r = t.match(/^(\d{2})(\d{4})Z$/))) m.time = r[2], m.day = +r[1];
    else if ((r = t.match(/^(\d{3}|VRB)(\d{2})(?:G(\d{2}))?KT$/))) {
      if (r[1] === 'VRB' && +r[2] > 0) return null;
      m.wind = +r[2] === 0 ? { calm: true } : { dir: r[1], spd: +r[2], gust: r[3] && +r[3] };
    } else if (t === 'CAVOK') m.cavok = true;
    else if (/^\d{4}$/.test(t)) m.vis = +t;
    else if ((r = t.match(/^(FEW|SCT|BKN|OVC)(\d{3})(CB|TCU)?$/))) m.clouds.push({ c: r[1], h: +r[2] * 100, type: r[3] });
    else if ((r = t.match(/^(M?\d{2})\/(M?\d{2})$/))) m.temp = r[1], m.dew = r[2];
    else if ((r = t.match(/^Q(\d{4})$/))) m.qnh = String(+r[1]); // 0998 → 998
    else if (t === 'NOSIG') m.nosig = true;
    else if (ATIS_WX[t.replace(/^-/, '')]) m.wx.push(t.replace(/^-/, '')); // « faible » n'a pas de formulation : phénomène seul
    else return null; // élément inconnu : pas d'ATIS
  }
  return m.time && m.wind && m.temp && m.qnh && (m.cavok || m.vis) ? m : null;
}
function atisFromMetar(raw, t, piste, lang) {
  const m = parseMetar(raw);
  if (!m) return null;
  const en = lang === 'en', k = en ? 1 : 0, L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[(m.day * 24 + +m.time.slice(0, 2)) % 26];
  const letter = { A: 'Alfa', B: 'Bravo', C: 'Charlie', D: 'Delta', E: 'Echo', F: 'Foxtrot', G: 'Golf', H: 'Hotel', I: 'India', J: 'Juliett',
    K: 'Kilo', L: 'Lima', M: 'Mike', N: 'November', O: 'Oscar', P: 'Papa', Q: 'Quebec', R: 'Romeo', S: 'Sierra', T: 'Tango', U: 'Uniform',
    V: 'Victor', W: 'Whiskey', X: 'X-ray', Y: 'Yankee', Z: 'Zulu' }[L];
  const deg = (t, dew) => (t[0] === 'M' ? (en ? 'minus ' : 'moins ') : '') + (en && dew ? t.replace('M', '') : String(+t.replace('M', '')));
  const w = m.wind;
  const wind = w.calm ? (en ? 'Wind calm' : 'Vent calme')
    : `${en ? 'Wind' : 'Vent'} ${w.dir} ${en ? 'degrees' : 'degrés'} ${w.spd} ${en ? 'knots' : 'nœuds'}${w.gust ? `, ${en ? 'gusting' : 'rafales'} ${w.gust} ${en ? 'knots' : 'nœuds'}` : ''}`;
  const vis = m.vis >= 9999 ? 10000 : m.vis;
  const visTxt = vis >= 5000 ? `${Math.floor(vis / 1000)} ${en ? 'kilometres' : 'kilomètres'}` : `${vis} ${en ? 'metres' : 'mètres'}`;
  const hh = +m.time.slice(0, 2), hello = en ? (hh < 12 ? 'Good morning' : hh < 18 ? 'Good afternoon' : 'Good evening') : hh < 18 ? 'Bonjour' : 'Bonsoir';
  const parts = [en ? `${hello}, this is ${t.radio} information ${letter}, recorded at ${m.time} UTC`
    : `${hello}, ici ${t.radio} information ${letter}, enregistrée à ${m.time} UTC`,
  `${en ? 'Runway in use' : 'Piste en service'} ${piste}`, wind];
  if (m.cavok) parts.push('CAVOK');
  else {
    parts.push(`${en ? 'Visibility' : 'Visibilité'} ${visTxt}`);
    if (m.wx.length) parts.push(m.wx.map(x => ATIS_WX[x][k]).join(', ').replace(/^./, c => c.toUpperCase()));
    if (m.clouds.length) parts.push(`${en ? 'Clouds' : 'Nuages'} ${m.clouds.map(c => `${ATIS_CLD[c.c][k]} ${c.h} ${en ? 'feet' : 'pieds'}${c.type ? ' ' + ATIS_TYPE[c.type][k] : ''}`).join(', ')}`);
  }
  parts.push(`${en ? 'Temperature' : 'Température'} ${deg(m.temp)}, ${en ? 'dew point' : 'point de rosée'} ${deg(m.dew, true)}`, `QNH ${m.qnh}`);
  if (m.nosig) parts.push(en ? 'Trend NOSIG' : 'Tendance NOSIG');
  parts.push(en ? `Inform ${t.radio} on initial contact you have received information ${letter}`
    : `Informez ${t.radio} dès le premier contact que vous avez reçu l'information ${letter}`);
  return { text: parts.join('. ') + '.', letter, piste, qnh: m.qnh, wind: w.calm ? null : `${w.dir} ${en ? 'degrees' : 'degrés'} ${w.spd} ${en ? 'knots' : 'nœuds'}` };
}

if (typeof module !== 'undefined') module.exports = { newCallsign, abbrev, similarCallsign, permMap, vary, cutMessage, gradeElements, csKey, bestRunway, realTerrain, trickyWrongs, atisFromMetar };
