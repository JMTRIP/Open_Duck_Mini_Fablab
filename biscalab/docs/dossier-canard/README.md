# Dossier Canard BiscaLab (v1.2)

Dossier de travail du projet Open Duck Mini V2 au BiscaLab : cours, glossaire, pages opérationnelles.
Tout tient dans une seule page web, `index.html`.

## Comment le lire

### En ligne, depuis GitHub (recommandé)

C'est toujours la dernière version poussée sur la branche `v2`, la même pour tout le monde :

<https://raw.githack.com/JMTRIP/Open_Duck_Mini_Fablab/v2/biscalab/docs/dossier-canard/index.html>

Cliquer sur le lien (dans VS Code : **Ctrl + clic**), ou le copier dans la barre d'adresse du navigateur.

Le service *raw.githack.com* se contente d'afficher le fichier `index.html` du dépôt GitHub comme une
vraie page web. Après un `git push`, la nouvelle version apparaît en quelques minutes. Quand GitHub
Pages sera activé sur le dépôt (voir plus bas), l'adresse définitive sera :
<https://jmtrip.github.io/Open_Duck_Mini_Fablab/biscalab/docs/dossier-canard/>

### Hors ligne, depuis une copie sur l'ordinateur

Clic droit sur `index.html` → *Ouvrir avec* → choisir un
navigateur (Chrome, Edge, Firefox, Safari). Un double-clic peut ouvrir le fichier dans un éditeur de
code au lieu du navigateur : on voit alors du code au lieu de la page, c'est normal, il faut passer
par *Ouvrir avec*.

Les polices de caractères demandent une connexion internet ; sans connexion la page reste lisible,
avec une police de remplacement.

## Pour l'administrateur du dépôt : activer GitHub Pages

Sur GitHub : *Settings* → *Pages* → *Build and deployment* → *Source* : **Deploy from a branch**,
branche **v2**, dossier **/ (root)**, puis *Save*. Quelques minutes plus tard, le lien ci-dessus
fonctionne et la page devient installable sur téléphone (« Ajouter à l'écran d'accueil »).

Le mode « application installable » (PWA : `manifest.webmanifest`, `sw.js`, `icons/`) ne fonctionne
que depuis une adresse HTTPS comme celle-là, pas depuis un fichier ouvert sur le disque.
