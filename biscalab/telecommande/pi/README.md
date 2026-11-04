# La télécommande sur le Pi du canard

Le Pi Zero 2 W fait tourner le serveur de commande et sert l'appli. Hors de la maison, il crée son propre réseau Wi-Fi : les téléphones s'y connectent et ouvrent l'appli, sans box ni internet.

## Au club

1. Brancher le Pi et attendre environ une minute.
2. Sur chaque téléphone, se connecter au Wi-Fi **Canard-BiscaLab** (mot de passe : dans le coffre du club, ou la fiche avec le QR code).
3. Ouvrir **http://10.42.0.1** dans Chrome (Android) ou Safari (iPhone).

- Le téléphone signale « pas d'internet » : c'est normal. Sur Android, répondre « Rester connecté » s'il le demande.
- Environ 8 téléphones au plus en même temps (limite de la puce Wi-Fi du Zero 2 W).
- Un seul pilote à la fois ; tout le monde a le STOP.
- Le code administrateur (pour reprendre la main) est dans `/etc/canard/telecommande.env` sur le Pi.

## À la maison

Si un Wi-Fi « maison » est à portée au démarrage, le Pi s'y connecte au lieu de créer son réseau : il reste joignable en SSH et peut se mettre à jour. L'appli est alors sur `http://canard.local` (ou l'adresse du Pi sur la box).

Les Wi-Fi « maison » sont listés dans `/etc/canard/wifi-maison`, un profil NetworkManager par ligne. Le Wi-Fi du FabLab n'y est pas, exprès : au club, le canard crée son réseau.

## Installer (une fois, avec internet)

Depuis le Pi, connecté au Wi-Fi maison :

```
git clone --depth 1 --filter=blob:none --sparse -b v2 https://github.com/JMTRIP/Open_Duck_Mini_Fablab.git ~/Open_Duck_Mini_Fablab
cd ~/Open_Duck_Mini_Fablab
git sparse-checkout set biscalab/telecommande
sudo bash biscalab/telecommande/pi/installer.sh
```

Le clone ne télécharge que le dossier de la télécommande. L'installation affiche le nom du réseau, son mot de passe (tiré au hasard la première fois, à ranger dans le coffre du club) et l'adresse de l'appli. Pour choisir le mot de passe ou le code : `sudo CANARD_WIFI_MDP='...' CANARD_CODE_ADMIN='1234' bash biscalab/telecommande/pi/installer.sh`. Les autres réglages sont décrits en tête de `installer.sh`. Aucun mot de passe n'est écrit dans le dépôt.

Ce qui est installé :

| Élément | Rôle |
| --- | --- |
| `~/.venvs/telecommande` | Python avec aiohttp |
| service `canard-telecommande` | serveur + appli sur le port 80, relancé s'il s'arrête |
| profil NetworkManager `canard-wifi` | point d'accès 2,4 GHz, adresse 10.42.0.1, DHCP pour les téléphones |
| service `canard-reseau` | au démarrage : Wi-Fi maison s'il est là, sinon réseau du canard |
| `/etc/canard/` | code administrateur, liste des Wi-Fi maison |

## Mettre à jour

À la maison (le Pi a besoin d'internet) :

```
bash ~/Open_Duck_Mini_Fablab/biscalab/telecommande/pi/mettre-a-jour.sh
```

L'appli React n'est pas construite sur le Pi (pas de Node) : on envoie `appli-react/dist`, construit sur un PC, dans le dépôt.

## Changer de réseau depuis l'appli

Dans les Réglages, section **RÉSEAU** (seulement quand l'appli vient du Pi) : le réseau en cours et un bouton **PASSER SUR « … »** (Wi-Fi du club) ou **CRÉER LE RÉSEAU DU CANARD**. Il faut le code administrateur. Tous les téléphones sont prévenus : une fenêtre dit quel Wi-Fi rejoindre et quelle adresse ouvrir ensuite (lien à toucher). Le Pi change de réseau trois secondes après ; le canard est mis en pause.

Le Wi-Fi du club n'est pas un Wi-Fi « maison » : au prochain démarrage au club, le Pi recrée son réseau.

## Changer de réseau à la main

```
canard-reseau etat              réseau en cours et adresse de l'appli
sudo canard-reseau canard       créer le réseau du canard tout de suite
sudo canard-reseau wifi         revenir sur un Wi-Fi connu
sudo canard-reseau essai 120    réseau du canard pendant 2 minutes, puis retour au Wi-Fi d'avant
```

Pour un essai lancé en SSH par le Wi-Fi maison, le lancer détaché, sinon il s'arrête avec la connexion : `sudo systemd-run --unit canard-essai canard-reseau essai 180`. Le compte rendu (point d'accès, nombre de téléphones, serveur) est dans `/var/lib/canard/essai-reseau.txt`.

## En cas de souci

- Journaux : `journalctl -u canard-telecommande -u canard-reseau -b`.
- Le réseau du canard n'apparaît pas : le point d'accès a échoué, le Pi est revenu sur un Wi-Fi connu (voir le journal de `canard-reseau`).
- Accès de secours : à la maison, le Wi-Fi maison passe toujours avant le réseau du canard ; il suffit de redémarrer le Pi à portée de la box. Sur le réseau du canard, le Pi répond aussi en SSH sur 10.42.0.1.
- Le Zero 2 W n'a qu'une puce Wi-Fi : sur son réseau, il n'a pas internet.
