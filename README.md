# Entraînement phraséo (VFR / IFR · FR / EN)

👉 **Accéder au site : https://cyprien64.github.io/phraseo/**

Site statique d'entraînement à la phraséologie aéronautique, 3 modes :
- **QCM** — choisir le bon collationnement / la bonne réponse ; les choix faux sont des pièges fabriqués à partir de
  la bonne réponse (chiffres inversés, gauche/droite, élément oublié, indicatif d'un autre avion) ;
- **Écrit** — taper son collationnement, corrigé automatiquement (indicatif, nombres et mots clés exacts — gauche/droite, avant/après, numéro… —, ≥ 90 % des mots) ;
- **Oral** — parler au micro (reconnaissance vocale du navigateur : **Chrome ou Edge**), le bouton 🔊 lit le message ATC.

Options : **Écoute seule** (le message ATC est masqué et lu à voix haute, comme à la radio),
**Vol complet** (exercices dans l'ordre d'un vol : Sol → Tour → Info/Approche → atterrissage),
thème **Alphabet OACI**.

Sujets (filtre « Sujet ») : exercices de base, situations au sol (traversée de piste, maintien de position,
alignement conditionnel, annulation de décollage), information de trafic, transit VFR et VFR spécial,
IFR avancé (STAR, attente, approche à vue, approche interrompue ou annulée, contraintes de niveau), ATIS,
urgences et pannes (MAYDAY, PAN PAN, panne d'émission, carburant minimal), expressions conventionnelles,
signaux lumineux, premier appel libre / essai radio / répétitions, **AFIS et auto-information**, **phases particulières**
(repoussage, CTOT, RVSM, faible visibilité, clôture du plan de vol, voltige, largage de parachutistes, péril aviaire),
**navigation VFR complète** (un vol entier enchaîné : roulage, décollage, SIV, transit, arrivée, circuit, atterrissage). Les exercices à plusieurs éléments
n'apparaissent qu'aux niveaux Confirmé, Expert et Expert+.

Réalisme :
- **📡 Fréquence vivante** (Confirmé et au-delà) : avant certains messages, on entend un autre avion échanger avec le
  même poste (clairance et collationnement tirés des exercices vérifiés, autre indicatif, voix de pilote avec le bruit
  du moteur) ; en Expert+, son indicatif ressemble souvent au vôtre.
- **📻 ATIS reconstitué** (avec un terrain réel) : la série commence par un ATIS **reconstitué d'après le METAR officiel**
  — ce n'est pas la diffusion réelle : la lettre d'information est fictive, la piste est celle que choisit le site, et il
  n'y a ni niveau de transition ni consignes locales. Mise en forme selon le manuel DSNA (p. 214-218 : lettre, heure,
  piste, vent et rafales, visibilité ou CAVOK, temps présent, nuages, température, QNH, NOSIG). Si le METAR contient un
  élément sans formulation dans le manuel (vent variable, RVR…), pas d'ATIS. Sur une station automatique, « /// » (type
  de nuage non déterminé) est ignoré et « ///TCU » donne « cumulonimbus bourgeonnant » sans hauteur. La lettre est reprise
  dans les premiers appels de la série, et l'ATIS fictif de Saint-Exémery n'est plus proposé.
- **Terrain réel, détails** : piste préférentielle de l'AIP quand elle est chiffrée (Nantes : piste 03 jusqu'à 5 kt de vent
  arrière, AD 2 LFRS.21) ; sinon piste face au vent. Le roulage se fait sur la fréquence Sol, et les fréquences citées
  dans les messages sont celles de l'AIP.
  - **Cartes VAC du SIA** : vrai sens du tour de piste selon la piste en service (Pau : main gauche en 13, main droite en 31 ;
    Biarritz : droite en 09, gauche en 27 ; Tarbes : gauche ; Lyon-Bron : gauche en 16, droite en 34 ; Nantes : gauche en 03,
    droite en 21), lu sur la carte « Atterrissage à vue » ; vrai point d'entrée à la place du point fictif « E » (Pau : N ou NE
    selon la piste, à 1600 ou 2500 ft comme le prévoit la VAC ; Biarritz, Tarbes, Nantes : E ; Lyon-Bron : MS).
  - **Approche et information de vol réelles** (AD 2.18) : Pyrénées (Pau), Biarritz, Nantes. L'AIP de Tarbes et de Lyon-Bron
    n'en donne pas : elles restent fictives.
  - **Horaires** (AD 2.3) : hors horaires ATS publiés, un avertissement indique qu'en réalité il n'y a pas de contrôle.
  - **Rafales** du METAR dans les clairances : « vent 260 degrés 15 nœuds, rafales 25 nœuds » (Manuel p. 154).
  - **Exercices selon la météo** : visibilité ou plafond bas → VFR spécial ; vent fort → remise de gaz.
