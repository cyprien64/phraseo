// Lot 3 : terrains réels, navigation VFR complète.
// Sources :
//  - AIP France, AD 2 de chaque terrain (cycle AIRAC du 29 octobre 2026) : pistes (AD 2.12) et fréquences (AD 2.18).
//  - Manuel de phraséologie DSNA, 10e éd. (pages indiquées).
// La météo réelle (METAR) est récupérée par GitHub toutes les 30 minutes auprès du service officiel
// aviationweather.gov (NOAA) dans metar.json (voir .github/workflows/pages.yml).
const AIP_AD = icao => `AIP France, AD 2 ${icao} (AIRAC 29/10/2026)`;
SUJETS.nav = 'Navigation VFR complète (départ, SIV, transit, arrivée)';

// Indicatif radio = nom utilisé dans l'AIP (Tarbes : « Lourdes Tour »).
// Pistes préférentielles (AD 2.20 / 2.21) : seule Nantes en publie une chiffrée. Biarritz demande la piste 09 au
// décollage de 20 h à 7 h « chaque fois que les conditions le permettent », sans seuil : non appliqué. Pau, Tarbes et
// Lyon-Bron n'en publient pas : piste face au vent.
// Sources : AIP AD 2 (fréquences AD 2.18, horaires ATS AD 2.3, AIRAC 29/10/2026) et cartes VAC du SIA (points de compte
// rendu et procédures en texte ; sens et altitude des tours de piste avions lus sur la carte « Atterrissage à vue »).
// `circuit` : sens du tour de piste par piste ; `tdp` : altitude du tour de piste (ft AMSL) ; `entree` : point d'entrée
// utilisé pour les arrivées (Pau : selon la piste, procédure VAC) ; `arrAlt` : altitude de présentation (Pau, VAC) ;
// `app` / `fis` : approche et information de vol de l'AD 2.18 (absentes de l'AIP de Tarbes et de Lyon-Bron : fictives) ;
// `ats` : horaires ATS en UTC hiver ([début, fin] en HHMM ; par jour 0 = dimanche si `atsJours`), null = H24.
// `pos` : ARP (AD 2.2), pour la nuit aéronautique. `appr` : approche aux instruments publiée pour chaque piste
// (titre de la carte IAC en AD 2.24 ; [nom, indicatif et fréquence du LOC de l'AD 2.19] pour un ILS). Piste sans
// approche publiée : pas d'exercice d'approche ILS sur ce terrain. Altitude de transition : 5000 ft partout (cartes IAC).
// Ajout de Bordeaux, Perpignan et Agen (AIRAC 29/10/2026). Toulouse-Blagnac et Montpellier ne sont pas proposés :
// leurs pistes parallèles (14L/14R, 12L/12R) ne passent pas dans les exercices, écrits pour une piste à deux chiffres.
const TERRAINS = [
  { icao: 'LFBP', nom: 'Pau-Pyrénées', radio: 'Pau', pistes: ['13', '31'], tour: '124,155', sol: '121,755', atis: '128,480',
    app: { nom: 'Pyrénées', freq: '128,805' }, fis: { nom: 'Pyrénées', freq: '126,530' },
    circuit: { 13: 'gauche', 31: 'droite' }, tdp: 1600, // VAC TXT 02 : arrivées du nord (13 : N à 1600 ft ; 31 : NE à 2500 ft) et du sud (13 : SW ; 31 : S ou SE, à 2500 ft)
    entree: { 13: { N: 'N', S: 'SW' }, 31: { N: 'NE', S: 'S' } }, arrAlt: { 13: { N: 1600, S: 2500 }, 31: 2500 },
    ats: null, atsTxt: 'H24', pos: [43.38, -0.4186], appr: { 31: ['ILS', 'PYR', '110,1'] } },
  { icao: 'LFBZ', nom: 'Biarritz-Pays basque', radio: 'Biarritz', pistes: ['09', '27'], tour: '118,705', sol: '121,955', atis: '128,230',
    app: { nom: 'Biarritz', freq: '125,605' }, fis: { nom: 'Biarritz', freq: '119,180' },
    circuit: { '09': 'droite', 27: 'gauche' }, tdp: 1200, entree: 'E',
    ats: [[515, 2200]], atsTxt: '0515-2200 UTC en hiver, une heure plus tôt en été',
    pos: [43.4683, -1.5311], appr: { 27: ['ILS Z', 'BZ', '111,35'], '09': ['RNP'] } },
  { icao: 'LFBT', nom: 'Tarbes-Lourdes-Pyrénées', radio: 'Lourdes', pistes: ['02', '20'], tour: '119,055', sol: '121,805', atis: '125,955',
    circuit: { '02': 'gauche', 20: 'gauche' }, tdp: 2300, entree: 'E',
    ats: [[400, 2230], [2330, 200]], atsTxt: '0400-2230 et 2330-0200 UTC en hiver, une heure plus tôt en été',
    pos: [43.1856, -0.0028], appr: { 20: ['ILS', 'OS', '109,5'] } },
  { icao: 'LFLY', nom: 'Lyon-Bron', radio: 'Bron', pistes: ['16', '34'], tour: '118,105', sol: '121,705', atis: '128,130',
    circuit: { 16: 'gauche', 34: 'droite' }, tdp: 1500, entree: 'MS',
    ats: [[[700, 2000]], [[530, 2130]], [[530, 2130]], [[530, 2130]], [[530, 2130]], [[530, 2130]], [[700, 2130]]], atsJours: true,
    atsTxt: 'lun-ven 0530-2130, sam 0700-2130, dim et fériés 0700-2000 UTC en hiver, une heure plus tôt en été',
    pos: [45.7294, 4.9389], appr: { 16: ['RNP'], 34: ['RNP'] } },
  { icao: 'LFRS', nom: 'Nantes-Atlantique', radio: 'Nantes', pistes: ['03', '21'], tour: '118,655', sol: '121,655', atis: '126,930',
    pref: { piste: '03', tail: 5 }, // AD 2 LFRS.21 § 21.3.2 : « RWY 03 préférentiel jusqu'à 5 kt de vent arrière »
    app: { nom: 'Nantes', freq: '119,400' }, fis: { nom: 'Nantes', freq: '122,800' },
    circuit: { '03': 'gauche', 21: 'droite' }, tdp: 1100, entree: 'E', ats: null, atsTxt: 'H24',
    pos: [47.1569, -1.6078], appr: { '03': ['ILS Z', 'NT', '109,9'], 21: ['RNP Z'] } },
  // Bordeaux : deux pistes sécantes ; la VAC ne dessine pas de tour de piste (intégration directe en finale) : sens de
  // circuit des exercices inchangé. Points d'entrée N, NE, NW, S, SE, SW (S : point de sortie par défaut vers le sud).
  { icao: 'LFBD', nom: 'Bordeaux-Mérignac', radio: 'Mérignac', pistes: ['23', '05', '29', '11'], tour: '118,305', sol: '121,905', atis: '131,155',
    app: { nom: 'Aquitaine', freq: '119,275' }, fis: { nom: 'Aquitaine', freq: '120,575' }, tdp: 1200, entree: 'S', ats: null, atsTxt: 'H24',
    pos: [44.8286, -0.7153], appr: { 23: ['ILS', 'BD', '110,3'], 29: ['ILS', 'BEI', '111,15'], '05': ['RNP Z'], 11: ['RNP'] } },
  // Perpignan : tour de piste à l'ouest de la piste 15/33 (la 13/31 n'est donnée qu'en fin de vent arrière, VAC TXT 01) ;
  // approche Montpellier (VAC) ; pas de SIV dans l'AD 2.18.
  { icao: 'LFMP', nom: 'Perpignan-Rivesaltes', radio: 'Perpignan', pistes: ['33', '15'], tour: '118,300', sol: '121,780', atis: '127,880',
    app: { nom: 'Montpellier', freq: '130,855' }, circuit: { 15: 'droite', 33: 'gauche' }, tdp: 1200, entree: 'EA',
    ats: [[[700, 2130]], [[530, 2130]], [[530, 2130]], [[530, 2130]], [[530, 2130]], [[530, 2130]], [[530, 1930]]], atsJours: true,
    atsTxt: 'lun-ven 0530-2130, sam 0530-1930, dim 0700-2130 UTC en hiver, une heure plus tôt en été',
    pos: [42.7408, 2.8697], appr: { 33: ['ILS', 'PL', '111,75'], 15: ['RNP'] } },
  // Agen : pas de Sol (roulage avec la Tour) ; « QFU 291° préférentiel cause procédure IFR » sans seuil de vent (VAC TXT 01) :
  // non appliqué ; la VAC ne dessine pas de tour de piste ; approche Toulouse au-dessus de 2000 ft (VAC).
  { icao: 'LFBA', nom: 'Agen-La Garenne', radio: 'Agen', pistes: ['29', '11'], tour: '121,305', atis: '129,605',
    app: { nom: 'Toulouse', freq: '120,355' }, tdp: 1200, entree: 'SA',
    ats: [[[800, 1100], [1215, 1700]], [[700, 1700]], [[700, 1700]], [[700, 1700]], [[700, 1700]], [[700, 1700]], [[800, 1100], [1215, 1700]]], atsJours: true,
    atsTxt: 'lun-ven 0700-1700, sam-dim et fériés 0800-1100 et 1215-1700 UTC en hiver, une heure plus tôt en été',
    pos: [44.1747, 0.5906], appr: { 29: ['RNP'] } },
];

