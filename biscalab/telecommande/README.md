# Télécommande du canard

Appli de pilotage sur téléphone qui remplace la manette Xbox du projet d'origine.

| Fichier | Contenu |
| --- | --- |
| `cahier-des-charges.md` | Besoins, architecture et marche à suivre en 11 étapes |
| `protocole.md` | Messages échangés entre le téléphone et le canard |
| `serveur/` | Serveur de commande (Python, aiohttp) avec un faux canard ou le canard virtuel MuJoCo |
| `appli-react/` | Appli de pilotage « radar néon » (React, Vite, Tailwind, Framer Motion), en paysage |
| `appli/` | Première appli de pilotage (page web sans dépendance), gardée en secours |
| `pi/` | Installation sur le Pi du canard : service au démarrage, réseau Wi-Fi « Canard-BiscaLab » |
| `essais/` | Essais de l'appli au doigt (Playwright, Chrome et Safari) |

Tout ce qui concerne la télécommande est dans ce dossier : https://github.com/JMTRIP/Open_Duck_Mini_Fablab/tree/v2/biscalab/telecommande

## État

Étapes 1 à 3 du cahier des charges : prototype qui tourne sur un PC ou sur le Pi, avec un canard simulé. Le Pi peut créer son propre réseau Wi-Fi et servir l'appli à tous les téléphones (voir [`pi/README.md`](pi/README.md), premier essai sur le Zero 2 W en novembre 2026). Pas encore de HTTPS ni de vrai canard.

## Sur le Pi du canard

Hors de la maison, le Pi crée le réseau **Canard-BiscaLab** : on s'y connecte avec le téléphone, puis on ouvre **http://10.42.0.1**. Installation, mise à jour et bascule entre le Wi-Fi maison et le réseau du canard : [`pi/README.md`](pi/README.md).

## Lancer le prototype

```
python -m venv .venv
.venv\Scripts\pip install -r serveur/requirements.txt      (Windows)
.venv/bin/pip install -r serveur/requirements.txt          (Pi, Linux)
python serveur/canard_serveur.py --port 8080
```

Le serveur affiche l'adresse à ouvrir sur le téléphone (même Wi-Fi) et le code administrateur. Le code peut être fixé avec `--code-admin` ou la variable `CANARD_CODE_ADMIN`.

Avec `--mujoco`, le faux canard est remplacé par le canard virtuel (simulation MuJoCo de la politique de marche ONNX, fenêtre 3D).

## Appli React

```
cd appli-react
npm install
npm run build          (crée appli-react/dist)
```

Le serveur sert `appli-react/dist` dès qu'elle existe, sinon l'ancienne appli. Pour choisir : `--appli react`, `--appli classique` ou `--appli <dossier>`.

Pour modifier l'appli avec rechargement immédiat : lancer le serveur, puis `npm run dev` dans `appli-react` (le WebSocket `/ws` est relayé vers le port 8080).

Le Pi n'a pas besoin de Node : seul le dossier `dist` construit sur un PC lui est utile.

Ce qu'elle fait de plus que la première :

- pas de bouton Marche : le canard part dès qu'on pousse un joystick et se pose 2 s après qu'on les a lâchés ; après un STOP (ou une coupure, un changement de pilote, une chute), il faut lâcher les joysticks puis les repousser ; un voyant au-dessus du STOP dit où on en est (PRÊT, EN MARCHE, STOP · lâche les joysticks…) ;
- paysage obligatoire (plein écran et orientation verrouillée sur Android, message « tourne ton téléphone » sinon) ;
- pensée pour l'extérieur : textes de 15 à 22 en gras, couleurs saturées, contrastes forts, et un bouton « plein soleil » (fond noir uni, décor retiré, contraste poussé) ;
- radar rectangulaire centré sur le canard : trajet (en simulation), flèche de consigne, arc de rotation, grille de 50 cm ;
- joysticks en métal avec retour au centre en ressort, flèches qui s'allument dans le sens poussé ;
- accessoires en grands pavés sous les joysticks (phare, antennes, coin-coin, turbo à maintenir), pleins de couleur quand ils sont en marche ;
- STOP toujours au-dessus de tout, même panneau de réglages ou dialogue ouvert ;
- au clavier pour essayer sur un ordinateur : Échap ou Espace = STOP, flèches = piloter, Maj = turbo.

### Téléphones compatibles

Garanti sur iPhone sous iOS 16.4 ou plus et Android avec Chrome 111 ou plus (exigence de Tailwind 4) ; le code est aussi ramené à iOS 15 et Chrome 99, qui devraient afficher l'essentiel sans garantie. La scène est dessinée en 932 × 430 et mise à l'échelle dans la zone sûre de l'écran (encoche comprise) ; vérifié sous Chrome et WebKit de 667 × 375 (iPhone SE) à 1024 × 768 (tablette).

- Android : plein écran et paysage verrouillé au démarrage.
- iPhone : Safari ne permet ni le plein écran ni le verrouillage du paysage. Pour une vraie appli plein écran, « Partager », puis « Sur l'écran d'accueil » (l'appli le rappelle). Le zoom par pincement et le défilement de la page sont bloqués à la main, Safari ignorant `user-scalable=no`. Pas de vibration sur iPhone, mais un petit retour haptique sous iOS 18 et plus.

Le balayage du radar et le bouton « Entrer » à bords lumineux de l'accueil sont adaptés de deux composants de 21st.dev (« Radar Effect » d'Aceternity, « Cyber Button » de @jahed).

## Tester

`python serveur/test_serveur.py` vérifie le jeton, la marche à l'homme mort (départ au joystick, repos à 2 s, verrou après un STOP), le STOP, le chien de garde (pause à 1 s, jeton libéré à 3 s), la reconnexion et les messages invalides, sans matériel (39 vérifications, une vingtaine de secondes).

Les essais de l'appli au doigt, dans Chrome et Safari simulés, sont dans [`essais/`](essais/README.md).
