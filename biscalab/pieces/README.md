# Registre des pièces

Un enregistrement par exemplaire de pièce et par changement d'état. `piece` = nom du fichier STL sans extension (ou un nom choisi pour une pièce hors plan : gabarit, cale) ; `exemplaire` = numéro (1 à la quantité) ; `statut` vaut a_imprimer, imprimee, controlee, montee ou a_refaire ; `masse_g` = pesée en grammes (facultatif) ; `rev` = amont, b1, b2… Le dernier enregistrement d'un exemplaire fait foi.

Chaque fichier de ce dossier est **un enregistrement**, créé depuis la page du dossier Canard (bouton « Enregistrer… ») : la page prépare le fichier et ouvre l'éditeur GitHub déjà rempli ; il ne reste qu'à cliquer *Commit changes*. On peut aussi l'écrire à la main en respectant le modèle ci-dessous. Le nom du fichier commence toujours par la date (AAAA-MM-JJ). Pour corriger, on ré-enregistre depuis la page (bouton « Modifier ») : le fichier le plus récent sur le même objet l'emporte. Ce README n'est pas lu par la page.

## Modèle

```
---
type: piece
piece: leg_spacer
exemplaire: 1
statut: controlee
masse_g: 9
rev: amont
date: 2026-10-22
par: Fab
---
Plateau plateau-jambes.3mf, PLA 15 %, sans support. Inserts posés.
```
