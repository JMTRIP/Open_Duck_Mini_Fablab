# Décisions

Une décision = un titre, un statut (prise, a-trancher, annulee) et trois paragraphes. Une décision « a-trancher » s'affiche sur le tableau de bord ; quand elle est prise, on la ré-enregistre depuis la page (bouton « Modifier ») avec le **même titre** et le statut `prise` : le fichier le plus récent l'emporte.

Chaque fichier de ce dossier est **un enregistrement**, créé depuis la page du dossier Canard (bouton « Enregistrer… ») : la page prépare le fichier et ouvre l'éditeur GitHub déjà rempli ; il ne reste qu'à cliquer *Commit changes*. On peut aussi l'écrire à la main en respectant le modèle ci-dessous. Le nom du fichier commence toujours par la date et l'heure (AAAA-MM-JJ-HHMM). Pour corriger ou changer le statut, on ré-enregistre depuis la page (bouton « Modifier », formulaire pré-rempli) : même titre, nouveau fichier, et le plus récent l'emporte. Ce README n'est pas lu par la page.

## Modèle

```
---
type: decision
titre: Chargeur 2S
statut: a-trancher
date: 2026-10-22
par: Laurent
---
## Contexte
…

## Décision
…

## Conséquences
…
```
