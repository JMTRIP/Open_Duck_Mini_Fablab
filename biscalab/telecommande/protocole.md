# Protocole téléphone ↔ canard

Version 0.2 du 4 novembre 2026 (0.1 : 3 novembre ; la 0.2 ajoute la marche à l'homme mort et le champ `pret`). Messages JSON courts, échangés par WebSocket sur `/ws`, à l'adresse qui sert l'appli (`ws://` en essai, `wss://` avec le certificat de l'étape 7). Chaque message a un champ `t` qui donne son type.

## Conventions

- **Axes du canard**, comme dans le runtime d'origine : `vx` > 0 avance, `vy` > 0 pas de côté vers la **gauche**, `wz` > 0 tourne vers la **gauche** (sens trigonométrique).
- **Le téléphone envoie des consignes réduites, entre −1 et 1.** Le serveur les multiplie par les limites d'entraînement : `vx` 0,15 m/s, `vy` 0,2 m/s, `wz` 1 rad/s. Une valeur hors plage est ramenée à ±1 ; une valeur illisible vaut 0.
- **Chaque téléphone a deux identifiants** : `id`, secret, tiré au hasard et gardé par le téléphone (il permet de retrouver le jeton après une coupure), et `num`, public, donné par le serveur à chaque connexion (il sert à afficher et à passer la main).

## Délais de sécurité

| Délai | Effet |
| --- | --- |
| 0,3 s sans consigne du pilote | vitesse remise à zéro |
| 1 s sans nouvelles du pilote | canard en pause (« liaison perdue ») |
| 3 s sans nouvelles du pilote | jeton libéré |
| Pilote déconnecté | pause immédiate ; jeton gardé 3 s pour le même `id` |

## Marche à l'homme mort

Le canard ne bouge que tant que le pilote pousse un joystick ; il n'y a pas de bouton « Marche ».

| Situation | Effet |
| --- | --- |
| Le pilote pousse un joystick (une consigne dépasse 0,05) et le canard est **prêt** | il sort de pause tout de suite |
| Joysticks lâchés pendant 2 s, en marche | pause « repos », le canard se pose ; il reste prêt |
| Arrêt subi : démarrage, STOP, liaison perdue, pilote déconnecté, changement de pilote, chute, batterie vide, `pause` | pause **verrouillée** : le canard ne repart pas, même joystick poussé |
| Verrou, puis consigne nulle (joysticks lâchés) | verrou levé, le canard est prêt |
| Après un STOP | verrou levé au plus tôt 1 s après, joysticks lâchés |

Le verrou évite qu'un canard reparte seul derrière un STOP, une reconnexion ou un changement de pilote parce qu'un pouce est resté sur un joystick : il faut lâcher, puis pousser de nouveau. Tant que le canard est au sol ou la batterie vide, il reste verrouillé. Les reprises et les repos ne donnent pas d'événement : l'état suffit (`pause`, `pret`).

## Du téléphone vers le canard

| `t` | Champs | Qui | Effet |
| --- | --- | --- | --- |
| `bonjour` | `id`, `nom`, `version` | tous | premier message obligatoire ; réponse `bienvenue` |
| `cmd` | `vx`, `vy`, `wz` (−1 à 1), `sprint` (booléen) | pilote | consigne de mouvement, **20 fois par seconde**, même à zéro (c'est aussi le signe de vie du pilote) |
| `stop` | — | **tous** | pause immédiate, vitesse nulle |
| `prendre` | `code` (facultatif) | tous | prend le jeton s'il est libre ; avec le code administrateur, le prend même s'il est tenu |
| `rendre` | — | pilote | libère le jeton |
| `passer` | `a` (`num` du destinataire) | pilote | donne le jeton à un autre téléphone |
| `marche` | — | pilote | sort de pause et lève le verrou (ancienne appli ; la nouvelle n'en a plus besoin) |
| `pause` | — | pilote | pause verrouillée (ancienne appli) |
| `bouton` | `b` : `projecteur`, `antennes` ou `son` | pilote | bascule l'accessoire (ou joue le son) |
| `ping` | `ts` | tous | réponse `pong` avec le même `ts`, pour mesurer la latence |

Les consignes et boutons d'un téléphone qui n'a pas le jeton sont ignorés. Le STOP, lui, est toujours accepté.

## Du canard vers le téléphone

| `t` | Champs | Quand |
| --- | --- | --- |
| `bienvenue` | `num`, `version`, `limites` | réponse à `bonjour` |
| `etat` | voir ci-dessous | 10 fois par seconde, à tous |
| `evenement` | `e`, `texte` | à tous, au moment où ça arrive |
| `erreur` | `code`, `texte` | au seul téléphone concerné |
| `pong` | `ts` | réponse à `ping` |

Événements (`e`) : `jeton` (changement de pilote), `stop`, `pause` (pause demandée par l'ancienne appli, batterie vide, personne ne pilote), `reprise` (message `marche`), `liaison` (pilote perdu), `bouton` (accessoire ou son), `chute` (le canard est tombé : pause, puis il est remis debout).

Erreurs (`code`) : `bonjour_attendu`, `id_invalide`, `json`, `inconnu`, `pas_pilote`, `occupe`, `code` (code administrateur faux, réponse retardée d'une seconde), `destinataire`, `batterie`, `au_sol` (`marche` pendant que le canard est tombé).

### Message `etat`

```json
{
  "t": "etat", "seq": 1234, "temps": 123.4,
  "pause": true, "pret": false, "raison": "démarrage",
  "pilote": {"num": 3, "nom": "Laurent", "connecte": true},
  "clients": [{"num": 3, "nom": "Laurent"}, {"num": 4, "nom": "Léo"}],
  "vitesse": {"vx": 0.0, "vy": 0.0, "wz": 0.0},
  "sprint": false,
  "accessoires": {"projecteur": false, "antennes": false},
  "canard": {
    "simule": true, "batterie_v": 8.31, "batterie_pct": 97, "puissance_w": 4.0,
    "temperatures": {"genoux": 24.1, "hanches": 23.5, "chevilles": 23.2, "tete": 22.4},
    "temp_max": 24.1, "contacts": {"gauche": true, "droit": true},
    "pose": {"x": 0.0, "y": 0.0, "cap": 0.0}, "en_mouvement": false
  }
}
```

- `pret` vaut `true` quand le canard est en pause mais qu'un coup de joystick du pilote suffit pour le faire partir (pilote connecté, pas de verrou, canard debout, batterie correcte). En pause avec `pret` à `false`, `raison` dit pourquoi.
- `raison` : `démarrage`, `repos`, `STOP par …`, `liaison perdue`, `pilote déconnecté`, `nouveau pilote : …`, `personne ne pilote`, `chute`, `batterie vide`, `pause par …`, `erreur interne` ; vide en marche.
- `pilote` vaut `null` quand personne ne pilote.
- `vitesse` est la consigne réellement appliquée, en m/s et rad/s (zéro en pause).
- `canard.simule` vaut `true` en simulation ; `pose` n'existe qu'en simulation.
- Avec le canard virtuel (`canard.modele` = `mujoco`), s'ajoutent `tombe` (booléen) et `chutes` (nombre) ; position et contacts des pieds viennent alors de la simulation MuJoCo.

## À venir

`dire` (phrase de la bibliothèque, étape 8), réglages experts (étape 6), mode enfant (étape 6).
