// Étape 4 – apprentissage : répétition espacée, « Pourquoi ? », défi du jour, badges, bilan personnalisé.
// Fonctions pures (testées dans test.js) ; l'interface est dans app.js.
const DAY = 86400000;

// Répétition espacée (boîtes de Leitner) : réponse juste → boîte suivante (revoir dans 1, 3, 7 puis 14 jours) ;
// réponse fausse → boîte 0 (à revoir tout de suite). Progression : [justes, fausses, dernière juste 0/1, boîte, échéance ms].
const BOX_DAYS = [0, 1, 3, 7, 14];
function leitner(p, good, now = Date.now()) {
  const q = [...(p || [])];
  while (q.length < 5) q.push(0);
  q[good ? 0 : 1]++;
  q[2] = good ? 1 : 0;
  q[3] = good ? Math.min(q[3] + 1, BOX_DAYS.length - 1) : 0;
  q[4] = now + BOX_DAYS[q[3]] * DAY;
  return q;
}
const isDueP = (p, now = Date.now()) => !!p && (p[4] || 0) <= now; // anciennes progressions sans échéance : à revoir

// « Pourquoi ? » : règles qui s'appliquent à l'exercice, avec leur source. `fiche` = fiche de cours liée.
const FICHE_CAT = { urgence: 'urgence', trafic: 'trafic', signaux: 'signaux', expr: 'repet', appel: 'essai', atis: 'nombres', transit: 'collat', sol: 'collat', ifr: 'ordre', afis: 'afis', phases: 'collat', nav: 'collat' };
function whyRules(q) {
  const out = [], txt = `${q.atc} ${q.answers[0]}`, add = (texte, src) => out.push({ texte, src });
  if (q.cat === 'afis') { // l'AFIS informe, il ne délivre pas de clairance
    if (q.atc && !q.q) add('En AFIS, l’agent donne des informations et non des clairances : on accuse réception (« Roger »), on annonce ses intentions et on collationne au minimum la piste, la visibilité et le calage altimétrique.', AFIS(28));
    add('Source de l’exercice : voir ci-dessous.', q.src);
    return { regles: out, fiche: 'afis' };
  }
  if (q.regle === 'alpha') add('L’alphabet d’épellation officiel est celui du tableau S14-2 (Alfa, Juliett, Whiskey, X-ray…).', SERA('SERA.14020'));
  if (q.cat === 'signaux') add('Chaque signal lumineux a une signification différente en vol et au sol.', SERA('appendice 1, tableau AP 1-1'));
  if (q.cat === 'expr') add('Les expressions conventionnelles ont un sens défini, identique pour tous les pilotes et contrôleurs.', SERA('SERA.14045, tableau S14-4'));
  if (q.cat === 'urgence') add('Les messages de détresse et d’urgence suivent un ordre fixé : organisme, indicatif, nature, intentions, position / niveau / cap.', SERA('SERA.14095'));
  if (q.elements) add('Le premier appel reprend les éléments du modèle du manuel, dans cet ordre, pour que le contrôleur les trouve où il les attend.', q.src);
  if (q.cut) add('Pour obtenir la partie manquante, on demande « RÉPÉTEZ TOUT APRÈS » suivi du dernier mot bien reçu.', SERA('SERA.14075 c) 4)'));
  if (q.atc && !q.q) {
    if (/QNH|piste|runway|transpondeur|squawk|niveau|level|cap \d|heading|vitesse|speed|\d,\d|\d\.\d/i.test(txt))
      add('Piste, QNH, code transpondeur, fréquence, niveau, cap et vitesse se collationnent toujours.', SERA('SERA.8015 e) 1) iii)'));
    if (/autoris|cleared|align|line up|travers|cross|maintenez avant|hold short|remontez|backtrack/i.test(txt))
      add('Une clairance pour entrer sur la piste, la traverser, décoller, atterrir ou attendre avant se collationne toujours.', SERA('SERA.8015 e) 1) ii)'));
    if (q.wrong.some(w => /^(Roger|Reçu)/i.test(w)))
      add('« Roger » signifie seulement « reçu » : il ne remplace jamais un collationnement.', MANUEL(21));
    if (/rappelez|report/i.test(q.atc))
      add('« Rappelez… » (« Report… ») se confirme par « Je rappelle… » (« Reporting… ») : vous vous engagez à rappeler.', `${MANUEL(21)} ; ${MANUEL(149)}`);
    if (q.lang === 'fr' && /^(Je |J’|J')/.test(q.answers[0]))
      add('En français, le pilote collationne à la première personne : « Je roule… », « Je monte… », « Je m’aligne et attends… ».', `${MANUEL(44)} ; ${MANUEL(53)} ; ${MANUEL(71)}`);
    if (/gauche|droite|left|right/i.test(txt)) add('Le sens du virage ou du circuit doit être répété exactement.', MANUEL(192));
    add('Le collationnement se termine par votre indicatif.', SERA('SERA.14075 a) 1)'));
  }
  if (!out.length) add('Voir la source indiquée sous la correction.', q.src);
  return { regles: out, fiche: FICHE_CAT[q.cat] || (q.regle === 'alpha' ? null : 'collat') };
}

// Classe une erreur pour le bilan personnalisé (à partir des remarques de la correction mot à mot).
function classify(notes = [], said = '') {
  const t = new Set();
  if (/^\s*(roger|reçu|recu)\b/i.test(said)) t.add('roger');
  for (const n of notes) {
    if (/indicatif|callsign/i.test(n)) t.add('indicatif');
    else if (/QNH/i.test(n)) t.add('qnh');
    else if (/piste|runway/i.test(n)) t.add('piste');
    else if (/transpondeur|squawk/i.test(n)) t.add('transpondeur');
    else if (/niveau|level|pieds|feet|altitude/i.test(n)) t.add('niveau');
    else if (/\bcap\b|heading/i.test(n)) t.add('cap');
    else if (/gauche|droite|left|right/i.test(n)) t.add('sens');
    else if (/→/.test(n) && !/\d/.test(n)) t.add('forme');
    else if (/oublié|manquant/.test(n)) t.add('oubli');
  }
  return [...t];
}
const CONSEILS = {
  indicatif: ['Indicatif oublié', 'Terminez chaque collationnement par votre indicatif.', 'collat'],
  qnh: ['QNH oublié ou faux', 'Le calage altimétrique se collationne toujours, chiffre par chiffre.', 'collat'],
  piste: ['Piste oubliée ou fausse', 'La piste se collationne toujours ; attention aux inversions (24 / 42).', 'collat'],
  transpondeur: ['Code transpondeur', 'Le code se collationne toujours : « Transpondeur 7021 » / « Squawk 7021 ».', 'collat'],
  niveau: ['Niveaux et altitudes', 'Répétez le niveau ou l’altitude exacts, avec « niveau » ou « pieds ».', 'nombres'],
  cap: ['Caps', 'Le cap se collationne toujours, à trois chiffres.', 'nombres'],
  sens: ['Gauche / droite', 'Le sens du virage ou du circuit doit être exact.', 'collat'],
  forme: ['Tournures', 'Reprenez la forme du manuel : « Je roule », « Je maintiens », « Piste 24, je décolle »…', 'forme'],
  roger: ['« Roger » à la place d’un collationnement', '« Roger » ne remplace jamais un collationnement.', 'collat'],
  oubli: ['Éléments oubliés', 'Relisez la clairance élément par élément avant de répondre.', 'ordre'],
};
function bilan(tally = {}, answered = 0, min = 50) {
  if (answered < min) return { pret: false, reste: min - answered };
  const top = Object.entries(tally).filter(([k, n]) => n > 0 && CONSEILS[k]).sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([k, n]) => ({ key: k, titre: CONSEILS[k][0], conseil: CONSEILS[k][1], fiche: CONSEILS[k][2], n }));
  return { pret: true, top };
}

// Entraînement ciblé : collationnements qui contiennent l'élément souvent raté (tous les collationnements sinon).
const CIBLES = { qnh: /QNH/, piste: /piste|runway/i, transpondeur: /transpondeur|squawk/i, niveau: /niveau|level|pieds|feet/i,
  cap: /\bcap \d|heading/i, sens: /gauche|droite|left|right/i };
function cible(questions, kind) {
  const re = CIBLES[kind];
  return questions.filter(q => q.atc && !q.q && q.regle !== 'alpha' && (!re || re.test(`${q.atc} ${q.answers[0]}`)));
}

// Défi du jour : les mêmes questions pour tout le monde, tirées avec la date comme graine.
function dailyPick(questions, dateStr, n = 10) {
  let s = [...dateStr].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) || 1;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const idx = questions.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return idx.slice(0, n).map(i => questions[i]);
}