// Toulouse et Montpellier : pistes parallèles. Seule la piste du tour de piste avions de la VAC est utilisée (Toulouse :
// 14L/32R, circuit 1500 ft à l'est ; Montpellier : piste principale 12L/30R, circuit au nord-est, 1000 ft minimum).
// Désignation dite « 32 droite » / « runway 32 right » (Manuel p. 15). Montpellier : Tour secteur Nord 118,780 (VAC).
TERRAINS.push(
  { icao: 'LFBO', nom: 'Toulouse-Blagnac', radio: 'Blagnac', pistes: ['32R', '14L'], tour: '118,105', sol: '121,905', atis: '123,130',
    app: { nom: 'Blagnac', freq: '121,105' }, fis: { nom: 'Toulouse', freq: '121,250' },
    circuit: { '32R': 'droite', '14L': 'gauche' }, tdp: 1500, entree: 'EA', ats: null, atsTxt: 'H24',
    pos: [43.635, 1.3678], appr: { '32R': ['ILS', 'TD', '108,35'], '14L': ['ILS', 'TG', '108,9'] } },
  { icao: 'LFMT', nom: 'Montpellier-Méditerranée', radio: 'Montpellier', pistes: ['30R', '12L'], tour: '118,780', sol: '121,955', atis: '124,130',
    app: { nom: 'Montpellier', freq: '130,855' }, circuit: { '12L': 'gauche', '30R': 'droite' }, tdp: 1000, entree: 'NC', ats: null, atsTxt: 'H24',
    pos: [43.5833, 3.9614], appr: { '30R': ['ILS', 'FG', '108,55'], '12L': ['RNP'] } },
);
const T_ = icao => TERRAINS.find(t => t.icao === icao);

