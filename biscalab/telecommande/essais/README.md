# Essais de l'appli au doigt

Ces scripts Playwright ouvrent l'appli dans Chrome et WebKit (le moteur de Safari) sur des téléphones simulés, et vérifient ce que voit et touche un utilisateur. Ils se lancent contre un serveur d'essai avec le faux canard, jamais contre le vrai.

```
pip install playwright
python -m playwright install chromium webkit
python serveur/canard_serveur.py --port 8090 --code-admin 1111        (dans un autre terminal)
```

| Script | Ce qu'il vérifie | Lancement |
| --- | --- | --- |
| `essai_boutons.py` | chaque bouton au doigt : un doigt (iPhone, Android), puis pouce sur le joystick et second doigt ; dialogue du code, accueil, clavier | `python essais/essai_boutons.py http://127.0.0.1:8090` |
| `essai_marche.py` | marche à l'homme mort : PRÊT, EN MARCHE, STOP joystick tenu, lâcher, repos | `python essais/essai_marche.py <dossier> http://127.0.0.1:8090` |
| `essai_menu.py` | rendre la main (menu sous l'onglet), Réglages, nombres à virgule | `python essais/essai_menu.py <dossier> http://127.0.0.1:8090` |
| `essai_ecrans.py` | l'appli tient entière dans l'écran, de l'iPhone SE à la tablette | `python essais/essai_ecrans.py <dossier> http://127.0.0.1:8090` |

`<dossier>` reçoit les captures d'écran : le choisir hors du dépôt.

Le code `1111` est celui attendu par `essai_boutons.py` ; il ne sert qu'au serveur d'essai.
