// Auto-test de la correction : `node test.js`
const assert = require('assert');
const { normalize, check, ICAO } = require('./match.js');

const exp = ["Descending altitude 3000 feet QNH 1013, F-GBCD"];
assert(check("Descending altitude 3000 feet QNH 1013, F-GBCD", exp).pass);
assert(check("Foxtrot Golf Bravo Charlie Delta descending altitude three thousand feet QNH one zero one three", exp).pass);
assert(!check("Descending altitude 3000 feet QNH 1012, F-GBCD", exp).pass, 'mauvais QNH');
assert(!check("Descending altitude 3000 feet QNH 1013", exp).pass, 'indicatif manquant');
assert(check("Je roule point d'attente piste deux quatre via alpha F-GBCD", ["Je roule point d'attente piste 24 via Alfa, F-GBCD"]).pass);
assert(!check("Reçu F-GBCD", exp).pass);
assert.deepStrictEqual(normalize('three thousand five hundred feet'), ['3500', 'feet']);
assert.deepStrictEqual(normalize('FL100'), normalize('flight level one zero zero'));
assert(check('Contact Approach one one niner decimal two five, F-GBCD', ['Approach 119.25, F-GBCD']).pass === false); // mot en trop sur une réponse courte : refusé
assert(check('Approach one one niner decimal two five, F-GBCD', ['Approach 119.25, F-GBCD']).pass);


// Chaque réponse de référence doit passer, chaque mauvaise réponse du QCM doit échouer.
const fs = require('fs');
const [QUESTIONS, TERRAINS] = eval(['data.js', 'data-plus.js', 'data-lot2.js', 'data-lot3.js'].map(f => fs.readFileSync(__dirname + '/' + f, 'utf8')).join('\n') + ';[QUESTIONS, TERRAINS]');
for (const q of QUESTIONS.filter(q => !q.qcmOnly)) {
  q.answers.forEach(a => assert(check(a, q.answers).pass, 'référence refusée : ' + a));
  q.wrong.forEach(w => assert(!check(w, q.answers).pass, 'mauvaise réponse acceptée : ' + w));
}
console.log(QUESTIONS.length, 'exercices vérifiés');

const { radio, speakable } = require('./match.js');
assert.strictEqual(radio('F-GBCD, départ BALSI 6P'), 'Foxtrot Golf Bravo Charlie Delta, départ BALSI 6 Papa');
// exemples du Manuel DSNA p. 15-16
assert.strictEqual(speakable('QNH 1009, 3500 feet', 'en'), 'QNH one zero zero niner, three thousand five hundred feet');
assert.strictEqual(speakable('level 100, level 80, squawk 2000, QNH 1000', 'en'), 'level one hundred, level eight zero, squawk two thousand, QNH one thousand');
assert.strictEqual(speakable('Tower 118.100, Approach 118.050', 'en'), 'Tower one one eight decimal one, Approach one one eight decimal zero five zero');
assert.strictEqual(speakable('speed 200 knots, speed 250 knots', 'en'), 'speed two hundred knots, speed two five zero knots');
assert.strictEqual(speakable('Info 125,7', 'fr'), 'Info 125 décimale 7');
assert(check(radio('Roulons via Alfa, F-GBCD'), ['Roulons via Alfa, F-GBCD']).pass);
assert.strictEqual(radio('rappelez avant W D, puis E N.'), 'rappelez avant Whiskey Delta, puis Echo November.');
assert.deepStrictEqual(normalize("d'attente l'ILS j'atterris"), ['attente', 'ils', 'atterris']);
console.log('voix OK');

const { diffWords } = require('./match.js');
const ref = "Je descends altitude 3000 pieds QNH 1009, piste 32, F-GBCD";
assert.deepStrictEqual(diffWords("Je descends altitude 3000 pieds, piste 23, F-GBCD", ref).notes, ['QNH 1009 oublié', 'piste 32 → 23']);
assert.deepStrictEqual(diffWords("je descends altitude 3000 pieds QNH 1009 piste 32", ref).notes, ['indicatif oublié']);
assert.deepStrictEqual(diffWords(ref, ref).notes, []);
console.log('diff OK');

// ── Réalisme : chaque exercice reste juste après tirage aléatoire (indicatif complet ou abrégé) ──
global.normalize = normalize; global.check = check;
const R = require('./realism.js');
let seed = 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
for (let k = 0; k < 20; k++) for (const q of QUESTIONS.filter(q => q.regle !== 'alpha' && !q.qcmOnly && !q.elements)) {
  const cs = R.newCallsign(rnd), v = R.vary(q, { cs, shown: k % 2 ? R.abbrev(cs) : cs, rnd });
  v.answers.forEach(a => assert(check(a, v.answers, v.callsigns).pass, 'référence variée refusée : ' + a));
  v.wrong.forEach(w => assert(!check(w, v.answers, v.callsigns).pass, 'mauvaise réponse variée acceptée : ' + w + ' / ' + v.answers[0]));
  assert(!v.wrong.includes(v.answers[0]));
}
const v1 = R.vary({ atc: 'F-GBCD, roulez point d\'attente piste 24.', answers: ["Je roule point d'attente piste 24, F-GBCD"], wrong: ["Je roule point d'attente piste 42, F-GBCD"] },
  { cs: 'F-GXYZ', shown: 'F-YZ', rnd: () => 0.5 });