// Départs IFR publiés (cartes SID de l'AD 2.24, par piste). Sans SID publiée pour la piste : exercice de mise en route
// avec départ normalisé écarté.
Object.entries({
  LFBP: { 13: ['SOVOS 2D', 'USAKU 2D'], 31: ['SOVOS 2V', 'USAKU 2V'] },
  LFBZ: { '09': ['DONOS 3D', 'SOVOS 3D', 'VAVIX 3D'], 27: ['DONOS 3F', 'SOVOS 3F', 'VAVIX 3F'] },
  LFRS: { '03': ['BALNI 4N', 'ERBIN 4N', 'LUGEN 4N', 'LUSON 4N'], 21: ['LUGEN 4T', 'LUSON 4T'] },
  LFBD: { '05': ['OBLOC 6Q', 'ROYAN 6Q', 'VAVIX 6Q'], 23: ['OBLOC 6P', 'ROYAN 6P', 'VAVIX 6P'], 29: ['OBLOC 6R', 'ROYAN 6R', 'VAVIX 6R'] },
  LFMP: { 15: ['KELAM 5S', 'SIJAN 5S', 'SUBIL 5S'], 33: ['KELAM 5N', 'ORBIL 5N', 'SIJAN 5N'] },
  LFMT: { '12L': ['BRUSC 8L', 'KELAM 8L', 'MARRI 8L'], '30R': ['BRUSC 8R', 'KELAM 8R', 'MARRI 8R'] },
  LFBO: { '14L': ['AMOLO 7A', 'FINOT 7A', 'GAUDE 7A'], '32R': ['AMOLO 7B', 'FINOT 7B', 'GAUDE 7B'] },
}).forEach(([icao, sid]) => { T_(icao).sid = sid; });

// Hors horaires ATS : auto-information sur la fréquence A/A de l'AD 2.18 ou de la VAC (« Absence ATS : A/A, FR seulement »).
// Biarritz (CTR reprise par Pyrénées) et Tarbes n'en publient pas : simple avertissement.
T_('LFBA').aa = '121,305'; T_('LFMP').aa = '118,300'; T_('LFLY').aa = '118,105';

// VFR spécial (cartes VAC, consignes particulières) : [cas, visibilité mini (m), plafond mini (ft)]. Sans minima
// propres publiés : minima de SERA.5010 (visibilité 1500 m, plafond 600 ft). Toulouse (minima par itinéraire) : non traité.
const SVFR_SERA = [['VFR spécial', 1500, 600]];
Object.assign(T_('LFBP'), { svfr: [['en présence de trafic IFR', 3000, 1100], ['sans trafic IFR', 1500, 600]] });
Object.assign(T_('LFBT'), { svfr: [['en présence de trafic IFR', 3000, 1100], ['sans trafic IFR', 1500, 600]] });
Object.assign(T_('LFBZ'), { svfr: [['à l’arrivée', 1500, 800], ['au départ et en tour de piste', 3000, 1000]] });
Object.assign(T_('LFRS'), { svfr: [['sans trafic IFR dans la CTR (non autorisé avec du trafic IFR)', 1500, 600]], svfrSera: true });
Object.assign(T_('LFMT'), { svfr: [['VFR spécial', 1500, 0]] });
for (const icao of ['LFLY', 'LFBD', 'LFMP', 'LFBA']) Object.assign(T_(icao), { svfr: SVFR_SERA, svfrSera: true });

// Panne de radiocommunication (cartes VAC, consignes particulières de radiocommunication) : [situation, conduite à tenir]
// en français et en anglais. Nantes et Agen : rien de propre publié.
const PANNE = {
  ctr: ['Panne radio dans la CTR, avant d’avoir reçu la clairance d’entrée dans le circuit de piste.',
    'Radio failure inside the CTR, before receiving the clearance to join the circuit.'],
  out: ['Panne radio avant d’avoir reçu l’autorisation de pénétrer dans la CTR.', 'Radio failure before receiving the clearance to enter the CTR.'],
  dep: ['Panne radio juste après le décollage.', 'Radio failure just after take-off.'],
};
Object.assign(T_('LFBP'), { panne: { ctr: ['Sortir de la CTR par l’itinéraire VFR le plus approprié', 'Leave the CTR by the most suitable VFR route'],
  out: ['Ne pas pénétrer dans la CTR', 'Do not enter the CTR'], dep: ['Afficher 7600 et faire demi-tour pour revenir à Pau', 'Squawk 7600 and turn back to Pau'] } });
Object.assign(T_('LFBD'), { panne: { ctr: ['Sortir de la CTR par l’itinéraire VFR le plus approprié', 'Leave the CTR by the most suitable VFR route'],
  out: ['Ne pas pénétrer dans la CTR', 'Do not enter the CTR'], dep: ['Quitter la CTR en respectant la dernière clairance (itinéraire et altitude)', 'Leave the CTR following the last clearance (route and altitude)'] } });
