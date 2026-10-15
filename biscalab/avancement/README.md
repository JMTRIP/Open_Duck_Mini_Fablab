# Avancement des tâches

Un enregistrement par changement d'avancement d'une tâche du planning ou d'une liste de contrôle de la page. `tache` = identifiant de la case (p1.3, m.4, b.2, c.6…) ; `avancement` = 0, 25, 50, 75 ou 100 (100 = fait) ; `fait` = oui ou non (déduit, gardé pour lisibilité). Le pourcentage d'une phase est la moyenne de ses tâches ; les phases avancent indépendamment. Certaines tâches se calculent d'elles-mêmes depuis les autres registres (pièces imprimées, commande reçue, mesures notées, fiche de test GO) ; un enregistrement manuel ici ne peut que les augmenter. Pour cocher plusieurs tâches d'un coup, préférer l'enregistrement d'une séance (champ `taches`).

Chaque fichier de ce dossier est **un enregistrement**, créé depuis la page du dossier Canard (bouton « Enregistrer… ») : la page prépare le fichier et ouvre l'éditeur GitHub déjà rempli ; il ne reste qu'à cliquer *Commit changes*. On peut aussi l'écrire à la main en respectant le modèle ci-dessous. Le nom du fichier commence toujours par la date (AAAA-MM-JJ). Pour corriger, on ré-enregistre depuis la page (bouton « Modifier ») : le fichier le plus récent sur le même objet l'emporte. Ce README n'est pas lu par la page.

## Modèle

```
---
type: tache
tache: p1.3
avancement: 100
fait: oui
date: 2026-10-22
par: Jean-Marie
---
Registre initialisé.
```