assert.strictEqual(v1.atc, "F-YZ, roulez point d'attente piste 91.".replace('91', v1.atc.match(/piste (\d\d)/)[1]));
assert.strictEqual(v1.wrong[0].match(/piste (\d\d)/)[1], [...v1.atc.match(/piste (\d\d)/)[1]].reverse().join(''), 'la mauvaise piste reste l’inversion');
assert(check("Je roule point d'attente piste " + v1.atc.match(/piste (\d\d)/)[1] + ', F-GXYZ', v1.answers, v1.callsigns).pass, 'indicatif complet accepté si abrégé');
assert.strictEqual(R.abbrev('F-GBCD'), 'F-CD');
assert.strictEqual(R.cutMessage('F-GBCD, roulez', rnd), null);
const cut = R.cutMessage("F-GBCD, roulez point d'attente piste 24 via Alfa.", () => 0);
assert.deepStrictEqual(cut, { heard: "F-GBCD, roulez point d'attente", word: "d'attente" });
const el = QUESTIONS.find(q => q.elements && q.lang === 'fr' && /Guéret, information Bravo/.test(q.answers[0]));
assert(R.gradeElements(el.answers[0], el.elements, ['fgbcd']).pass);
assert(R.gradeElements('Fox golf bravo charlie delta, DR 400, parking club, demande consignes de roulage pour Guéret, information bravo', el.elements, ['fgbcd']).pass);
assert.deepStrictEqual(R.gradeElements('F-GBCD, information Bravo, DR400, parking club, demande roulage pour Guéret', el.elements, ['fgbcd']).notes,
  ['ordre : « information ATIS » doit venir après « destination »']);
assert.deepStrictEqual(R.gradeElements('F-GBCD, DR400, demande roulage', el.elements, ['fgbcd']).notes, ['position manquant', 'destination manquant', 'information ATIS manquant']);
QUESTIONS.filter(q => q.elements).forEach(q => assert(R.gradeElements(q.answers[0], q.elements, ['fgbcd']).pass, 'premier appel de référence refusé : ' + q.answers[0]));
assert(check('Tower, F-GBCD, radio check one one eight decimal seven', ['Tower, F-GBCD, radio check 118.700']).pass);
console.log('réalisme OK');
assert(!/piste 24|runway 24/.test(R.vary(QUESTIONS.find(q => q.ctx === 'En finale piste 24.'), { cs: 'F-GXYZ', rnd: () => 0.5 }).ctx), 'situation variée');console.log('ctx OK');
{ const w = R.vary(QUESTIONS.find(q => q.ctx === 'Aligné piste 24.'), { cs: 'F-GXYZ', memo: { rw24: '13' } }); assert.strictEqual(w.atc, 'F-GXYZ, piste 13, autorisé décollage, vent 150 degrés 8 nœuds.'); console.log('vent OK'); }

// ── Apprentissage ──
global.MANUEL = p => `Manuel p. ${p}`; global.SERA = a => `SERA ${a}`; global.AFIS = p => `AFIS p. ${p}`;
const L = require('./learn.js');
let p = L.leitner(undefined, true, 0); assert.deepStrictEqual(p, [1, 0, 1, 1, L.DAY]);
p = L.leitner(p, true, 0); assert.strictEqual(p[3], 2); assert.strictEqual(p[4], 3 * L.DAY);
p = L.leitner(p, false, 5); assert.deepStrictEqual(p.slice(1), [1, 0, 0, 5]);
assert(L.isDueP([1, 0, 1], 10), 'ancienne progression = à revoir'); assert(!L.isDueP([1, 0, 1, 1, 100], 10));
const d1 = L.dailyPick(QUESTIONS, '2026-11-19').map(q => q.q || q.atc), d2 = L.dailyPick(QUESTIONS, '2026-11-19').map(q => q.q || q.atc);
assert.deepStrictEqual(d1, d2, 'défi identique pour tous'); assert.notDeepStrictEqual(d1, L.dailyPick(QUESTIONS, '2026-11-20').map(q => q.q || q.atc));
assert.deepStrictEqual(L.classify(['QNH 1009 oublié', 'piste 32 → 23', 'indicatif oublié', 'roulons → roule'], 'Roger'), ['roger', 'qnh', 'piste', 'indicatif', 'forme']);
assert.strictEqual(L.bilan({}, 10).reste, 40);
assert.deepStrictEqual(L.bilan({ qnh: 5, piste: 2, indicatif: 7, cap: 1 }, 60).top.map(t => t.n), [7, 5, 2]);
QUESTIONS.forEach(q => { const w = L.whyRules(q); assert(w.regles.length > 0); });
assert(L.whyRules(QUESTIONS.find(q => q.ctx === 'Aligné piste 24.')).regles.some(r => /SERA.8015/.test(r.src)));
assert.strictEqual(L.badges(QUESTIONS, {}, {}).length, 10);
console.log('apprentissage OK');
assert.strictEqual(L.bilan({ qnh: 3 }, 60).top[0].key, 'qnh');
assert(L.cible(QUESTIONS, 'qnh').length >= 4 && L.cible(QUESTIONS, 'qnh').every(q => /QNH/.test(q.atc + q.answers[0])));
assert(L.cible(QUESTIONS, 'indicatif').length > 50);
console.log('ciblé OK');

