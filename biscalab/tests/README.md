# Fiches de test

Une fiche par essai. Le critère de réussite est chiffré et écrit avant l'essai. `resultat` vaut GO, NO-GO ou PARTIEL (ou reste vide tant que l'essai n'est pas fait). La fiche GO d'une phase marquée GO / NO-GO ouvre la phase suivante.

Chaque fichier de ce dossier est **un enregistrement**, créé depuis la page du dossier Canard (bouton « Enregistrer… ») : la page prépare le fichier et ouvre l'éditeur GitHub déjà rempli ; il ne reste qu'à cliquer *Commit changes*. On peut aussi l'écrire à la main en respectant le modèle ci-dessous. Le nom du fichier commence toujours par la date et l'heure (AAAA-MM-JJ-HHMM). Pour corriger ou changer le statut, on ré-enregistre depuis la page (bouton « Modifier », formulaire pré-rempli) : même titre, nouveau fichier, et le plus récent l'emporte. Ce README n'est pas lu par la page.

## Modèle

```
---
type: test
titre: Banc servo : bus et IMU
phase: 2
resultat: GO
date: 2026-11-20
par: Laurent
---
## Objectif
…

## Montage
…

## Procédure
…

## Critère de réussite
…

## Résultat
…

## Décision
…
```
