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
const QUESTIONS = eval(['data.js', 'data-plus.js'].map(f => fs.readFileSync(__dirname + '/' + f, 'utf8')).join('\n') + ';QUESTIONS');
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
global.normalize = normalize;
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