- **✈️ Trafic réel** (avec un terrain réel) : GitHub relève toutes les 30 minutes les positions ADS-B publiées par
  The OpenSky Network (opensky-network.org) ; la série propose alors une information de trafic sur les avions réellement
  présents à moins de 15 NM au moment du relevé, vus depuis votre avion qui vient de décoller (« trafic 12 heures,
  2 nautiques, même sens, 1700 pieds plus haut »), sur le modèle du manuel (p. 89-92). OpenSky ne donne pas le type
  d'avion : il est remplacé par « rapide » ou « lent » selon la vitesse. Positions vieilles de 30 minutes au plus ;
  relevé de plus de 2 heures : ignoré ; aucun avion à proximité : pas d'exercice.
- **🧭 Navigations réelles** (sujets dédiés : Pau → Tarbes, Biarritz → Pau, Bordeaux → Agen) : pistes face au vent des
  deux METAR, sortie par le point de la procédure de départ de la VAC, information de vol (SIV), premier contact demandé
  par la VAC d'arrivée (Pau : Pyrénées Information), entrée par le point publié, tour de piste de la VAC. Heure UTC
  simulée et temps de vol à 100 kt entre les points (vol en accéléré) ; à l'heure d'arrivée, Tour fermée signalée.
  De nuit à Tarbes, pas d'atterrissage piste 02 (VAC). METAR sous les minima VFR d'une zone de contrôle : signalé.
- **🌙 Hors horaires ATS** : à Agen, Perpignan et Lyon-Bron, la série passe en auto-information sur la fréquence A/A
  publiée (AD 2.18 / VAC, « FR seulement ») ; Biarritz et Tarbes n'en publient pas : avertissement.
- **🌫️ VFR spécial** : quand le METAR est sous les minima VFR, question « le VFR spécial est-il possible ? » avec les
  minima de la VAC (Pau, Tarbes : avec / sans trafic IFR ; Biarritz : arrivée / départ ; Montpellier) ou de SERA.5010.
- **📵 Panne radio** : conduite publiée sur la VAC du terrain (Pau, Bordeaux, Biarritz, Tarbes, Bron, Perpignan,
  Montpellier, Toulouse).
- **🛫 Départs IFR publiés** : le départ fictif BALSI 6P devient une SID réelle de la piste en service (AD 2.24) ;
  sans SID publiée (Tarbes, Bron, Agen) : exercice écarté.
