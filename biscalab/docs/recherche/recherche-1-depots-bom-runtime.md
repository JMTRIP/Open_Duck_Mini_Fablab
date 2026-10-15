# Open Duck Mini V2 — Recherche 1 : dépôts, CAO, BOM, assemblage, runtime, RL, communauté

Recherche faite le 1er octobre 2026 à partir des fichiers bruts des dépôts GitHub (README, docs, code) et de l'export CSV de la BOM Google Sheets.

**Pages non lisibles ce jour-là :** le guide Tnkr (403), la vidéo YouTube `tt-g_fi-eGU` (429), l'historique des commits et le listing du dossier `print/` (robots.txt / API GitHub). Les dates de dernier commit sont donc approximées à partir des issues, PR et releases.

---

## 1. Cartographie des dépôts

**v1 et V2 sont deux robots différents :**
- **v1 (« mini_BDX »)** : environ 35 cm, servos Dynamixel xl330 puis xc330-M288-T, entraînement Isaac Gym avec AWD, autre document Onshape. L'auteur signalait « too much play at some joints » et conseillait d'attendre la V2. Sources : https://raw.githubusercontent.com/apirrone/Open_Duck_Mini/main/README.md et https://github.com/apirrone/Open_Duck_Mini/blob/v1/README.md
- **V2** : environ 42 cm jambes tendues, objectif « BOM under $400 », 14 servos Feetech STS3215, entraînement MuJoCo Playground. Source : https://raw.githubusercontent.com/apirrone/Open_Duck_Mini/v2/README.md
- Les anciens noms `apirrone/mini_BDX` et `apirrone/mini_BDX_runtime` redirigent vers les dépôts actuels. Le `setup.cfg` du runtime pointe encore vers `mini_BDX_runtime`.

