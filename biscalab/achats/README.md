# Achats

Une entrée par commande, créée au moment où elle est passée. `statut` vaut prevu, commande, recu, rembourse ou annule : quand il change, on ré-enregistre l'achat depuis la page avec le **même titre** (bouton « modifier ») : le fichier le plus récent l'emporte, l'achat n'est compté qu'une fois. `servos` = nombre de STS3215 dans la commande (compteur du tableau de bord). Les factures vont sur le Nextcloud, jamais ici.

Chaque fichier de ce dossier est **un enregistrement**, créé depuis la page du dossier Canard (bouton « Enregistrer… ») : la page prépare le fichier et ouvre l'éditeur GitHub déjà rempli ; il ne reste qu'à cliquer *Commit changes*. On peut aussi l'écrire à la main en respectant le modèle ci-dessous. Le nom du fichier commence toujours par la date et l'heure (AAAA-MM-JJ-HHMM). Pour corriger ou changer le statut, on ré-enregistre depuis la page (bouton « Modifier », formulaire pré-rempli) : même titre, nouveau fichier, et le plus récent l'emporte. Ce README n'est pas lu par la page.

## Modèle

```
---
type: achat
titre: Filament PLA, inserts M3, roulements
fournisseur: Prusa + Amazon.fr
montant: 58,40
phase: 1
statut: commande
servos: 0
date: 2026-10-20
par: Jean-Marie
---
- 1 × Prusament PLA 1 kg
- 1 × lot de 100 inserts M3
- 1 × lot de 10 roulements 608ZZ
```
