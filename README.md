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
- **📻 ATIS réel** (avec un terrain réel) : la série commence par l'ATIS du moment, mis en forme à partir du dernier
  METAR selon le modèle du manuel DSNA (p. 214-218 : lettre, heure, piste, vent et rafales, visibilité ou CAVOK, temps
  présent, nuages, température, QNH, NOSIG) ; si le METAR contient un élément sans formulation dans le manuel (vent
  variable, RVR…), pas d'ATIS. Fréquences ATIS de l'AIP.
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
- **🗺️ Terrain réel** (Pau, Biarritz, Tarbes, Lyon-Bron, Nantes) : nom radio, pistes et fréquences Tour / Sol de l'AIP
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