- **⏸️ Clairance conditionnelle réelle** : si OpenSky voit un avion en courte finale de la piste en service, « derrière le
  trafic en courte finale, alignez-vous et attendez… derrière » (Manuel p. 57-58 ; type d'avion inconnu).
- **🔀 Transit réel** (Bordeaux) : demande et clairance de transit par les itinéraires VFR à double sens de la VAC
  (N, NA/EA, SA/OA, S à 1500 ft selon la piste), sur le modèle du manuel p. 178-179. Pau n'en publie pas.
- **🎙️ Ma voix à la radio** : la réécoute de votre enregistrement passe par le même filtre radio que le contrôleur.
- **⏱ Temps de réaction** (Expert, Expert+, hors QCM et examen) : plus de 10 s entre la fin du message et le début de
  la réponse = « trop tardif » (règle d'entraînement du site, pas une règle officielle).
- **🗺️ Carte des navigations réelles** : terrains, points VAC, route et position simulée de l'avion à chaque message.
- **📲 Application hors ligne** : le site s'installe sur téléphone (« Ajouter à l'écran d'accueil ») et reste utilisable
  sans réseau, avec le dernier METAR (jusqu'à 24 h hors ligne) et les voix déjà téléchargées (sw.js, manifest). La
  reconnaissance vocale du navigateur, elle, a besoin du réseau : hors ligne, utilisez l'écrit ou le QCM.
- **🎤 Alternat sur téléphone** : gros bouton en bas de l'écran, à maintenir pendant qu'on parle (relâcher = fin
  d'émission) ; un appui court garde l'arrêt automatique au silence.
- **🧾 Débriefing du vol** (navigations réelles) : réussite par phase (départ, croisière, arrivée), temps de vol simulé,
  collationnements tardifs, liste des messages ratés et bouton « Refaire les messages ratés ».
- **🗺️ Réussite par terrain réel** dans les statistiques.
- **🌦️ TAF de destination** : avant le départ, la TAF officielle (aviationweather.gov) ; à l'heure d'arrivée estimée,
  prévoit-elle des conditions sous les minima VFR d'une zone de contrôle (durable, TEMPO / PROB, non) ?
- **🔢 QNH en route** : l'information de vol transmet le QNH réel du terrain d'arrivée, à collationner.
- **🧭 Entrée selon la provenance** (Pau, VAC) : arrivée du nord (13 : N à 1600 ft ; 31 : NE à 2500 ft) ou du sud
  (13 : SW ; 31 : S, à 2500 ft), tirée au hasard pour la série.
- **🔁 ATIS en boucle** : l'ATIS reconstitué passe en continu ; on prend l'écoute en cours de message.
- **🛬 Toulouse-Blagnac et Montpellier** : piste du tour de piste de la VAC (14L/32R ; 12L/30R), dite « piste 32 droite »
  / « runway 32 right » (Manuel p. 15).
- **📏 Niveau de transition** : ajouté à l'ATIS reconstitué et aux messages, calculé avec le QNH réel (plus bas niveau
  de vol à au moins 1000 ft au-dessus de l'altitude de transition de 5000 ft, AIP ENR 1.7.2.3 et cartes IAC ; environ
  28 ft par hPa). Le vrai niveau est donné par le contrôle.
- **🛬 Approches IFR publiées** : « approche ILS » devient l'approche réellement publiée pour la piste en service (titre des
  cartes IAC, AD 2.24 : ILS Z 27 à Biarritz, ILS 31 à Pau, RNP 29 à Agen…), avec le LOC de l'AD 2.19 ; pas d'approche
  publiée pour cette piste (Pau 13, Agen 11…) : exercice d'approche écarté.
- **🌙 Nuit aéronautique** : hauteur du soleil calculée au terrain ; sous −6° (fin du crépuscule civil, définition SERA),
  le bandeau l'indique et la série commence par des questions de VFR de nuit (SERA.5005 c)).
- **🆘 Détresse en situation** : MAYDAY depuis le vrai point d'entrée de la VAC sur la fréquence de la Tour, puis
  121,5 MHz si personne ne répond (AIP GEN 3.6.5.3 c)).
- **📻 Fréquence chargée** : plus il y a d'avions relevés à moins de 30 NM, plus on entend d'autres échanges.
  **Transmissions simultanées** (niveau Confirmé et au-dessus) : sifflement d'hétérodyne, message brouillé, on répond
  « Répétez » (SERA tableau S14-4 ; Manuel p. 24). Les émetteurs d'Approche et d'Information sont plus bruités que la
  Tour. En anglais, le gisement horaire se prononce « eleven o'clock » (Manuel p. 13).
- **Contrôleur** : à l'écrit et à l'oral, un collationnement faux reçoit tout de suite « Négatif je répète » et la clairance
  (SERA.14075 d)), la correction détaillée vient après le 2e essai ; en Expert et Expert+, sans réponse au bout de
  10 secondes, le contrôleur vous appelle (« F-CD, Pau Tour », SERA.14055 b)).
- **Accent en anglais** (option) : britannique, américain, écossais, français (une voix française lit l'anglais, comme un
  contrôleur français) ou varié selon le poste.
- **Son radio** : le contrôleur répond après un court délai ; en Expert et Expert+, brèves pertes de signal ; les autres
  avions, plus loin, arrivent plus faibles et plus bruités ; en mode « Pilote fautif », on entend le pilote collationner.
- **⎵ Alternat** (mode oral) : maintenir la barre Espace pour parler, la relâcher pour finir, comme le bouton du manche.
- **QCM en échange radio** : la réponse choisie est « transmise » avec une voix de pilote ; si le collationnement est
  faux, le contrôleur répond « Négatif je répète » suivi de la clairance correcte (SERA.14075 d)).
- **🎲 Valeurs aléatoires** : un indicatif par série (affiché dans le bandeau radio), une piste et des codes
  transpondeur tirés au hasard et gardés pendant toute la série ; le vent tourne avec la piste.
