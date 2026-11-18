// Auto-test de la correction : `node test.js`
const assert = require('assert');
const { normalize, check, ICAO } = require('./match.js');

const exp = ["Roulons point d'arrêt piste 34 via Alpha, QNH 1013, F-GBCD"];
assert(check("Roulons point d'arrêt piste 34 via Alpha, QNH 1013, F-GBCD", exp).pass);
assert(check("Fox Golf Bravo Charlie Delta roulons point d'arret piste trois quatre via alpha QNH un zéro un trois", exp).pass);
assert(!check("Roulons point d'arrêt piste 34 via Alpha, QNH 1012, F-GBCD", exp).pass, 'mauvais QNH');
assert(!check("Roulons point d'arrêt piste 34 via Alpha, QNH 1013", exp).pass, 'indicatif manquant');
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
assert.strictEqual(speakable('QNH 1009, 3500 feet', 'en'), 'QNH one zero zero niner, three thousand five hundred feet');
assert.strictEqual(speakable('Info 125,7', 'fr'), 'Info un deux cinq décimal sept');
assert(check(radio('Roulons via Alfa, F-GBCD'), ['Roulons via Alfa, F-GBCD']).pass);
console.log('voix OK');

const { diffWords } = require('./match.js');
const ref = "Roulons point d'arrêt Alfa 1 piste 34 via Alfa, QNH 1013, F-GBCD";
assert.deepStrictEqual(diffWords("Roulons point d'arrêt Alfa 1 piste 43 via Alfa, F-GBCD", ref).notes, ['piste 34 → 43', 'QNH 1013 oublié']);
assert.deepStrictEqual(diffWords("roulons point d'arret alpha un piste 34 via alpha QNH 1013", ref).notes, ['indicatif oublié']);
assert.deepStrictEqual(diffWords(ref, ref).notes, []);
console.log('diff OK');