// Badges (objectifs) calculés à partir de la progression enregistrée.
function badges(questions, prog, extra) {
  const P = q => prog[q.id] || [0, 0, 0];
  const sum = (f, i) => questions.filter(f).reduce((s, q) => s + P(q)[i], 0);
  const total = sum(() => true, 0) + sum(() => true, 1);
  const allLast = f => { const qs = questions.filter(f); return qs.length > 0 && qs.every(q => P(q)[2] === 1); };
  const exams = extra.exams || [], defis = Object.keys(extra.defi || {});
  return [
    ['🛫', 'Premier contact', '10 réponses', total >= 10],
    ['💯', 'Centurion', '100 réponses', total >= 100],
    ['🎯', 'Collationneur', '50 collationnements justes', sum(q => q.atc && !q.q, 0) >= 50],
    ['🔤', 'Alphabet maîtrisé', 'Les 26 lettres justes à la dernière réponse', allLast(q => q.regle === 'alpha')],
    ['🌍', 'Bilingue', '20 réponses justes en français et 20 en anglais', sum(q => q.lang === 'fr', 0) >= 20 && sum(q => q.lang === 'en', 0) >= 20],
    ['🧯', 'Sang-froid', 'Tous les exercices d’urgence justes', allLast(q => q.cat === 'urgence')],
    ['🔥', 'En série', '10 bonnes réponses d’affilée', (extra.best || 0) >= 10],
    ['⚡', 'Inarrêtable', '25 bonnes réponses d’affilée', (extra.best || 0) >= 25],
    ['🎓', 'Reçu à l’examen', 'Un examen blanc à 75 % ou plus', exams.some(e => e.pct >= 75)],
    ['📅', 'Assidu', 'Le défi du jour réalisé 7 jours différents', defis.length >= 7],
  ].map(([icon, nom, desc, ok]) => ({ icon, nom, desc, ok }));
}