Object.assign(T_('LFBZ'), { panne: { ctr: ['Afficher 7600 et se mettre en attente (si possible, appeler la Tour par téléphone)', 'Squawk 7600 and hold (if possible, phone the Tower)'] } });
Object.assign(T_('LFBT'), { panne: { ctr: ['Quitter l’espace dès que possible', 'Leave the airspace as soon as possible'] } });
Object.assign(T_('LFLY'), { panne: { ctr: ['Afficher 7600, suivre les dernières instructions ou passer à la verticale (2500 ft max), s’intégrer phares allumés en début de vent arrière ; feux à éclats de seuil = autorisation d’atterrir',
  'Squawk 7600, follow the last instructions or overfly the field (2500 ft max), join early downwind with lights on; flashing threshold lights = landing clearance'] } });
Object.assign(T_('LFMP'), { panne: { out: ['Afficher 7600 et ne pas entrer dans la CTR', 'Squawk 7600 and do not enter the CTR'],
  dep: ['Afficher 7600 et sortir de la CTR selon la clairance de départ', 'Squawk 7600 and leave the CTR according to the departure clearance'] } });
Object.assign(T_('LFMT'), { panne: { ctr: ['Sortir de la CTR par l’itinéraire VFR le plus approprié, sans couper les axes de piste', 'Leave the CTR by the most suitable VFR route without crossing the runway axes'],
  out: ['Afficher 7600 et ne pas pénétrer dans la CTR', 'Squawk 7600 and do not enter the CTR'] } });
Object.assign(T_('LFBO'), { panne: { ctr: ['Afficher 7600, poursuivre en VMC, atterrir sur l’aérodrome approprié le plus proche et signaler son arrivée au plus vite', 'Squawk 7600, continue in VMC, land at the nearest suitable aerodrome and report arrival as quickly as possible'] } });
// mauvaises réponses plausibles, par situation (conduites publiées ailleurs ou erreurs courantes)
const PANNE_FAUX = {
  ctr: [['Poursuivre et atterrir sans clairance', 'Continue and land without clearance'], ['Afficher 7700 et poursuivre l’intégration', 'Squawk 7700 and continue joining'],
    ['Se mettre en attente à la verticale du terrain', 'Hold overhead the field'], ['Quitter l’espace dès que possible', 'Leave the airspace as soon as possible'],
    ['Sortir de la CTR par l’itinéraire VFR le plus approprié', 'Leave the CTR by the most suitable VFR route']],
  out: [['Entrer dans la CTR et poursuivre vers le terrain', 'Enter the CTR and continue to the field'], ['Afficher 7700 et entrer dans la CTR', 'Squawk 7700 and enter the CTR'],
    ['Se mettre en attente dans la CTR', 'Hold inside the CTR']],
  dep: [['Poursuivre le vol prévu sans changement', 'Continue the planned flight unchanged'], ['Afficher 7700 et poursuivre', 'Squawk 7700 and continue'],
    ['Se mettre en attente à la verticale du terrain', 'Hold overhead the field'], ['Afficher 7600 et faire demi-tour pour revenir au terrain', 'Squawk 7600 and turn back to the field']],
};

// Navigations réelles (cartes VAC) : départ par le point de sortie de la procédure de départ, information de vol, entrée
// par le point publié, tour de piste de la VAC. `dep` par piste : [point, texte FR, texte EN, coordonnées du point] ;
// `arr` : [point, coordonnées] (ou par piste) ; `alt` : altitude de croisière choisie par le pilote (ft) ; `fis` : [nom, fréquence]
// puis, si besoin, la fréquence de premier contact demandée par la VAC du terrain d'arrivée.
const NAV_REAL = {
  'LFBP-LFBT': { from: 'LFBP', to: 'LFBT', alt: 2500, fis: [['Pyrénées', '126,530']],
    dep: { 13: ['SE', 'Départ Sud (VAC) : à 500 ft, virage à droite vers SA en montée vers 2000 ft, puis SE.', 'Southern departure (VAC): at 500 ft AAL, turn right towards SA, climbing to 2000 ft, then SE.', [43.2789, -0.3878]],
      31: ['SW', 'Départ Sud (VAC) : à 500 ft, virage à gauche vers SW en montée vers 2000 ft.', 'Southern departure (VAC): at 500 ft AAL, turn left towards SW, climbing to 2000 ft.', [43.3211, -0.5778]] },
    arr: ['W', [43.1928, -0.1164]], vacDep: 'TXT 02 (procédures de départ)', vacArr: 'TXT 01 (points de compte rendu)' },
  'LFBZ-LFBP': { from: 'LFBZ', to: 'LFBP', alt: 2500, fis: [['Biarritz', '119,180'], ['Pyrénées', '126,530']],
    dep: { '09': ['E', 'Sortie par le point E (A64, sortie 4), carte VAC.', 'Exit via point E (A64 exit 4), VAC chart.', [43.4667, -1.2869]],
      27: ['E', 'Sortie par le point E (A64, sortie 4), carte VAC.', 'Exit via point E (A64 exit 4), VAC chart.', [43.4667, -1.2869]] },
    arr: { 13: ['SW', [43.3211, -0.5778]], 31: ['S', [43.2986, -0.4867]] }, arrFis: 'Pyrénées',
    vacDep: 'TXT 02 (points de compte rendu)', vacArr: 'TXT 02 (arrivée du Sud : premier contact Pyrénées Information, 2500 ft)' },
  'LFBD-LFBA': { from: 'LFBD', to: 'LFBA', alt: 1500, fis: [['Aquitaine', '120,575']],
    dep: { '05': ['SE', 'Itinéraire SA puis SE à 1500 ft (VAC).', 'Route SA then SE at 1500 ft (VAC).', [44.7458, -0.5042]],
      23: ['SE', 'Itinéraire SA puis SE à 1500 ft (VAC).', 'Route SA then SE at 1500 ft (VAC).', [44.7458, -0.5042]],
      29: ['SE', 'Itinéraire SA puis SE à 1500 ft (VAC).', 'Route SA then SE at 1500 ft (VAC).', [44.7458, -0.5042]],
      11: ['S', 'Itinéraire OA puis S à 1500 ft (VAC).', 'Route OA then S at 1500 ft (VAC).', [44.7167, -0.6903]] },
    arr: ['W', [44.2286, 0.3520]], vacDep: 'TXT 02 (itinéraires VFR)', vacArr: 'TXT 01 (points de compte rendu)' },
};
for (const [id, r] of Object.entries(NAV_REAL)) SUJETS['navreel:' + id] = `Navigation réelle ${T_(r.from).nom.split('-')[0]} → ${T_(r.to).nom.split('-')[0]} (cartes VAC, météo du jour)`;

