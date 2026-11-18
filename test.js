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
const QUESTIONS = eval(require('fs').readFileSync(__dirname + '/data.js', 'utf8') + ';QUESTIONS');
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
console.log('voix OK');

const { diffWords } = require('./match.js');
const ref = "Je descends altitude 3000 pieds QNH 1009, piste 32, F-GBCD";
assert.deepStrictEqual(diffWords("Je descends altitude 3000 pieds, piste 23, F-GBCD", ref).notes, ['QNH 1009 oublié', 'piste 32 → 23']);
assert.deepStrictEqual(diffWords("je descends altitude 3000 pieds QNH 1009 piste 32", ref).notes, ['indicatif oublié']);
assert.deepStrictEqual(diffWords(ref, ref).notes, []);
console.log('diff OK');