| Dépôt | Rôle | Licence | Langage | Activité | Stars |
|---|---|---|---|---|---|
| [apirrone/Open_Duck_Mini](https://github.com/apirrone/Open_Duck_Mini) (branche **v2**) | Hub : docs, STL dans `print/`, BOM, 2 politiques ONNX (`BEST_WALK_ONNX.onnx`, `BEST_WALK_ONNX_2.onnx`) | Apache-2.0 | Python | 316 commits sur v2 ; issues ouvertes jusqu'au 3/09/2026 (#56) | ≈ 4,2 k, 537 forks |
| [apirrone/Open_Duck_Mini_Runtime](https://github.com/apirrone/Open_Duck_Mini_Runtime) (branche **v2**) | Code embarqué du Pi Zero 2 W | Aucun fichier LICENSE | Python | 1 014 commits ; release « V2 Classic » 15/08/2025 ; dernière PR 17/05/2026 | 178 |
| [apirrone/Open_Duck_Playground](https://github.com/apirrone/Open_Duck_Playground) | Environnements RL MuJoCo Playground / MJX | Pas de LICENSE ; en-têtes Apache-2.0 | Python | 251 commits | 185 |
| [apirrone/Open_Duck_reference_motion_generator](https://github.com/apirrone/Open_Duck_reference_motion_generator) | Mouvements de référence avec Placo (imitation) | Pas de LICENSE | Python | 23 commits | 109 |
| [pollen-robotics/Open_Duck_Blender](https://github.com/pollen-robotics/Open_Duck_Blender) | Rig Blender (FK/IK) | Apache-2.0 | Blender/Python | 4 commits | 37 |
| [Rhoban/bam](https://github.com/Rhoban/bam) | Identification d'actionneurs ; paramètres STS3215 | Apache-2.0 | Python | 498 commits ; ICRA 2025 | 503 |
| [pollen-robotics/rustypot](https://github.com/pollen-robotics/rustypot) | Pilote bus série (Dynamixel, Feetech) + bindings Python | Apache-2.0 | Rust | actif | 66 |
| [rimim/AWD](https://github.com/rimim/AWD) | Entraînement AMP Isaac Gym (v1, « go_duck ») | NVIDIA License | Python | — | — |
| [SteveNguyen/openduckminiv2_playground](https://github.com/SteveNguyen/openduckminiv2_playground) | Variante Playground citée par le générateur | — | Python | — | — |

**Introuvables :** `Open_Duck_Mini_Description`, `open_duck_mini_brain_rsl`, liste « awesome » Open Duck, dépôts Hugging Face officiels (les ONNX sont dans le dépôt GitHub ; le compte HF d'apirrone contient surtout des modèles « microduck »). Une liste awesome existe pour Microduck : https://github.com/joeynyc/awesome-microduck. La description URDF/MJCF est dans le Playground (`playground/open_duck_mini_v2/xmls/`), générée avec onshape-to-robot (https://raw.githubusercontent.com/apirrone/Open_Duck_Mini/v2/docs/sim2real.md).

---

## 2. CAD et impression

- Document Onshape public (natif) : https://cad.onshape.com/documents/64074dfcfa379b37d8a47762/w/3650ab4221e215a4f65eb7fe/e/0505c262d882183a25049d05
- STL dans `print/` (branche v2). Aucun STEP trouvé. Onshape exporte STEP/STL même en plan gratuit : https://forum.onshape.com/discussion/10703/export-in-free-version
- `prepare_robot.md` (Onshape → MuJoCo) marqué obsolète.

**Paramètres d'impression** (https://raw.githubusercontent.com/apirrone/Open_Duck_Mini/v2/docs/print_guide.md) : PLA standard **15 %** ; seule exception `foot_bottom_tpu.stl` en **TPU 40 %**. Orientation, supports, hauteur de couche **non documentés**.

**Pièces (36 STL, 51 pièces)**
- Pieds (×2 chacun) : foot_top, foot_side, foot_bottom_pla, foot_bottom_tpu.
- Jambes : knee_to_ankle_left_sheet ×4, knee_to_ankle_right_sheet ×4, leg_spacer ×4 ; left/right_roll_to_pitch ×1 ; roll_motor_bottom ×2, roll_motor_top ×2.
- Tronc/cou/tête : trunk_bottom, trunk_top, neck_left_sheet, neck_right_sheet, head_pitch_to_yaw, head_yaw_to_roll, head_roll_mount, head, head_bot_sheet.
- Carrosserie : left/right_antenna_holder, left/right_cache, body_front, body_middle_bottom, body_middle_top, body_back, battery_pack_lid.
- Expression : bulb, flash_light_module, flash_reflector_interface, left_eye, right_eye, speaker_interface, speaker_stand.

Un constructeur tiers rapporte « 36 STL types (51 parts) », PLA 990 g + TPU 34 g : https://github.com/soyeon24/open-duck-mini-v2-build

**Inserts et roulements** (assembly_guide.md) : inserts M3 dans trunk_bottom (+4 sous la pièce), foot_bottom_pla, foot_top, leg_spacer (4), tête, body_middle_bottom/top. Roulements dans trunk_bottom et la tête (BOM : 3 ; un tiers cite des 608 8×22×7 : https://github.com/seanmayer/open-duck-mini-build).

---

## 3. BOM officielle V2

Source : https://docs.google.com/spreadsheets/d/1gq4iWWHEJVgAA_eemkTEsshXqrYlFxXAPwO515KpCJc — base **398,10 €** (est. basse 331,10 €) ; avec pack expression **432,34 €**. Les lignes AliExpress ne sont pas reprises.

| Élément | Qté | PU | Remarque / alternative européenne vérifiée |
|---|---|---|---|
| Feetech STS3215 **7,4 V** (19 kg·cm) | 14 | 14 € | « Be sure to buy 7.4v ones ». Eckstein (DE) 24,35 € ([lien](https://eckstein-shop.de/Feetech-STS3215-74V-19kgcm-plastic-case-metal-gear-magnetic-code-dual-shaft-TTL-serial-servo)) ; OpenELAB (DE) ST3215-C001 29,95 € ([lien](https://openelab.io/products/seeed-studio-feetech-st3215-c001-servo-7-4v-1-345-gear-ratio)) ; RobotShop EU 31,35 € ([lien](https://eu.robotshop.com/products/magnetic-encoding-servo-sts3215-74v-19kgcm)) |
| Waveshare Bus Servo Adapter (A) | 1 | 5 € | 4,99 $ direct ([lien](https://www.waveshare.com/bus-servo-adapter-a.htm)). ⚠ Fiche : entrée « 9~12.6V » alors que le canard est en 2S (7,4 V) ; pas de doc Open Duck sur cet écart |
| Raspberry Pi Zero 2 W | 1 | 26,08 € | Kubii 19,50 €, en rupture lors de la consultation ([lien](https://kubii.com/en/nano-computers/3455-raspberry-pi-zero-2-w-wh.html)) |
| Carte SD | 1 | 10 € | Amazon.fr |
| IMU BNO055 | 1 | 40 € | « Need cheaper alternative ». Adafruit 2472 34,95 $ ([lien](https://www.adafruit.com/product/2472)) |
| Cellules 18650 | 2 | 5 € | « 3000mAh with 30A ». NKON (NL) Molicel P30B |
| Support 18650, BMS 2S, UBEC 5 V | 1 ch. | 4,99 / 8,40 / 4 € | — |
| Interrupteur, chargeur USB-C, jacks 2,1 mm ×2, XT30 | — | 4,49 / 9,99 / 1 / 8 € | Amazon.fr |
| Contacts de pied Omron SS-10 | 4 | 1 € | RS (BE-FR) 3,79 € TTC ([lien](https://befr.rs-online.com/web/p/micro-switches/6820831)) |
| Servos 9 g (antennes) | 2 | 3,33 € | Amazon.fr |
| Roulements | 3 | 3,50 € | Amazon.fr |
| Inserts M3, gaine, câbles micro-USB→USB-C 15/50 cm | — | 5,99 / 9 / 7 / 6 € | Amazon.fr |
| PLA / TPU | — | 20 € / 0 € | — |
| Expression (option) : réflecteur, HP, LED ×3, micro, diffuseurs ×4, ampli MAX98357A, caméra Pi | — | 2 / 6 / 0,2 / 15 / 0,16 / 5 / 5 € | Caméra « not integrated yet » |

- BOM en chinois : https://zihao-ai.feishu.cn/wiki/AfAtw69vRigXaRk5UkbcrAiLnJw
- Visserie : « X m3 screws (TODO) » — **nombre non documenté**.
- Pas de STS3215 7,4 V trouvé chez Lextronic, Génération Robots, Robot-Maker ; Gotronic ne liste qu'un STS3215-C018.

---

## 4. Assemblage

- Guide officiel « incomplete » : https://raw.githubusercontent.com/apirrone/Open_Duck_Mini/v2/docs/assembly_guide.md
- Guide Tnkr recommandé par le README : https://tnkr.ai/explore/docs/open-duck-mini/open-duck-mini-v2
- Guide chinois : https://zihao-ai.feishu.cn/wiki/space/7488517034406625281

**Configurer chaque servo avant montage** (https://raw.githubusercontent.com/apirrone/Open_Duck_Mini/v2/docs/configure_motors.md) : `python configure_motor.py --id <id>` — cherche l'ID usine 1, règle mode, accélération 0, PID P=32 I=0 D=0, change l'ID, envoie en position 0 ; on pose le palonnier aligné. Script : https://raw.githubusercontent.com/apirrone/Open_Duck_Mini_Runtime/v2/scripts/configure_motor.py

**IDs** : jambe droite 10-14 (hip_yaw, hip_roll, hip_pitch, knee, ankle) ; jambe gauche 20-24 ; cou/tête 30 neck_pitch, 31 head_pitch, 32 head_yaw, 33 head_roll.

**Ordre de montage** : tronc (roulements, inserts, 2 vis M3×10, servo central) → pieds (TPU sur PLA, 2 × M3×6, « driver side » côté foot_top, contacts pressés) → tibias → cuisses (orientation du hip_pitch « important for the zero position ») → hanches (pièces asymétriques) → cou, tête, carte servo (« TODO take a photo ») → IMU, électronique, pack batterie, tête (Pi Zero, servos d'oreilles), carrosserie.

Conseils : Loctite 243 métal/métal uniquement ; charger les cellules à la même tension ; IMU montée à l'envers sur les photos (configurable).

**Brochage Pi Zero** : contacts pied GPIO22 (gauche), GPIO27 (droit) ; BNO055 I²C SDA GPIO2, SCL GPIO3, 3V3 ; antennes PWM GPIO12/13 ; LED yeux/projecteur GPIO23/24/25 ; ampli MAX98357A LRC GPIO19, BCLK GPIO18, DIN GPIO21.

Vidéos : https://www.youtube.com/watch?v=tt-g_fi-eGU (« 4 Days of Soldering… »), https://www.youtube.com/watch?v=DajdOeYJZdk. Retour : « motors should be configured before assembling » — https://scalablehuman.com/2026/08/14/building-open-duck-mini-v2-from-software-project-to-physical-robot/

---

## 5. Runtime (branche v2)

- OS : Raspberry Pi OS Lite 64 bits ; virtualenvwrapper ; `git checkout v2` ; `pip install -e .` ; I²C, règle udev de latence série, appairage Bluetooth manette Xbox One via `bluetoothctl` ; option `python3-picamzero` ; sur Pi 5 remplacer RPi.GPIO par `lgpio`.
- Dépendances : rustypot 0.1.0, onnxruntime 1.18.1, numpy 1.26.4, adafruit-circuitpython-bno055, scipy, pygame, openai 1.70.0 ; pypot fork Pollen branche `support-feetech-sts3215`.
- Boucle (`scripts/v2_rl_walk_mujoco.py`) : ONNX à **50 Hz**, manette à 20 Hz, `action_scale` 0,25, kp 30 (8 tête), rustypot sur `/dev/ttyACM0` à 1 Mbit/s ; observations : gyro + accel BNO055 (NDOF), positions/vitesses articulaires, contacts, commandes.
- Manette : A pause/reprise, X projecteur, B son, Y tête (« very experimental… can break your duck's head »), gâchettes antennes, LB sprint.
- Scripts : `check_motors.py`, `calibrate_imu.py` (→ `imu_calib_data.pkl`), `imu_server.py`/`imu_client.py`, `find_soft_offsets.py` (→ `~/duck_config.json`), `head_puppet.py`. Exemple : https://raw.githubusercontent.com/apirrone/Open_Duck_Mini_Runtime/v2/example_config.json
- Image prête (v0.2.3, MaxMakesStuff) : Bookworm, 32 Go, pied gauche = Head-Puppet / pied droit = Walk au boot, AP Wi-Fi « Openduck », identifiants `bdxv2` / `ilovemyduck` à changer ; offsets et calibration IMU restent obligatoires. https://raw.githubusercontent.com/apirrone/Open_Duck_Mini_Runtime/v2/docs/INSTALL.md
- Variantes : fork Jetson Orin Nano (Isaac Lab) https://github.com/XiaohuiChen-personal/Open_Duck_Mini_Jetson ; démo Google I/O 2026 Gemma 4 E2B sur Pi 5 / Jetson https://circuitdigest.com/news/google-gemma-4-e2b-runs-locally-on-robot-duck

---

## 6. Entraînement RL

Pipeline (sim2real.md, « Not finalized yet ») : export Onshape avec onshape-to-robot (masses remplacées par l'estimation du slicer) → paramètres moteurs BAM (https://github.com/Rhoban/bam/tree/main/params/feetech_sts3215_7_4V) → entraînement Open_Duck_Playground avec récompense d'imitation (article Disney BDX) → export ONNX → `v2_rl_walk_mujoco.py`.

- Références : `uv run scripts/auto_waddle.py -j8 --duck open_duck_mini_v2 --sweep` puis `fit_poly.py` → `polynomial_coefficients.pkl` (git-lfs requis ; un pkl fourni dans `playground/open_duck_mini_v2/data/`).
- Entraînement : `uv run playground/open_duck_mini_v2/runner.py --task flat_terrain_backlash --num_timesteps 300000000` (défaut 150 M). Test : `mujoco_infer.py -o <onnx>`. Brax PPO, export ONNX automatique.
- GPU : `jax[cuda12]` → NVIDIA CUDA 12, Python ≥ 3.11. 300 M pas en **1 h 11 sur RTX 3090** (soyeon24) ; « several hours », 8192 envs, batch 256, lr 3e-4, γ 0,97 (https://frankfu.blog/openai/understanding-reinforcement-learning-through-openduck/).
- Modèle : pas de contrôle 0,02 s, sim 0,002 s ; vitesses ±0,15 m/s, lacet ±1 rad/s, `max_motor_velocity` 5,24 rad/s ; classe `sts3215` kp 13,37 (modèle sans backlash), forcerange ±3,23 N·m, damping 0,56, frictionloss 0,068, armature 0,027 ; backlash ±0,5° ; masse totale ≈ 2,1 kg.
- Domain randomization (`randomize.py`) : friction sol U(0,5 ; 1,0), frottement articulaire ×U(0,9 ; 1,1), masses ×U(0,9 ; 1,1), torse ±0,1 kg / CdM ±5 cm, kp ×U(0,9 ; 1,1).
- Changer matériau/remplissage → mettre à jour les masses (Onshape ou MJCF), régénérer, réentraîner (« slicer mass override »). Au-delà de ±10 % on sort de la plage de randomisation (déduction).

---

## 7. Communauté et écosystème

- Discord officiel : https://discord.gg/UtJZsgfQGe (15/03/2025). Pas de forum dédié.
- Antoine Pirrone : docteur, R&D Pollen Robotics, équipe Rhoban (Bordeaux). Grégoire Passault co-auteur (Hackaday). Sponsors Hugging Face et Pollen (rachetée par HF le 14/04/2025 : https://huggingface.co/blog/hugging-face-pollen-robotics-acquisition).
- Articles : Hackaday 5/04/2025 https://hackaday.com/2025/04/05/disneys-bipedal-bdx-series-droid-gets-the-diy-treatment/ ; CircuitDigest 13/06/2026 ; Make: 28/08/2026 https://makezine.com/article/maker-news/microducks-exude-macro-charm/. Pas de Tom's Hardware ni de billet HF dédié.
- **Microduck** (Pollen × HF, 27/08/2026) : 25 cm, 15 moteurs, RK3566, 399 $ précommande, livraison avant Noël 2026, logiciel open source, matériel non publié : https://pollen-robotics.com/microduck/blog/introducing-microduck/
- Kits : orobot.io (liens, pas de kit, 500-650 $) https://orobot.io/o/program/BROKER-2/open-duck-mini ; AIFITLAB 910 $ « official supplier » non confirmé https://aifitlab.com/products/openduckmini-open-source-version-of-the-bdx-droid ; Tindie 1 000 $ https://www.tindie.com/products/wsk/open-duck-mini-v2-robot/
- Journaux de construction : soyeon24, seanmayer, fork Jetson. Fork Playground de LaurentFrx : https://github.com/LaurentFrx/Open_Duck_Playground
- Aucune présence documentée en évènements (JDLL, Maker Faire) ; pas de version grande taille V2 officielle.

---

## 8. Problèmes connus et limites

- Documentation : assembly_guide « incomplete » (vis, photo carte servo, expression) ; checklist runtime = TODO.
- **#48** variante C001 (1/345) plafonne ~2,7 rad/s vs 5,24 en simulation ; amplitude 31-49 % commandée ; sans réponse : https://github.com/apirrone/Open_Duck_Mini/issues/48
- **#52** servos 12 V 30 kg aux genoux : le pied ne se lève plus assez : https://github.com/apirrone/Open_Duck_Mini/issues/52
- **#49** erreurs CRC par chute de tension ; cellules ≥ 25 A ou alim labo : https://github.com/apirrone/Open_Duck_Mini/issues/49
- **Runtime #26** firmwares différents → « Parsing error in set_kps() » ; mise à jour via logiciel Feetech Windows : https://github.com/apirrone/Open_Duck_Mini_Runtime/issues/26
- **Runtime #38** Python 3.13 vs 3.11 attendu, onnxruntime 1.18.1 échoue ; `uv` + 3.11 ou Bookworm : https://github.com/apirrone/Open_Duck_Mini_Runtime/issues/38
- **Runtime #32** `find_soft_offsets` a bougé tête et jambe en même temps, casse : https://github.com/apirrone/Open_Duck_Mini_Runtime/issues/32
- Antennes qui tremblent (#13) ; contrôle de tête dangereux.
- IMU : chère ; clock stretching I²C sur Pi (Adafruit) ; README « TODO set 400KHz ? ».
- Pi Zero 2 W : 512 Mo, suffisant pour la marche ; LLM = Pi 5 ou Jetson.
- Non documenté : autonomie batterie, chauffe servos, casse PLA.
- Bugs tiers (soyeon24) : géométrie de collision, commandes de tête ignorées, reprise de checkpoint.

---

## Sources

- https://github.com/apirrone/Open_Duck_Mini · README main/v2/v1 · docs/print_guide.md · docs/assembly_guide.md · docs/configure_motors.md · docs/sim2real.md · docs/prepare_robot.md · issues #48 #49 #52
- https://github.com/apirrone/Open_Duck_Mini_Runtime · README · docs/INSTALL.md · checklist.md · example_config.json · setup.cfg · scripts/v2_rl_walk_mujoco.py · scripts/configure_motor.py · mini_bdx_runtime (rustypot_position_hwi.py, raw_imu.py) · releases · pulls · issues #26 #32 #38
- https://github.com/apirrone/Open_Duck_Playground · README · pyproject.toml · playground/common/runner.py · randomize.py · open_duck_mini_v2/joystick.py · xmls/open_duck_mini_v2.xml
- https://github.com/apirrone/Open_Duck_reference_motion_generator · README
- https://cad.onshape.com/documents/64074dfcfa379b37d8a47762/w/3650ab4221e215a4f65eb7fe/e/0505c262d882183a25049d05
- https://docs.google.com/spreadsheets/d/1gq4iWWHEJVgAA_eemkTEsshXqrYlFxXAPwO515KpCJc
- https://zihao-ai.feishu.cn/wiki/AfAtw69vRigXaRk5UkbcrAiLnJw · https://zihao-ai.feishu.cn/wiki/space/7488517034406625281 · https://tnkr.ai/explore/docs/open-duck-mini/open-duck-mini-v2
- https://github.com/pollen-robotics/Open_Duck_Blender · https://github.com/Rhoban/bam · https://github.com/pollen-robotics/rustypot · https://github.com/rimim/AWD · https://github.com/SteveNguyen/openduckminiv2_playground · https://github.com/XiaohuiChen-personal/Open_Duck_Mini_Jetson · https://github.com/soyeon24/open-duck-mini-v2-build · https://github.com/seanmayer/open-duck-mini-build · https://github.com/LaurentFrx/Open_Duck_Playground
- https://github.com/apirrone · https://huggingface.co/apirrone · https://huggingface.co/blog/hugging-face-pollen-robotics-acquisition
- https://hackaday.com/2025/04/05/disneys-bipedal-bdx-series-droid-gets-the-diy-treatment/ · https://circuitdigest.com/news/google-gemma-4-e2b-runs-locally-on-robot-duck · https://makezine.com/article/maker-news/microducks-exude-macro-charm/ · https://pollen-robotics.com/microduck/blog/introducing-microduck/ · https://github.com/joeynyc/awesome-microduck · https://openelab.io/fr/blogs/learn/microduck-vs-open-duck-mini · https://frankfu.blog/openai/understanding-reinforcement-learning-through-openduck/ · https://scalablehuman.com/2026/08/14/building-open-duck-mini-v2-from-software-project-to-physical-robot/
- https://orobot.io/o/program/BROKER-2/open-duck-mini · https://aifitlab.com/products/openduckmini-open-source-version-of-the-bdx-droid · https://www.tindie.com/products/wsk/open-duck-mini-v2-robot/
- https://www.youtube.com/watch?v=tt-g_fi-eGU · https://www.youtube.com/watch?v=DajdOeYJZdk
- https://eckstein-shop.de/Feetech-STS3215-74V-19kgcm-plastic-case-metal-gear-magnetic-code-dual-shaft-TTL-serial-servo · https://openelab.io/products/seeed-studio-feetech-st3215-c001-servo-7-4v-1-345-gear-ratio · https://eu.robotshop.com/products/magnetic-encoding-servo-sts3215-74v-19kgcm · https://www.gotronic.fr/marque-feetech-133.htm · https://www.waveshare.com/bus-servo-adapter-a.htm · https://www.waveshare.com/wiki/Bus_Servo_Adapter_(A) · https://kubii.com/en/nano-computers/3455-raspberry-pi-zero-2-w-wh.html · https://www.adafruit.com/product/2472 · https://learn.adafruit.com/adafruit-bno055-absolute-orientation-sensor/python-circuitpython · https://befr.rs-online.com/web/p/micro-switches/6820831 · https://forum.onshape.com/discussion/10703/export-in-free-version
