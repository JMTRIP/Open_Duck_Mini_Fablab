# Dossier Canard BiscaLab (v1.2)

Dossier de travail du projet Open Duck Mini V2 au BiscaLab : 16 cours, glossaire cliquable, pages
opérationnelles (équipe, dépôt GitHub, CAO, fabrication, nomenclature, électronique, logiciel, marche,
planning, risques). Tout tient dans une seule page web, `index.html`, installable comme une application.

## Comment le lire

### En ligne (recommandé)

Une fois GitHub Pages activé sur le dépôt (voir plus bas), l'adresse est :

<https://jmtrip.github.io/Open_Duck_Mini_Fablab/>

(elle renvoie sur `biscalab/docs/dossier-canard/`). C'est toujours la dernière version poussée sur la
branche `v2`, la même pour tout le monde. Sur téléphone ou tablette, on peut l'installer :
*Partager → Sur l'écran d'accueil* (iPhone/iPad), menu *⋮ → Installer l'application* (Android),
icône *Installer* dans la barre d'adresse (Chrome sur PC).

En attendant l'activation, cette adresse affiche déjà la page (sans le mode « application ») :
<https://raw.githack.com/JMTRIP/Open_Duck_Mini_Fablab/v2/biscalab/docs/dossier-canard/index.html>

### Hors ligne, depuis une copie sur l'ordinateur

Clic droit sur `index.html` → *Ouvrir avec* → un navigateur (Chrome, Edge, Firefox, Safari). Un
double-clic peut ouvrir le fichier dans un éditeur de code au lieu du navigateur : on voit alors du code,
c'est normal, passer par *Ouvrir avec*. Les polices demandent une connexion ; sans elle la page reste
lisible avec une police de remplacement.

## Pour l'administrateur du dépôt (Jean-Marie) : activer GitHub Pages, une fois

Sur GitHub : *Settings* → *Pages* → *Build and deployment* → *Source* : **Deploy from a branch** →
branche **v2**, dossier **/ (root)** → *Save*. Quelques minutes plus tard, l'adresse ci-dessus répond.
Le fichier `.nojekyll` à la racine du dépôt est nécessaire (il évite un traitement inutile de GitHub) ;
le fichier `index.html` à la racine ne fait que rediriger vers ce dossier.

## Ce que contient ce dossier

| Fichier ou dossier | Rôle |
|---|---|
| `index.html` | La page complète, **générée** : ne pas la modifier à la main |
| `manifest.webmanifest`, `sw.js`, `icons/` | Ce qui rend la page installable (application web) |
| `src/` | Les sources : une partie par rubrique (`01-head.html` … `09-footer.html`), le glossaire `terms.json`, les consignes de rédaction des cours et la fiche de faits |
| `build.py` | Assemble `src/` en `index.html` : `python build.py` |
| `mark_terms.py` | Souligne automatiquement la première occurrence de chaque terme du glossaire dans une page |
| `icons.py` | Régénère les icônes |
| `../recherche/` | Les trois rapports de recherche (dépôts et BOM, marche et sim2real, organisation) dont le dossier est tiré |
| `Open_Duck_Mini_Runtime_Fablab.code-workspace` | Espace de travail VS Code ouvrant ce dépôt et celui du code du Pi |

## Modifier le dossier

1. Modifier le fichier concerné dans `src/` (une rubrique = un fichier, un cours = un fichier).
2. Lancer `python build.py` dans ce dossier (Python 3 suffit, aucune bibliothèque à installer).
3. Vérifier `index.html` dans un navigateur, puis commiter `src/` **et** `index.html` ensemble.
4. Pour une nouvelle version : changer `VERSION` dans `build.py` et le libellé « Dossier v… » dans
   `src/02-shell.html`, afin que les téléphones où l'application est installée rechargent la page.

Règles éditoriales (détaillées dans `src/COURS-CONSIGNES.md`) : aucun lien vers l'extérieur, chaque
terme technique expliqué à sa première apparition et balisé `<i class="t" data-t="slug">`, chiffres
uniquement issus de `src/COURS-FAITS.md`.

## Licence

Le projet Open Duck Mini est sous licence Apache-2.0 (© Antoine Pirrone et contributeurs). Ce dossier,
rédigé pour le BiscaLab, est publié sous la même licence.
