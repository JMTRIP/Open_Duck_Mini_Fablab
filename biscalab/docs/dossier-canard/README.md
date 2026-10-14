# Dossier Canard BiscaLab (v1.2)

Dossier de travail du projet Open Duck Mini V2 au BiscaLab : cours, glossaire, pages opérationnelles.
Tout tient dans une seule page web, `index.html`.

## Comment le lire

**Sur un PC Windows (le plus simple) :** double-cliquer sur `Ouvrir-le-dossier-Canard.cmd`.
Il ouvre la page dans Chrome (ou Edge, ou Firefox). Il ne modifie rien sur l'ordinateur.

**Autre méthode (Windows, Mac, Linux) :** clic droit sur `index.html` → *Ouvrir avec* → choisir un
navigateur (Chrome, Edge, Firefox, Safari). Un double-clic peut ouvrir le fichier dans un éditeur de
code au lieu du navigateur : on voit alors du code au lieu de la page, c'est normal, il faut passer
par *Ouvrir avec*.

**En ligne (quand GitHub Pages sera activé sur le dépôt) :**
<https://jmtrip.github.io/Open_Duck_Mini_Fablab/biscalab/docs/dossier-canard/>

Les polices de caractères demandent une connexion internet ; sans connexion la page reste lisible,
avec une police de remplacement.

## Pour l'administrateur du dépôt : activer GitHub Pages

Sur GitHub : *Settings* → *Pages* → *Build and deployment* → *Source* : **Deploy from a branch**,
branche **v2**, dossier **/ (root)**, puis *Save*. Quelques minutes plus tard, le lien ci-dessus
fonctionne et la page devient installable sur téléphone (« Ajouter à l'écran d'accueil »).

Le mode « application installable » (PWA : `manifest.webmanifest`, `sw.js`, `icons/`) ne fonctionne
que depuis une adresse HTTPS comme celle-là, pas depuis un fichier ouvert sur le disque.
