# Appli de pilotage du canard — cahier des charges et marche à suivre

Projet BiscaLab Open Duck Mini V2. Version 0.1 du 3 novembre 2026, rédigée avec Laurent. À relire au club avant le développement.

## 1. Objectif

Remplacer la manette Xbox Bluetooth prévue dans le projet d'origine par une application sur téléphone, en Wi-Fi, qui soit :

- simple pour les enfants et pour les membres peu à l'aise avec l'informatique ;
- complète pour les membres expérimentés, qui doivent pouvoir faire les réglages ;
- utilisable en extérieur, sans box ni internet, jusqu'à environ 10 mètres ;
- partageable entre plusieurs téléphones, avec un seul pilote à la fois ;
- ouverte à la commande vocale, aux phrases dites par le canard et, plus tard, à une IA.

## 2. Architecture générale

- **Le Pi Zero 2 W du canard** crée son propre réseau Wi-Fi (point d'accès), fait tourner un serveur de commande et, plus tard, la boucle de marche du Runtime.
- **Le téléphone** fait tourner l'appli, une PWA (page web installable comme une appli, en plein écran).
- **Le VPS du club** héberge et met à jour l'appli. Une fois installée, elle reste en cache sur le téléphone et fonctionne sans internet.
- **Le lien téléphone ↔ Pi** passe par WebSocket sécurisé (wss) sur le Wi-Fi du canard.
- **Le serveur de commande remplace la lecture de la manette** dans le Runtime : il fournit les mêmes consignes (vitesse avant, pas de côté, rotation, boutons).

Point important : une page sécurisée (HTTPS) n'a pas le droit de parler à une adresse non sécurisée. Le Pi doit donc lui aussi avoir une adresse sécurisée avec un vrai certificat (voir étape 7).

## 3. Cahier des charges fonctionnel

### 3.1 Trois modes d'utilisation

- **Mode enfant** : un gros joystick, une vitesse bridée (par exemple 50 % du maximum), un énorme bouton STOP, des boutons ludiques (antennes, sons, phrases). Aucun réglage accessible.
- **Mode membre** : pilotage complet (avance, pas de côté, rotation, tête si activée), état du canard (batterie, températures, connexion), prise et cession du jeton de pilote, phrases.
- **Mode expert**, protégé par un code : réglages (vitesse maximale, fréquence de pas, offsets, gains, options d'expression du fichier `duck_config.json`), journaux, mesures, gestion de la bibliothèque de phrases, mode administrateur du jeton.

### 3.2 Pilotage

- Joystick tactile virtuel pour avancer/reculer et faire des pas de côté ; second contrôle (ou glissière) pour la rotation.
- Plages calquées sur la simulation : vitesse avant ±0,15 m/s, pas de côté ±0,2 m/s, rotation ±1 rad/s.
- Envoi des consignes au moins 20 fois par seconde, comme la manette d'origine.
- Boutons équivalents à la manette : pause/reprise, projecteur, son, antennes, sprint (×1,3), tête (mode expert seulement, car fragile).

### 3.3 Sécurité

- **Bouton STOP toujours visible**, sur tous les écrans, actif pour tous les téléphones connectés, même sans le jeton.
- **Chien de garde** : si le Pi ne reçoit plus rien du pilote pendant 1 seconde (valeur à régler), il met le canard en pause.
- Au démarrage, le canard est en pause (`start_paused`) ; il faut une action volontaire pour lancer la marche.
- Alerte à l'écran si la batterie est basse ou si un servo chauffe.

### 3.4 Plusieurs téléphones : le jeton de pilote

- Un seul pilote à la fois. Le premier qui prend les commandes obtient le jeton.
- Les autres téléphones sont spectateurs : ils voient l'état du canard, peuvent appuyer sur STOP, mais leurs commandes de mouvement sont ignorées.
- Le pilote peut rendre le jeton ou le passer à un autre téléphone.
- Si le pilote ne donne plus signe de vie, le canard se met en pause et le jeton se libère.
- Un code administrateur (Laurent, Jean-Marie) permet de reprendre la main à tout moment.
- Chaque téléphone affiche un prénom choisi à la première ouverture.

### 3.5 Retour haptique et sons de commande

- Vibration courte à chaque prise de jeton, appui sur un bouton, passage en pause ; vibration longue sur STOP et sur perte de liaison.
- Petits sons de commande joués par le téléphone (clic, bip de connexion, son de pause, alarme de perte de liaison), désactivables.
- Attention : la vibration web fonctionne sur Android (Chrome) mais pas sur iPhone, où il faudra compter sur les sons et les effets visuels.

### 3.6 Commande vocale

- Ordres simples : « avance », « recule », « tourne à gauche », « tourne à droite », « stop », « bouge les antennes », « dis bonjour », etc.
- L'appli traduit chaque ordre en consigne, exactement comme le joystick.
- Chaque ordre de mouvement a une durée limitée (par exemple 3 secondes), puis le canard s'arrête.
- « Stop » est toujours reconnu en priorité ; le bouton STOP reste à l'écran.
- La reconnaissance vocale du navigateur passe souvent par internet : il faudra tester une reconnaissance sur l'appareil (fonction hors ligne du navigateur ou petit modèle embarqué dans l'appli) pour l'usage en extérieur.

### 3.7 Le canard qui parle : bibliothèque de phrases

- Le canard prononce des phrases par son propre haut-parleur (ampli MAX98357A du pack expression, déjà prévu dans la BOM).
- **Les phrases sont des fichiers audio préenregistrés.** La bibliothèque est sur une seconde carte microSD, dédiée, dans un module lecteur branché sur le bus SPI du Pi (broches GPIO8 à GPIO11, libres dans le brochage du canard). Elle se retire et se met à jour sur un PC sans toucher au système. Ne pas utiliser le mode SDIO de certains modules : il prend GPIO22 et GPIO27, les contacts des pieds. Le SPI est lent (quelques Mo/s), mais suffisant pour lire de l'audio. Le lecteur USB est exclu : le seul port USB sert à la carte des servos.
- Les phrases sont générées à l'avance sur un PC avec une synthèse vocale française (par exemple Piper, libre et hors ligne), car le Zero 2 W est trop lent pour fabriquer la voix en direct de façon fluide.
- Chaque phrase a un identifiant, un texte, une ou plusieurs catégories et des déclencheurs. Exemples de catégories : salutations, réponses aux ordres (« d'accord, j'avance ! »), refus (« je suis fatigué, ma batterie est faible »), humour, présentation du FabLab, réactions (chute, pause, reprise), anniversaires et animations.
- **L'appli décide quelle phrase dire selon les circonstances** : ordre reçu, mode enfant, batterie basse, perte d'équilibre, inactivité. Elle peut aussi en tirer une au hasard dans une catégorie pour varier.
- Le pilote peut aussi déclencher une phrase à la main, depuis une grille de boutons.
- Le mode expert permet d'ajouter, désactiver ou réécouter des phrases ; la liste est un fichier d'index (JSON) à côté des fichiers audio.
- Ordre de grandeur : 2 000 phrases au format Opus, environ 50 à 100 Mo.
- Plus tard, une IA pourra choisir ou composer les réponses ; elle utilisera la même commande « dire la phrase ».

### 3.8 État et télémétrie

- Batterie (tension), température et courant des servos (lus sur le bus), état de l'IMU, contacts des pieds, état du jeton, qualité de la liaison et latence.
- En mode expert : graphique en direct et export des mesures (utile pour les mesures de la phase 5).

### 3.9 Ouverture vers l'IA

- Le Zero 2 W ne fera pas tourner d'IA sérieuse (512 Mo de mémoire vive).
- L'IA pourra tourner sur le téléphone, sur un PC proche, sur le VPS quand il y a internet, ou plus tard sur un Pi 5 / Compute Module 5 dans le corps du canard.
- Dans tous les cas, l'IA envoie les mêmes commandes qu'un pilote humain, en respectant le jeton et le STOP.

## 4. Cahier des charges technique

- **Côté Pi** : Raspberry Pi OS Bookworm 64 bits Lite (Python 3.11), déjà installé ; point d'accès par NetworkManager ; serveur Python asynchrone (par exemple FastAPI ou aiohttp) avec WebSocket ; lecture audio par ALSA ; service systemd lancé au démarrage.
- **Côté téléphone** : PWA (manifest, service worker, cache hors ligne), HTML/CSS/JavaScript, Web Audio pour les sons, vibration web, reconnaissance vocale à tester.
- **Protocole** : messages JSON courts, par exemple consigne de mouvement, bouton, demande de jeton, STOP, « dire la phrase », état renvoyé par le Pi 10 fois par seconde.
- **Intégration au Runtime** : une classe qui remplace la lecture de la manette Xbox dans le script de marche et fournit les mêmes valeurs.
- **Ressources sur le Pi** : moins de 200 Mo de stockage pour le logiciel, plus la bibliothèque de phrases ; environ 30 à 50 Mo de mémoire vive pour le serveur, à vérifier à côté de la boucle de marche à 50 Hz.
- **Latence visée** : moins de 20 ms entre le téléphone et le Pi, sur 10 mètres.
- **Code** : dans le dépôt du club (dossier `biscalab/`), avec un README de maintenance.

## 5. Configuration matérielle

### Disponible aujourd'hui

- Raspberry Pi Zero 2 W avec sa carte microSD de 32 Go (Bookworm, Runtime installé, I²C activé).
- Alimentation 5 V pour le Pi.
- Un ou plusieurs téléphones Android et iPhone pour les tests.
- Le PC de Laurent (MSI Raider) pour la simulation MuJoCo.

### À ajouter plus tard

- Ampli MAX98357A et haut-parleur (pack expression) pour les phrases, et module lecteur microSD en SPI avec sa seconde carte pour la bibliothèque.
- Servos, carte Waveshare, IMU BNO055, batterie : selon le plan d'achats.
- Aucune antenne Wi-Fi externe : l'antenne intégrée du Zero 2 W suffit pour 10 mètres.

## 6. Marche à suivre, étape par étape

Règle : on ne passe à l'étape suivante que lorsque le test de fin d'étape est réussi.

### Étape 0 — Sauvegarder la carte

1. Arrêter le Pi proprement (`sudo poweroff`).
2. Faire une image de la carte de 32 Go avant toute modification, avec la méthode déjà utilisée le 2 novembre.

**Test** : l'image existe et elle est rangée hors d'un PC partagé.

### Étape 1 — Point d'accès Wi-Fi du canard

1. Ajouter un profil Wi-Fi en mode point d'accès dans NetworkManager (nom du réseau « Canard-BiscaLab », mot de passe du club, bande 2,4 GHz).
2. Garder les profils Wi-Fi maison et FabLab pour les mises à jour ; prévoir un moyen simple de basculer entre les deux (le Zero 2 W ne fait pas les deux en même temps de façon fiable).
3. Prévoir un accès de secours si le Wi-Fi est mal réglé (câble USB en mode réseau, ou réécriture de la carte).

**Test** : un téléphone se connecte au réseau du canard et joint le Pi en SSH.

### Étape 2 — Serveur de commande avec un faux canard

1. Créer le serveur Python : réception des consignes, jeton de pilote, STOP, chien de garde.
2. Le faux canard renvoie un état simulé (batterie qui baisse, températures, contacts).
3. Lancer le serveur comme service au démarrage.

**Test** : depuis un PC connecté au réseau du canard, une page de test envoie des consignes et reçoit l'état.

### Étape 3 — Première version de l'appli

1. Écran de connexion et choix du prénom.
2. Joystick, rotation, bouton STOP, prise et cession du jeton.
3. Vibrations et sons de commande.
4. Affichage de l'état.

**Test** : deux téléphones, un seul peut piloter ; le STOP fonctionne depuis les deux.

### Étape 4 — Essais en conditions réelles

1. Portée : s'éloigner jusqu'à 10 mètres, en intérieur et en extérieur, et noter la latence.
2. Coupure : couper le Wi-Fi du pilote et vérifier la pause en moins d'une seconde.
3. Mémoire : vérifier la mémoire vive utilisée sur le Pi.

**Test** : fiche de test remplie dans le dossier canard (latence, portée, temps de réaction du chien de garde).

### Étape 5 — Canard virtuel sur le PC

1. Adapter le script de simulation (`mujoco_infer.py`) pour lire les consignes envoyées par l'appli.
2. Faire marcher le modèle du canard avec la politique officielle `BEST_WALK_ONNX_2.onnx`.

**Test** : le canard virtuel avance, tourne et s'arrête au doigt et à la voix.

### Étape 6 — Modes enfant, membre, expert

1. Ajouter les trois modes et le code expert.
2. Brider la vitesse en mode enfant.
3. Ajouter les réglages experts, d'abord en lecture seule.

**Test** : un enfant et un membre peu familier pilotent le canard virtuel sans explication.

### Étape 7 — HTTPS, VPS et vraie PWA

1. Choisir le nom de domaine (sous-domaine du club ou feroux.fr), avec un accès à l'API du fournisseur DNS.
2. Obtenir un certificat Let's Encrypt par validation DNS pour l'adresse du canard.
3. Sur le point d'accès, faire répondre le Pi lui-même à cette adresse (DNS local de NetworkManager).
4. Héberger l'appli sur le VPS, avec mise en cache hors ligne.
5. Tester l'autorisation « réseau local » demandée par les navigateurs récents.
6. Programmer le renouvellement automatique du certificat quand le Pi a internet.

**Test** : l'appli s'installe depuis le VPS, puis fonctionne en plein champ sans internet, sur Android et sur iPhone.

### Étape 8 — Bibliothèque de phrases

1. Rédiger les phrases par catégorie dans un tableur partagé (idée : une séance d'écriture au club, avec les enfants).
2. Générer les fichiers audio sur le PC avec une voix française.
3. Brancher le module lecteur microSD en SPI, l'activer dans la configuration du Pi, puis copier les fichiers et l'index sur la seconde carte.
4. Ajouter dans l'appli la grille de phrases et les règles de déclenchement automatique.
5. Quand l'ampli et le haut-parleur seront là, brancher la sortie audio du Pi.

**Test** : chaque ordre reçoit une réponse adaptée et variée ; la phrase part en moins d'une demi-seconde.

### Étape 9 — Commande vocale

1. Tester la reconnaissance du navigateur, puis une reconnaissance hors ligne.
2. Définir la liste des ordres et leurs synonymes.
3. Associer chaque ordre à une consigne et à une phrase de réponse.

**Test** : dix ordres reconnus sans internet, en extérieur, avec réponse vocale du canard.

### Étape 10 — Le vrai canard

1. Brancher le serveur de commande à la place de la manette dans le Runtime.
2. Premiers essais au banc, robot suspendu, puis posé.
3. Remplacer le faux état par les vraies mesures (servos, IMU, batterie).

**Test** : première marche du vrai canard pilotée depuis le téléphone.

## 7. Points ouverts

- Nom de domaine et accès DNS pour le certificat.
- Bascule entre le point d'accès et le Wi-Fi maison ou FabLab.
- Reconnaissance vocale hors ligne : solution à choisir après essais.
- Voix de synthèse : choix de la voix et de sa licence.
- Qui écrit les phrases, et qui les relit (public enfant).
- Mémoire vive disponible quand la marche et le serveur tournent ensemble sur le Zero 2 W.
