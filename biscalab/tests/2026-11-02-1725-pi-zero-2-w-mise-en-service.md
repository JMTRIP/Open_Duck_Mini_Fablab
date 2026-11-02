---
type: test
titre: Pi Zero 2 W : mise en service
phase: 2
resultat: PARTIEL
date: 2026-11-02
par: Laurent
---
## Objectif
Vérifier que le Pi Zero 2 W reçu démarre, rejoint le Wi-Fi du FabLab, accepte SSH, exécute le Runtime et tient le temps de calcul de la politique de marche.

## Montage
Pi Zero 2 W seul, alimenté par USB, avec une microSD de 128 Go déjà préparée (Bookworm 64 bits et Runtime). Aucun servo, aucune IMU, aucun adaptateur de bus ni manette branchés.

## Procédure
1. Recherche du Pi sur le réseau depuis un PC du même Wi-Fi.
2. Connexion SSH avec une clé, puis relevé du matériel, du système, du réseau, de la température et des journaux.
3. Chargement des bibliothèques du Runtime dans `~/.venvs/canard`.
4. Téléchargement temporaire de `BEST_WALK_ONNX_2.onnx`, 3 000 inférences avec une entrée nulle, puis suppression du modèle.

## Critère de réussite
Le Pi répond en SSH sur le Wi-Fi du FabLab, sans sous-tension ni service en échec. Les bibliothèques se chargent. Le temps d'inférence reste nettement sous le budget de 20 ms d'un cycle à 50 Hz. Ce critère a été fixé pendant l'essai, à partir du budget de 50 Hz du dossier.

## Résultat
- Carte : Raspberry Pi Zero 2 W Rev 1.0, 416 Mo de RAM visibles.
- Système : Debian 12 Bookworm, noyau 6.12.109+rpt-rpi-v8 aarch64, Python 3.11.2, état `running`, aucun service en échec.
- microSD : 117 Go, 3,3 Go utilisés, 108 Go libres.
- Wi-Fi : réseau `biscalab`, canal 9 (2,4 GHz), signal 80/100, 270 Mbit/s.
- Réseau : routeur 5,3 ms, GitHub 46,8 ms, aucune perte sur 3 pings ; horloge synchronisée.
- Alimentation : `throttled=0x0` après le test.
- Température : 37,0 °C au repos, 41,9 °C après le test.
- Bluetooth : contrôleur actif. I²C : `/dev/i2c-1` présent.
- Runtime : branche `v2`, commit `9928a62`, identique au dépôt du club, aucune modification locale.
- Bibliothèques : numpy 1.26.4, onnxruntime 1.18.1, scipy, rustypot, pygame, adafruit_bno055, pypot et RPi.GPIO chargées en 4,9 s.
- Modèle : entrée `[1, 101]`, sortie `[1, 14]`.
- Inférence sur 3 000 passages : moyenne 0,80 ms, médiane 0,79 ms, centile 99 0,90 ms, maximum 1,28 ms.
- Mémoire du processus Python : 68 Mo.

Non testés : IMU, adaptateur de bus et servos, manette Bluetooth, boucle complète à 50 Hz. Cette mesure ne porte que sur l'inférence : elle ne compte ni la lecture de l'IMU ni le bus servo. `duck_config.json` n'existe pas encore.

## Décision
Pi validé pour la suite de la phase 2. Résultat noté PARTIEL : cette fiche ne remplace pas « Banc servo : bus, IMU, contacts » ni le GO / NO-GO de la phase 2.