- **🔤 Indicatif abrégé dans mes réponses** (activé par défaut) : dès le 2e message de la série, le contrôleur abrège
  votre indicatif (F-GBCD → F-CD) et la réponse attendue l'utilise aussi. Le premier échange reste complet : le pilote
  n'abrège qu'après le contrôleur (Manuel p. 18, SERA.14055). Sans l'option : abrégé en « Vol complet » après le premier
  échange, de temps en temps sinon. Les deux formes sont acceptées en écrit et à l'oral.
- **📻 Fréquence encombrée** : certains messages sont pour un autre avion, parfois à l'indicatif très proche
  (Manuel p. 24) — il faut cliquer « Pas pour moi ».
- **✂️ Coupures radio** : la fin du message est couverte par le bruit ; il faut demander « Répétez tout après… »
  (SERA.14075 c) 4)), puis collationner le message complet.
- **« Négatif je répète »** (SERA.14075 d)) : après un collationnement faux en écrit/oral, le contrôleur redonne
  la clairance et on peut réessayer (essai non compté).
- **Premier appel libre** : on rédige soi-même la demande ; le site vérifie la présence et l'ordre des éléments
  du modèle du manuel (p. 45 et 149).
- **🗺️ Terrain réel** (Pau, Biarritz, Tarbes, Lyon-Bron, Nantes, Bordeaux, Perpignan, Agen, Toulouse, Montpellier) : nom radio, pistes et fréquences Tour / Sol de l'AIP
  (AD 2, AIRAC du 29/10/2026) ; **météo réelle** : le dernier METAR est affiché, la piste est choisie face au vent, et le
  vent et le QNH des messages sont ceux du METAR (vent variable : vent de l'exercice ; METAR de plus de 3 h : ignoré).
  Les METAR viennent d'aviationweather.gov (NOAA), récupérés par GitHub toutes les 30 minutes (`.github/workflows/pages.yml`).
  Les points de report, l'AFIS et l'ATIS restent fictifs.
- **🕵️ Pilote fautif** (mode) : un pilote collationne, juste ou faux ; il faut dire s'il s'est trompé, puis la correction
  montre l'erreur mot à mot.
- **Accents** : en anglais, à partir du niveau Confirmé, les voix anglaises de différentes régions installées
  sur l'appareil sont utilisées selon le poste.

Voix : **🎙️ Voix réaliste (radio)** (activée par défaut) — voix de synthèse neuronale (modèles Piper : Tom et Siwis en
français ; Alan, Cori et « Northern English Male » en anglais) calculée dans le navigateur (`tts-worker.js`, sans figer la
page), puis passée dans un filtre radio VHF (bande 300–3000 Hz, saturation, compression, souffle et squelch).
Chaque voix est téléchargée une fois (environ 60 Mo) puis gardée par le navigateur ; ensuite, un message est prêt en
1 à 4 secondes. Sans cette option ou hors ligne : voix installées sur l'appareil.
Niveaux : le débit reste celui d'un contrôleur réel (un peu plus posé en Débutant) ; la difficulté vient du souffle et
de la saturation radio, des messages et des pièges. **Débutant** (messages simples), **Confirmé** (messages combinés),
**Expert** (parasites, écoute seule imposée), **Expert+** (parasites forts, messages longs ou combinés seulement,
fréquence encombrée avec indicatifs proches et coupures radio toujours actives).
Les indicatifs sont écrits en lettres (F-GBCD) et prononcés avec l'alphabet d'épellation (Foxtrot Golf Bravo Charlie Delta).
En anglais, les nombres sont énoncés selon le manuel DSNA p. 13-16 (« niner », « level one hundred », « decimal one ») ;
en français, comme dans la vie courante avec « décimale » pour les fréquences (p. 17).

Suivi : les questions ratées reviennent plus souvent et sont regroupées dans **❌ Mes erreurs** ; la correction
écrite/orale montre mot à mot ce qui manque ou est faux (« piste 34 → 43 », « QNH 1013 oublié ») ; **📊 Stats** donne
le taux de réussite par langue, règles et phase de vol. La progression reste enregistrée dans le navigateur de l'appareil.

Apprentissage :
- **🧭 Parcours progressif** : 14 leçons dans l'ordre (alphabet, bases VFR, sol, premier appel… jusqu'aux urgences) ;
  une leçon se débloque à 80 % d'exercices justes dans la précédente.
