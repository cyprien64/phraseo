# Entraînement phraséo (VFR / IFR · FR / EN)

👉 **Accéder au site : https://cyprien64.github.io/phraseo/**

Site statique d'entraînement à la phraséologie aéronautique, 3 modes :
- **QCM** — choisir le bon collationnement / la bonne réponse ;
- **Écrit** — taper son collationnement, corrigé automatiquement (indicatif, nombres exacts, ≥ 85 % des mots) ;
- **Oral** — parler au micro (reconnaissance vocale du navigateur : **Chrome ou Edge**), le bouton 🔊 lit le message ATC.

Options : **Écoute seule** (le message ATC est masqué et lu à voix haute, comme à la radio),
**Vol complet** (exercices dans l'ordre d'un vol : Sol → Tour → Info/Approche → atterrissage),
thème **Alphabet OACI**.

Sujets (filtre « Sujet ») : exercices de base, situations au sol (traversée de piste, maintien de position,
alignement conditionnel, annulation de décollage), information de trafic, transit VFR et VFR spécial,
IFR avancé (STAR, attente, approche à vue, approche interrompue ou annulée, contraintes de niveau), ATIS,
urgences et pannes (MAYDAY, PAN PAN, panne d'émission, carburant minimal), expressions conventionnelles,
signaux lumineux. Les exercices à plusieurs éléments n'apparaissent qu'aux niveaux Confirmé et Expert.

Niveaux : **Débutant** (voix lente, messages simples), **Confirmé** (débit normal, souffle radio, messages combinés),
**Expert** (débit de contrôleur, parasites, écoute seule imposée). La voix utilise les voix installées sur l'appareil :
pour une voix plus naturelle, installer une voix « Premium/Améliorée » (macOS : Réglages → Accessibilité → Contenu énoncé).
Les indicatifs sont écrits en lettres (F-GBCD) et prononcés avec l'alphabet d'épellation (Foxtrot Golf Bravo Charlie Delta).
En anglais, les nombres sont énoncés selon le manuel DSNA p. 13-16 (« niner », « level one hundred », « decimal one ») ;
en français, comme dans la vie courante avec « décimale » pour les fréquences (p. 17).

Suivi : les questions ratées reviennent plus souvent et sont regroupées dans **❌ Mes erreurs** ; la correction
écrite/orale montre mot à mot ce qui manque ou est faux (« piste 34 → 43 », « QNH 1013 oublié ») ; **📊 Stats** donne
le taux de réussite par langue, règles et phase de vol. La progression reste enregistrée dans le navigateur de l'appareil.

## Sources
Chaque exercice a été vérifié et indique la page ou l'article exact :
- **DSNA – Manuel de phraséologie à l'usage de la circulation aérienne générale**, 10e édition, à jour au 15 avril 2023
  (numéros de page imprimés dans le manuel). Les messages reprennent ses modèles (collationnement « Je roule… »,
  « Piste 24, je décolle », « Transpondeur 7021 »…).
- **Règlement d'exécution (UE) n° 923/2012 (SERA)**, version consolidée EUR-Lex du 1er mai 2025 :
  SERA.8015 e) (collationnement), SERA.13005 (codes 7500/7600/7700), SERA.14020 (alphabet), SERA.14035 (nombres),
  SERA.14045 (expressions conventionnelles), SERA.14055 (indicatifs abrégés), SERA.14095 (détresse et urgence).

Le Doc 9432 de l'OACI (payant) n'a pas été utilisé. Indicatif, aérodromes, fréquences et points de report sont fictifs.
**Outil d'entraînement : seuls les documents officiels en vigueur font foi.** Vérifier qu'une édition plus récente
du manuel n'est pas parue (site du SIA ou du ministère).

## Ajouter des exercices
Éditer `data.js` (le format est décrit en haut du fichier), puis vérifier : `node test.js`.

## Mise en ligne sur GitHub Pages
1. Créer un dépôt sur github.com et y pousser ces fichiers.
2. Settings → Pages → Source : *Deploy from a branch*, branche `main`, dossier `/ (root)`.
3. Le site est en ligne sur `https://<utilisateur>.github.io/<dépôt>/` (HTTPS requis pour le micro).
