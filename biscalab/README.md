# biscalab/ — tout ce qui est à nous

Ce dossier est le seul endroit du dépôt où le BiscaLab écrit. Le reste du dépôt appartient au projet d'origine (Antoine Pirrone) et ne se modifie jamais.

| Dossier ou fichier | Contenu | Qui l'écrit |
|---|---|---|
| `docs/dossier-canard/` | Le dossier de travail (page web, cours, tableau de bord) et ses sources | la page se construit avec `build.py` |
| `docs/recherche/` | Les rapports de recherche dont le dossier est tiré | archives |
| `journal/` | Une entrée par séance | la page (bouton « Nouvelle séance ») |
| `tests/` | Les fiches de test, dont les GO / NO-GO de phase | la page |
| `achats/` | Une entrée par commande | la page |
| `pieces/` | Le registre des pièces : un enregistrement par exemplaire et par changement d'état | la page |
| `mesures/` | Masses, offsets, courants, tensions… | la page |
| `decisions/` | Décisions prises et à trancher | la page |
| `avancement/` | Les cases cochées du planning et des listes de contrôle | la page |
| `equipe/` | Les rôles : un enregistrement par attribution, le dernier l'emporte | la page (bouton « Attribuer les rôles ») |

Chaque enregistrement est un petit fichier texte avec un en-tête `clé: valeur` entre deux lignes `---` (le modèle est dans le README de chaque dossier). La page lit ces fichiers et calcule l'état du projet ; elle ne modifie jamais rien elle-même : c'est toujours quelqu'un qui clique « Commit ». On ne retouche pas un enregistrement : on en crée un nouveau sur le même objet (bouton « Modifier » de la page, formulaire pré-rempli) et le plus récent l'emporte ; les anciens restent, c'est l'historique.