// Navigation VFR complète : messages enchaînés dans l'ordre (champ `nav`), même indicatif et mêmes valeurs.
// Départ de Saint-Exémery (fictif, piste 24), arrivée à Montrouvel (fictif, piste 33). `dest` : terrain d'arrivée
// (la météo réelle du terrain de départ ne s'y applique pas).
const NAV = [
  ['fr', 'Tour 118,700', 'Départ de Saint-Exémery vers Montrouvel. Au parking, vous avez demandé le roulage.',
    "F-GBCD, roulez point d'attente piste 24 via Alfa.", "Je roule point d'attente piste 24 via Alfa, F-GBCD",
    ['Roger, F-GBCD', "Je roule point d'attente, F-GBCD", "Je roule point d'attente piste 42 via Alfa, F-GBCD"], MANUEL(44)],
  ['fr', 'Tour 118,700', "Au point d'attente, prêt au départ.",
    'F-GBCD, alignez-vous et attendez piste 24.', "Je m'aligne et attends piste 24, F-GBCD",
    ['Roger, F-GBCD', "Je m'aligne piste 24, F-GBCD", 'Piste 24, je décolle, F-GBCD'], MANUEL(53)],
  ['fr', 'Tour 118,700', 'Aligné piste 24.',
    'F-GBCD, piste 24, autorisé décollage, vent 260 degrés 8 nœuds.', 'Piste 24, je décolle, F-GBCD',
    ['Je décolle, F-GBCD', 'Roger, F-GBCD', 'Piste 42, je décolle, F-GBCD'], MANUEL(59)],
  ['fr', 'Tour 118,700', 'En montée initiale.',
    'F-GBCD, transpondeur 7021.', 'Transpondeur 7021, F-GBCD',
    ['Roger, F-GBCD', 'Transpondeur, F-GBCD', 'Transpondeur 7012, F-GBCD'], MANUEL(186)],
  ['fr', 'Tour 118,700', 'Vous quittez la zone de Saint-Exémery.',
    'F-GBCD, contactez Info 125,7.', 'Info 125,7, F-GBCD',
    ['Au revoir, F-GBCD', 'Roger, F-GBCD', 'Info 127,5, F-GBCD'], `${MANUEL(124)} ; ${MANUEL(182)}`],
  ['fr', 'Info 125,700', 'En croisière avec le service d’information de vol.',
    'F-GBCD, rappelez travers aérodrome de Castelnaudary.', 'Je rappelle travers aérodrome de Castelnaudary, F-GBCD',
    ['Roger, F-GBCD', 'Travers Castelnaudary, F-GBCD', 'Roger, je rappelle, F-GBCD'], `${MANUEL(87)} ; ${MANUEL(21)}`],
  ['fr', 'Info 125,700', 'En croisière. Le service d’information vous transmet un renseignement.',
    'F-GBCD, un pilote signale des conditions météorologiques défavorables au voisinage de Montauban.', 'Roger, F-GBCD',
    ['Affirme, F-GBCD', 'Négatif, F-GBCD', 'Je rappelle Montauban, F-GBCD'], `${MANUEL(209)} ; ${SERA('SERA.14045, tableau S14-4')} (ROGER : j’ai reçu)`],
  ['fr', 'Info 125,700', 'Vous approchez d’une zone contrôlée que vous voulez traverser.',
    'F-GBCD, contactez Tour 119,5.', 'Tour 119,5, F-GBCD',
    ['Au revoir, F-GBCD', 'Roger, F-GBCD', 'Tour 115,9, F-GBCD'], MANUEL(182)],
  ['fr', 'Tour 119,500', 'Vous voulez traverser la zone à 2000 pieds, de W H à E N ; vous estimez W à 52.', '',
    'Tour, F-GBCD, demande transit VFR, 2000 pieds, de W H à E N, j’estime W à 52',
    ['Tour, F-GBCD, je traverse la zone', 'F-GBCD, demande transit', 'Tour, F-GBCD, transit à 2000 pieds, roger'], MANUEL(178), 'Quelle est votre demande ?'],
  ['fr', 'Tour 119,500', 'Vous avez demandé le transit.',
    'F-GBCD, transitez via W H, W D, puis E N, maintenez 2000 pieds, et rappelez avant W D.',
    'Roger, je transite via W H, W D, puis E N, maintiens 2000 pieds, et rappelle avant W D, F-GBCD',
    ['Roger, F-GBCD', 'Je transite via W H, W D, puis E N, F-GBCD', 'Je transite via W H, W D, puis E N, maintiens 3000 pieds, et rappelle avant W D, F-GBCD'], MANUEL(178)],
  ['fr', 'Tour 119,500', 'Le départ qui vous gênait est passé.',
    'F-GBCD, poursuivez transit vers E N, rappelez E N pour quitter.', 'Je poursuis transit vers E N, et rappelle E N pour quitter, F-GBCD',
    ['Roger, F-GBCD', 'Je poursuis, F-GBCD', 'Je poursuis transit vers W D, et rappelle W D pour quitter, F-GBCD'], MANUEL(179)],
  ['fr', 'Tour 120,100', 'Arrivée à Montrouvel : DR400, 1500 pieds, estimé au point E à 05, ATIS « Kilo » écoutée. Le contact est établi (« F-GBCD, bonjour, j’écoute »).', '',
    'F-GBCD, DR400, VFR de Saint-Exémery à Montrouvel pour atterrissage, 1500 pieds, estimé E à 05, information Kilo',
    ['F-GBCD, je viens atterrir à Montrouvel', 'F-GBCD, information Kilo, 1500 pieds, DR400', 'F-GBCD, DR400, VFR de Saint-Exémery à Montrouvel pour atterrissage'], MANUEL(149), 'Quel message envoyez-vous ?'],
  ['fr', 'Tour 120,100', 'Vous avez donné votre message d’arrivée.',
    'F-GBCD, roger, rappelez E.', 'Je rappelle E, F-GBCD',
    ['Roger, F-GBCD', 'E, F-GBCD', 'Je rappelle vent arrière, F-GBCD'], MANUEL(149)],
  ['fr', 'Tour 120,100', 'Vous passez le point E (« Montrouvel Tour, F-GBCD, passe E »).',
    'F-GBCD, entrez vent arrière main droite piste 33, rappelez vent arrière.', 'Je rappelle vent arrière main droite piste 33, F-GBCD',
    ['Roger, F-GBCD', 'Vent arrière, F-GBCD', 'Je rappelle vent arrière main gauche piste 33, F-GBCD'], MANUEL(149)],
  ['fr', 'Tour 120,100', 'Vent arrière main droite piste 33, un Cessna est en base.',
    'F-GBCD, numéro 2, suivez un Cessna 172 en base, rappelez base main droite piste 33.', 'Numéro 2, trafic en vue, je rappelle base main droite piste 33, F-GBCD',
    ['Numéro 2, F-GBCD', 'Roger, je rappelle base, F-GBCD', 'Numéro 3, trafic en vue, je rappelle base main droite piste 33, F-GBCD'], MANUEL(151)],
  ['fr', 'Tour 120,100', 'En base main droite piste 33.',
    'F-GBCD, rappelez finale piste 33.', 'Je rappelle finale piste 33, F-GBCD',
    ['Roger, F-GBCD', 'Finale, F-GBCD', 'Je rappelle base piste 33, F-GBCD'], MANUEL(151)],
  ['fr', 'Tour 120,100', 'En finale piste 33.',
    'F-GBCD, piste 33, autorisé atterrissage, vent 350 degrés 10 nœuds.', "Piste 33, j'atterris, F-GBCD",
    ["J'atterris, F-GBCD", 'Roger, F-GBCD', "Piste 23, j'atterris, F-GBCD"], MANUEL(154)],
  ['fr', 'Tour 120,100', 'Piste dégagée après l’atterrissage.',
    'F-GBCD, roulez parking aviation générale.', 'Je roule parking aviation générale, F-GBCD',
    ['Roger, F-GBCD', 'Parking, F-GBCD', "Je roule point d'attente piste 33, F-GBCD"], MANUEL(160)],

  ['en', 'Tower 118.700', 'Departure from Saint-Exémery to Montrouvel. At the apron, you requested taxi.',
    'F-GBCD, taxi holding point runway 24 via Alfa.', 'Taxiing holding point runway 24 via Alfa, F-GBCD',
    ['Roger, F-GBCD', 'Taxiing, F-GBCD', 'Taxiing holding point runway 42 via Alfa, F-GBCD'], MANUEL(44)],
  ['en', 'Tower 118.700', 'At the holding point, ready for departure.',
    'F-GBCD, line up and wait runway 24.', 'Lining up and waiting runway 24, F-GBCD',
    ['Roger, F-GBCD', 'Lining up runway 24, F-GBCD', 'Runway 24, taking-off, F-GBCD'], MANUEL(53)],
  ['en', 'Tower 118.700', 'Lined up runway 24.',
    'F-GBCD, runway 24, cleared for take-off, wind 260 degrees 8 knots.', 'Runway 24, taking-off, F-GBCD',
    ['Roger, F-GBCD', 'Taking-off, F-GBCD', 'Runway 42, taking-off, F-GBCD'], MANUEL(59)],
  ['en', 'Tower 118.700', 'Initial climb.',
    'F-GBCD, squawk 7021.', 'Squawk 7021, F-GBCD',
    ['Roger, F-GBCD', 'Squawk, F-GBCD', 'Squawk 7012, F-GBCD'], MANUEL(186)],
  ['en', 'Tower 118.700', 'Leaving the Saint-Exémery zone.',
    'F-GBCD, contact Info 125.700.', 'Info 125.700, F-GBCD',
    ['Good day, F-GBCD', 'Roger, F-GBCD', 'Info 127.500, F-GBCD'], `${MANUEL(15)} ; ${MANUEL(182)}`],
  ['en', 'Info 125.700', 'Cruising with the flight information service.',
    'F-GBCD, report abeam Castelnaudary airfield.', 'Reporting abeam Castelnaudary airfield, F-GBCD',
    ['Roger, F-GBCD', 'Abeam Castelnaudary, F-GBCD', 'Wilco, F-GBCD'], `${MANUEL(87)} ; ${MANUEL(149)}`],
  ['en', 'Info 125.700', 'Cruising. The flight information service passes you some information.',
    'F-GBCD, pilot reports bad weather conditions in the vicinity of Montauban.', 'Roger, F-GBCD',
    ['Affirm, F-GBCD', 'Negative, F-GBCD', 'Reporting Montauban, F-GBCD'], `${MANUEL(209)} ; ${SERA('SERA.14045, tableau S14-4')} (ROGER: I have received)`],
  ['en', 'Info 125.700', 'Approaching a control zone you want to cross.',
    'F-GBCD, contact Tower 119.500.', 'Tower 119.500, F-GBCD',
    ['Good day, F-GBCD', 'Roger, F-GBCD', 'Tower 115.900, F-GBCD'], `${MANUEL(15)} ; ${MANUEL(182)}`],
  ['en', 'Tower 119.500', 'You want to cross the zone at 2000 feet, from W H to E N; you estimate W at 52.', '',
    'Tower, F-GBCD, request VFR transit, 2000 feet from W H to E N, estimating W at 52',
    ['Tower, F-GBCD, crossing the zone', 'F-GBCD, request transit', 'Tower, F-GBCD, transit at 2000 feet, roger'], MANUEL(178), 'What is your request?'],
  ['en', 'Tower 119.500', 'You requested a transit.',
    'F-GBCD, transit via W H, W D, then E N, maintain 2000 feet and report before W D.',
    'Roger, transiting via W H, W D, then E N, maintaining 2000 feet, calling back before W D, F-GBCD',
    ['Roger, F-GBCD', 'Transiting via W H, W D, then E N, F-GBCD', 'Transiting via W H, W D, then E N, maintaining 3000 feet, calling back before W D, F-GBCD'], MANUEL(178)],
  ['en', 'Tower 119.500', 'The departing traffic has passed.',
    'F-GBCD, continue transit E N, report E N to leave.', 'Continuing transit E N, reporting E N to leave, F-GBCD',
    ['Roger, F-GBCD', 'Continuing, F-GBCD', 'Continuing transit W D, reporting W D to leave, F-GBCD'], MANUEL(179)],
  ['en', 'Tower 120.100', 'Arriving at Montrouvel: DR400, 1500 feet, estimating point E at 05, ATIS "Kilo" received. Contact established ("F-GBCD, good morning, pass your message").', '',
    'F-GBCD, DR400, VFR from Saint-Exémery to Montrouvel for landing, 1500 feet, estimate E at 05, information Kilo',
    ['F-GBCD, coming to land at Montrouvel', 'F-GBCD, information Kilo, 1500 feet, DR400', 'F-GBCD, DR400, VFR from Saint-Exémery to Montrouvel for landing'], MANUEL(149), 'Which message do you send?'],
  ['en', 'Tower 120.100', 'You passed your arrival message.',
    'F-GBCD, roger, report E.', 'Reporting E, F-GBCD',
    ['Roger, F-GBCD', 'E, F-GBCD', 'Reporting downwind, F-GBCD'], MANUEL(149)],
  ['en', 'Tower 120.100', 'Passing point E ("Montrouvel Tower, F-GBCD, passing E").',
    'F-GBCD, join right-hand downwind runway 33, report downwind.', 'Reporting right-hand downwind runway 33, F-GBCD',
    ['Roger, F-GBCD', 'Downwind, F-GBCD', 'Reporting left-hand downwind runway 33, F-GBCD'], MANUEL(149)],
  ['en', 'Tower 120.100', 'Right-hand downwind runway 33, a Cessna is on base.',
    'F-GBCD, number 2, follow Cessna 172 on base, report right-hand base runway 33.', 'Number 2, traffic in sight, reporting right-hand base runway 33, F-GBCD',
    ['Number 2, F-GBCD', 'Roger, wilco, F-GBCD', 'Number 3, traffic in sight, reporting right-hand base runway 33, F-GBCD'], MANUEL(151)],
  ['en', 'Tower 120.100', 'Right-hand base runway 33.',
    'F-GBCD, report final runway 33.', 'Reporting final runway 33, F-GBCD',
    ['Roger, F-GBCD', 'Final, F-GBCD', 'Reporting base runway 33, F-GBCD'], MANUEL(151)],
  ['en', 'Tower 120.100', 'On final runway 33.',
    'F-GBCD, runway 33, cleared to land, wind 350 degrees 10 knots.', 'Runway 33, landing, F-GBCD',
    ['Roger, F-GBCD', 'Landing, F-GBCD', 'Runway 23, landing, F-GBCD'], MANUEL(154)],
  ['en', 'Tower 120.100', 'Runway vacated after landing.',
    'F-GBCD, taxi general aviation apron.', 'Taxiing general aviation apron, F-GBCD',
    ['Roger, F-GBCD', 'Apron, F-GBCD', 'Taxiing holding point runway 33, F-GBCD'], MANUEL(160)],
];
const navCount = { fr: 0, en: 0 };
QUESTIONS.push(...NAV.map(([lang, st, ctx, atc, ans, wrong, src, q]) => ({
  cat: 'nav', nav: ++navCount[lang], dest: /1[12]0[,.]100/.test(st), lang, regle: 'vfr', st, ctx, atc,
  ...(q ? { q, qcmOnly: true } : {}), answers: [ans], wrong, src,
})));

