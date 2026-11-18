# Entraînement phraséo (VFR / IFR · FR / EN)

Site statique d'entraînement à la phraséologie aéronautique, 3 modes :
- **QCM** — choisir le bon collationnement / la bonne réponse ;
- **Écrit** — taper son collationnement, corrigé automatiquement (indicatif, nombres exacts, ≥ 85 % des mots) ;
- **Oral** — parler au micro (reconnaissance vocale du navigateur : **Chrome ou Edge**), le bouton 🔊 lit le message ATC.

## Sources
Phraséologie issue de : OACI Doc 9432 (Manuel de radiotéléphonie), Doc 4444 (PANS-ATM), Doc 8168,
Règlement (UE) 923/2012 SERA Section 14 + AMC/GM, Manuel de phraséologie DGAC/DSNA.
Chaque exercice indique sa source. Indicatif, aérodromes, fréquences et points de report sont fictifs.
**Outil d'entraînement : seuls les documents officiels en vigueur font foi.**

## Ajouter des exercices
Éditer `data.js` (le format est décrit en haut du fichier), puis vérifier : `node test.js`.

## Mise en ligne sur GitHub Pages
1. Créer un dépôt sur github.com et y pousser ces fichiers.
2. Settings → Pages → Source : *Deploy from a branch*, branche `main`, dossier `/ (root)`.
3. Le site est en ligne sur `https://<utilisateur>.github.io/<dépôt>/` (HTTPS requis pour le micro).