// ── Lot 3 : terrains réels, météo réelle, navigation, parcours ──
assert.strictEqual(R.bestRunway(['13', '31'], 240), '31'); assert.strictEqual(R.bestRunway(['13', '31'], 'VRB'), '13');
assert.strictEqual(R.bestRunway(['02', '20'], 10), '02'); assert.strictEqual(R.bestRunway(['09', '27'], 350), '27');
const pau = TERRAINS.find(t => t.icao === 'LFBP');
{ const q = QUESTIONS.find(q => q.ctx === 'Aligné piste 24.' && !q.cat);
  const w = R.realTerrain(R.vary(q, { cs: 'F-GXYZ', memo: { rw24: '31' } }), pau, { wdir: 240, wspd: 10, qnh: 1009 });
  assert.strictEqual(w.atc, 'F-GXYZ, piste 31, autorisé décollage, vent 240 degrés 10 nœuds.'); assert.strictEqual(w.st, 'Pau Tour 124,155');
  assert.strictEqual(R.realTerrain(q, pau, { wspd: 0, qnh: 1009 }).atc, 'F-GBCD, piste 24, autorisé décollage, vent calme.'); }
const WX = [null, { wdir: 240, wspd: 10, qnh: 1009 }, { wdir: 'VRB', wspd: 3, qnh: 1021 }, { wdir: 0, wspd: 0, qnh: 998 }, { wdir: 90, wspd: 25, qnh: 1012 }];
let nt = 0;
for (const t of TERRAINS) for (const wx of WX) for (const q of QUESTIONS.filter(q => q.regle !== 'alpha' && !q.qcmOnly && !q.elements)) {
  const memo = {}; memo.rw24 = memo.rw32 = memo.rw12 = R.bestRunway(t.pistes, wx?.wdir);
  const v = R.realTerrain(R.vary(q, { cs: 'F-GXYZ', rnd, memo }), t, wx);
  v.answers.forEach(a => assert(check(a, v.answers, v.callsigns).pass, 'référence (terrain réel) refusée : ' + a));
  v.wrong.forEach(w => assert(!check(w, v.answers, v.callsigns).pass, `mauvaise réponse (terrain réel ${t.icao}) acceptée : ${w} / ${v.answers[0]}`));
  if (wx?.qnh && !q.dest && /QNH/.test(q.atc) && !/afis|atis/.test(q.cat || '')) assert(v.atc.includes('QNH ' + wx.qnh) || v.wrong.some(w => w.includes('QNH ' + wx.qnh)), 'QNH réel : ' + v.atc);
  nt++;
}
assert(!R.realTerrain(QUESTIONS.find(q => q.cat === 'afis' && /Saint-Exémery/.test(q.answers[0])), pau, WX[1]).answers[0].includes('Pau'), 'AFIS reste fictif');
console.log(nt, 'exercices vérifiés sur terrains réels');
for (const l of ['fr', 'en']) { const n = QUESTIONS.filter(q => q.cat === 'nav' && q.lang === l).map(q => q.nav); assert.deepStrictEqual(n, n.map((_, i) => i + 1)); }
{ const ls = L.parcours(QUESTIONS, {}); assert(ls[0].open && !ls[1].open && ls[0].titre === 'Alphabet OACI');
  const pr = {}; ls[0].qs.forEach(q => { pr[q.id = q.id || Math.random()] = [1, 0, 1]; });
  const ls2 = L.parcours(QUESTIONS, pr); assert(ls2[1].open && !ls2[2].open && ls2[0].pct === 1); }
console.log('lot 3 OK');