// Vol de nuit. Nuit aéronautique : de la fin du crépuscule civil du soir au début du crépuscule civil du matin (soleil
// à 6° sous l'horizon) ; conditions du VFR de nuit : SERA.5005 c). Avec un terrain réel, ces questions sont proposées en
// tête de série quand il fait nuit au terrain (calcul de la hauteur du soleil, realism.js).
SUJETS.nuit = 'Vol de nuit (VFR de nuit)';
const VAC_TXT = (icao, p) => `Carte VAC ${icao}, AD 2 ${icao} ${p} (SIA, AIRAC 29/10/2026)`;
QUESTIONS.push(
  { cat: 'nuit', lang: 'fr', regle: 'vfr', qcmOnly: true, atc: '', ctx: 'Le soleil vient de passer sous l’horizon.',
    q: 'Quand commence la nuit aéronautique ?', answers: ['À la fin du crépuscule civil : centre du soleil à 6° sous l’horizon'],
    wrong: ['Au coucher du soleil', 'À 20 heures locales', 'Quand le soleil est à 12° sous l’horizon'], src: SERA('article 2, définition de « nuit »') },
  { cat: 'nuit', lang: 'en', regle: 'vfr', qcmOnly: true, atc: '', ctx: 'The sun has just set.',
    q: 'When does night begin?', answers: ['At the end of evening civil twilight: centre of the sun 6° below the horizon'],
    wrong: ['At sunset', 'At 8 pm local time', 'When the sun is 12° below the horizon'], src: SERA('article 2, définition de « nuit »') },
  { cat: 'nuit', lang: 'fr', regle: 'vfr', qcmOnly: true, atc: '', ctx: 'Il fait nuit. Vous allez quitter les abords de l’aérodrome en VFR de nuit.',
    q: 'Que devez-vous avoir fait avant le départ ?', answers: ['Déposé un plan de vol'],
    wrong: ['Rien de particulier en VFR', 'Prévenu la Tour par téléphone', 'Affiché 7000 au transpondeur'], src: SERA('SERA.5005 c) 1)') },
  { cat: 'nuit', lang: 'en', regle: 'vfr', qcmOnly: true, atc: '', ctx: 'It is night. You are going to leave the vicinity of the aerodrome under night VFR.',
    q: 'What must you have done before departure?', answers: ['Submitted a flight plan'],
    wrong: ['Nothing special under VFR', 'Phoned the Tower', 'Selected squawk 7000'], src: SERA('SERA.5005 c) 1)') },
  { cat: 'nuit', lang: 'fr', regle: 'vfr', qcmOnly: true, atc: '', ctx: 'Préparation d’un vol VFR de nuit.',
    q: 'Quel plafond minimal faut-il en VFR de nuit ?', answers: ['450 m (1 500 ft)'],
    wrong: ['300 m (1 000 ft)', '600 m (2 000 ft)', 'Aucun : seule la visibilité compte'], src: SERA('SERA.5005 c) 3) i)') },
  { cat: 'nuit', lang: 'en', regle: 'vfr', qcmOnly: true, atc: '', ctx: 'Planning a night VFR flight.',
    q: 'What is the minimum ceiling for night VFR?', answers: ['450 m (1,500 ft)'],
    wrong: ['300 m (1,000 ft)', '600 m (2,000 ft)', 'None: only visibility matters'], src: SERA('SERA.5005 c) 3) i)') },
  { cat: 'nuit', lang: 'fr', regle: 'vfr', qcmOnly: true, atc: '', ctx: 'VFR de nuit en croisière, hors région montagneuse, sans altitude minimale fixée par l’État.',
    q: 'À quelle hauteur minimale volez-vous ?', answers: ['300 m (1 000 ft) au-dessus de l’obstacle le plus élevé dans un rayon de 8 km'],
    wrong: ['150 m (500 ft) au-dessus du sol', '600 m (2 000 ft) au-dessus de l’obstacle le plus élevé dans un rayon de 8 km', '300 m (1 000 ft) au-dessus du sol sous l’avion'],
    src: SERA('SERA.5005 c) 5) ii)') },
  { cat: 'nuit', lang: 'en', regle: 'vfr', qcmOnly: true, atc: '', ctx: 'Night VFR cruise, not over high terrain, no minimum altitude set by the State.',
    q: 'What is your minimum height?', answers: ['300 m (1,000 ft) above the highest obstacle within 8 km'],
    wrong: ['150 m (500 ft) above the ground', '600 m (2,000 ft) above the highest obstacle within 8 km', '300 m (1,000 ft) above the ground below the aircraft'],
    src: SERA('SERA.5005 c) 5) ii)') },
  { cat: 'nuit', lang: 'fr', regle: 'vfr', qcmOnly: true, atc: '', terrain: 'LFBT', ctx: 'Tarbes-Lourdes-Pyrénées, de nuit (VAC, « VFR de nuit »).',
    q: 'Qu’interdit la carte VAC de Tarbes de nuit (sauf pilotes et organismes cités) ?', answers: ['L’atterrissage piste 02 et le décollage piste 20'],
    wrong: ['Tout atterrissage', 'Le décollage piste 02 et l’atterrissage piste 20', 'Le tour de piste main gauche'], src: VAC_TXT('LFBT', 'TXT 01') },
);