- **🎓 Examen blanc** : 30 questions en QCM de tous niveaux, 15 minutes, réussite à 80 %, correction détaillée seulement à la fin (format d'entraînement,
  pas le format officiel d'un examen).
- **🏆 Défi du jour** : 10 questions, les mêmes pour tout le monde le même jour ; historique de vos scores.
- **📚 Fiches de cours** : collationnement, forme du collationnement, nombres, indicatifs, ordre des éléments,
  détresse et urgence, répétitions, essai radio, information de trafic, signaux lumineux — chacune avec ses sources.
- **❓ Pourquoi ?** sous chaque correction : les règles qui s'appliquent, avec l'article ou la page, et la fiche liée.
- **📅 À réviser** (répétition espacée) : une question réussie revient après 1, 3, 7 puis 14 jours ; ratée, tout de suite.
- **📝 Dictée** : un message long est lu (texte masqué), on le note en entier, la correction se fait mot à mot.
- **📖 Glossaire FR ⇄ EN** : expressions du manuel, avec recherche et cartes à retourner.
- **🏅 Badges** et **🧭 bilan personnalisé** (après 50 réponses : vos erreurs les plus fréquentes et quoi travailler),
  dans 📊 Stats, avec un bouton **🎯 S'entraîner** qui lance une série ciblée sur l'erreur (QNH, piste, cap…).

Pratique :
- **💾 Exporter / 📂 Importer** la progression (dans 📊 Stats) : un fichier à transférer d'un appareil à l'autre, sans compte.
- **Thème** auto / clair / sombre et **taille du texte** (A− / A+), mémorisés sur l'appareil.
- **🖨️ Imprimer / PDF** : fiches de cours et glossaire, depuis les fenêtres Fiches ou Glossaire.
- **▶️ Ma réponse** (mode oral) : réécouter son propre collationnement à côté du message du contrôleur ;
  l'enregistrement reste dans la page, rien n'est envoyé ni sauvegardé.
- **Accessibilité** : contrastes vérifiés (≥ 4,5:1 en clair et en sombre), navigation au clavier, étiquettes pour
  les lecteurs d'écran, langue de chaque exercice indiquée, animations coupées si le système le demande.

## Sources
Chaque exercice a été vérifié et indique la page ou l'article exact :
- **DSNA – Manuel de phraséologie à l'usage de la circulation aérienne générale**, 10e édition, à jour au 15 avril 2023
  (numéros de page imprimés dans le manuel). Les messages reprennent ses modèles (collationnement « Je roule… »,
  « Piste 24, je décolle », « Transpondeur 7021 »…).
- **Règlement d'exécution (UE) n° 923/2012 (SERA)**, version consolidée EUR-Lex du 1er mai 2025 :
  SERA.8015 e) (collationnement), SERA.13005 (codes 7500/7600/7700), SERA.14020 (alphabet), SERA.14035 (nombres),
  SERA.14045 (expressions conventionnelles), SERA.14055 (indicatifs abrégés), SERA.14095 (détresse et urgence).

- Pour l'AFIS : **Manuel de phraséologie AFIS** de l'UAF & FA (mai 2019), document d'information élaboré avec l'aide
  de la DGAC, **sans valeur juridique** (il le précise lui-même).
- Pour l'auto-information : **arrêté du 12 juillet 2019** (procédures de circulation aérienne pour l'utilisation des
  aérodromes, JORF du 2 août 2019) et **AIP France ENR 1.2** (cycle du 29 octobre 2026). Aucun texte officiel ne fixe
  la formulation exacte des messages d'auto-information : le site interroge donc sur les règles, pas sur des phrases.

Le Doc 9432 de l'OACI (payant) n'a pas été utilisé. Édition du manuel DSNA vérifiée le 19/11/2026 : la 10e reste la plus récente. Hors option « Terrain réel », indicatif, aérodromes, fréquences et points de report sont fictifs.
- Terrains réels : **AIP France, AD 2** de chaque terrain (AD 2.12 pistes, AD 2.18 fréquences), AIRAC du 29 octobre 2026 ;
  METAR : **aviationweather.gov** (NOAA).
**Outil d'entraînement : seuls les documents officiels en vigueur font foi.** Vérifier qu'une édition plus récente
du manuel n'est pas parue (site du SIA ou du ministère).

## Ajouter des exercices
Éditer `data.js` (le format est décrit en haut du fichier), puis vérifier : `node test.js`.

## Mise en ligne sur GitHub Pages
1. Créer un dépôt sur github.com et y pousser ces fichiers.
2. Settings → Pages → Source : *GitHub Actions* (le workflow `.github/workflows/pages.yml` publie le site et les METAR).
3. Le site est en ligne sur `https://<utilisateur>.github.io/<dépôt>/` (HTTPS requis pour le micro).