// Parcours progressif : leçons dans l'ordre ; la suivante se débloque à 80 % d'exercices justes (dernière réponse).
const SEUIL = 0.8;
const PARCOURS = [
  ['Alphabet OACI', q => q.regle === 'alpha'],
  ['Bases VFR (français)', q => !q.cat && q.regle === 'vfr' && q.lang === 'fr'],
  ['Bases VFR (anglais)', q => !q.cat && q.regle === 'vfr' && q.lang === 'en'],
  ['Situations au sol', q => q.cat === 'sol'],
  ['Premier appel, essai radio, répétitions', q => q.cat === 'appel'],
  ['Expressions conventionnelles', q => q.cat === 'expr'],
  ['Information de trafic', q => q.cat === 'trafic'],
  ['AFIS et auto-information', q => q.cat === 'afis'],
  ['Transit VFR et VFR spécial', q => q.cat === 'transit'],
  ['Navigation VFR complète', q => q.cat === 'nav'],
  ['Bases IFR', q => !q.cat && q.regle === 'ifr'],
  ['IFR avancé', q => q.cat === 'ifr'],
  ['Phases particulières', q => q.cat === 'phases'],
  ['Urgences et pannes', q => q.cat === 'urgence'],
];
function parcours(questions, prog) {
  let open = true;
  return PARCOURS.map(([titre, f]) => {
    const qs = questions.filter(f), done = qs.filter(q => prog[q.id]?.[2] === 1).length;
    const pct = qs.length ? done / qs.length : 1, l = { titre, qs, done, pct, open };
    open = open && pct >= SEUIL;
    return l;
  }).filter(l => l.qs.length);
}

if (typeof module !== 'undefined') module.exports = { leitner, isDueP, whyRules, classify, bilan, dailyPick, badges, cible, parcours, BOX_DAYS, DAY };