// ── QCM piégeux : 3 pièges distincts, tous refusés par la correction ──
let ntr = 0;
for (let k = 0; k < 10; k++) for (const q of QUESTIONS.filter(q => q.atc && !q.q && !q.elements)) {
  const cs = R.newCallsign(rnd), shown = k % 2 ? R.abbrev(cs) : cs, v = R.trickyWrongs(R.vary(q, { cs, shown, rnd }), shown, rnd);
  assert.strictEqual(new Set(v.wrong).size, 3, 'pièges en double : ' + v.wrong);
  v.wrong.forEach(w => assert(!check(w, v.answers, v.callsigns).pass, 'piège accepté : ' + w + ' / ' + v.answers[0]));
  if (v.wrong.some(w => !q.wrong.includes(w.split(shown).join('F-GBCD')))) ntr++;
}
assert(ntr > 1000, 'pièges générés : ' + ntr);
{ const t = R.trickyWrongs(R.vary(QUESTIONS.find(q => q.ctx === 'Aligné piste 24.' && !q.cat), { cs: 'F-GXYZ', values: false }), 'F-GXYZ', () => 0.3);
  assert(t.wrong.includes('Piste 42, je décolle, F-GXYZ') && t.wrong.includes('Je décolle, F-GXYZ'), t.wrong.join(' | ')); }
assert(!check('Je rappelle base main droite piste 24, F-GBCD', ['Je rappelle vent arrière main droite piste 24, F-GBCD']).pass, 'branche du circuit');
assert(!check("Je maintiens après point d'attente piste 24, F-GBCD", ["Je maintiens avant point d'attente piste 24, F-GBCD"]).pass, 'avant / après');
console.log(ntr, 'QCM piégeux OK');

// ── ATIS réel construit depuis le METAR ──
{ const t = { radio: 'Pau', icao: 'LFBP' };
  const a = R.atisFromMetar('METAR LFBP 191000Z AUTO 24010KT 200V270 9999 FEW064 16/05 Q1009 NOSIG', t, '31', 'fr');
  assert.strictEqual(a.text, "Bonjour, ici Pau information Yankee, enregistrée à 1000 UTC. Piste en service 31. Vent 240 degrés 10 nœuds. Visibilité 10 kilomètres. Nuages peu 6400 pieds. Température 16, point de rosée 5. QNH 1009. Tendance NOSIG. Informez Pau dès le premier contact que vous avez reçu l'information Yankee.");
  assert.strictEqual(R.atisFromMetar('METAR LFBP 191800Z 00000KT CAVOK M02/M05 Q0998 TEMPO 4000 RA', t, '13', 'en').text,
    'Good evening, this is Pau information Golf, recorded at 1800 UTC. Runway in use 13. Wind calm. CAVOK. Temperature minus 2, dew point minus 05. QNH 998. Inform Pau on initial contact you have received information Golf.');
  assert.strictEqual(R.atisFromMetar('METAR LFBP 191000Z VRB03KT 9999 FEW030 12/05 Q1010', t, '31', 'fr'), null, 'vent variable : pas de formulation');
  assert.strictEqual(R.atisFromMetar('METAR LFBP 191000Z 24010KT 0400 R13/0550N FG VV002 05/05 Q1020', t, '31', 'fr'), null, 'RVR : pas d’ATIS');
  console.log('ATIS réel OK'); }

// ── Choix de l'ATIS réel : trois mauvaises réponses distinctes, plausibles et refusées, sur chaque terrain ──
for (const t of TERRAINS) for (const piste of t.pistes) for (const raw of [
  'METAR X 191000Z 06010KT 9999 FEW030 12/05 Q1013 NOSIG', 'METAR X 191000Z 31025G35KT CAVOK 02/M01 Q0998', 'METAR X 191000Z 00000KT 9999 FEW030 12/05 Q1011']) {
  const a = R.atisFromMetar(raw, t, piste, 'fr'), ch = R.atisChoices(a, t.pistes);
  for (const [k, ans] of [['letter', a.letter], ['piste', a.piste], ['qnh', a.qnh], ['wind', a.wind]]) {
    if (!ans) { assert(!ch[k]); continue; }
    assert.strictEqual(new Set(ch[k]).size, 3, `${t.icao} ${k} : ${ch[k]}`);
    ch[k].forEach(w => assert(!check(w, [ans]).pass, `${t.icao} ${k} : ${w} accepté pour ${ans}`));
  }
  ch.piste.forEach(p => assert(+p >= 1 && +p <= 36, 'piste plausible ' + p));
}
console.log('choix ATIS OK');
{ const h = s => [...s].reduce((x, c) => (x * 31 + c.charCodeAt(0)) >>> 0, 7); // même calcul que app.js
  const ids = QUESTIONS.map(q => h([q.lang, q.regle, q.atc, q.q, q.ctx, ...(q.nav ? [q.nav] : [])].join('|')).toString(36));
  assert.strictEqual(new Set(ids).size, ids.length, 'identifiants en double'); console.log('identifiants uniques OK'); }
