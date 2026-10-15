# Open Duck Mini V2 — Recherche 2 : marche, calibration et sim2real, carte des dépendances

**Périmètre.** Dépôts clonés et lus le 01/10/2026 : `Open_Duck_Mini` v2 (commit b23317a) ; `Open_Duck_Mini_Runtime` v2 (376de65, 07/09/2026) ; `Open_Duck_Playground` main (b9be205, 05/08/2025) ; `Open_Duck_reference_motion_generator` main (3d7bc6f, 03/04/2025). « Vérifié » = contrôle fait en compilant le MJCF avec MuJoCo 3.14 ou en ouvrant les ONNX ; « calcul » = calcul propre.

## 0. L'essentiel

- **Principe.** Politique PPO : MLP 101 entrées → 14 sorties (vérifié dans l'ONNX), entraînée dans MuJoCo/MJX avec récompense d'imitation de trajectoires Placo, exécutée à 50 Hz sur Pi Zero 2 W.
- **Ce qu'elle a figé** : masses/inerties du MJCF ; modèle de servo STS3215 7,4 V identifié avec BAM (P firmware ≈ 30-32, 7,4 V) ; frottement semelle TPU/sol ; jeu ±0,5° ; pose « home » ; période 0,54 s.
- **Sans réentraînement** : IDs, offsets de palonniers, calibration/orientation IMU (config), ±10 % de masse par corps.
- **Avec réentraînement** : cinématique, servo (12 V, autre rapport), gain P, tension (3S), semelle, redistribution importante de masse.
- **Attention** : la domain randomization publique couvre moins que ses commentaires ne le disent — frottement sol et CdM du tronc visent de mauvais indices (§4.2).

## 1. Chaîne complète

### 1.1 Références (Open_Duck_reference_motion_generator)
- Placo (Rhoban), `uv`, `git-lfs`, Python ==3.10.12, `placo==0.6.3` ([README](https://github.com/apirrone/Open_Duck_reference_motion_generator), [pyproject](https://github.com/apirrone/Open_Duck_reference_motion_generator/blob/main/pyproject.toml)).
- `uv run scripts/auto_waddle.py -j8 --duck open_duck_mini_v2 --sweep` → `recordings/` ; `uv run scripts/fit_poly.py --ref_motion recordings/` → `polynomial_coefficients.pkl` ; visualisation : `gait_playground.py`, `replay_motion.py`, `plot_poly_fit.py`.
- Balayage ([auto_waddle.py](https://github.com/apirrone/Open_Duck_reference_motion_generator/blob/main/scripts/auto_waddle.py), preset [medium.json](https://github.com/apirrone/Open_Duck_reference_motion_generator/blob/main/open_duck_reference_motion_generator/robots/open_duck_mini_v2/placo_presets/medium.json), plages [auto_gait.json](https://github.com/apirrone/Open_Duck_reference_motion_generator/blob/main/open_duck_reference_motion_generator/robots/open_duck_mini_v2/auto_gait.json)) : dx −0,04..0,06 m, dy −0,03..0,03 m (pas 0,02), dθ −0,3..0,3 rad (pas 0,07) → 240 mouvements (vérifié dans le pkl).
- Démarche (`medium.json`) : simple appui 0,18 s ; ratio double appui 0,5 ; hauteur CdM 0,205 m ; levée de pied 0,04 m ; tangage tronc −4° ; `feet_spacing` 0,16 ; `foot_length` 0,06 ; cou/tête 20° / −26°. **Période 0,54 s = 27 pas à 50 FPS** (`FPS = 50  # 50 for mujoco playground`, [gait_generator.py](https://github.com/apirrone/Open_Duck_reference_motion_generator/blob/main/open_duck_reference_motion_generator/gait_generator.py)).
- [fit_poly.py](https://github.com/apirrone/Open_Duck_reference_motion_generator/blob/main/scripts/fit_poly.py) : polynôme degré 15 par dimension (positions/vitesses articulaires, contacts, vitesses base).
- Placo charge **sa propre copie de l'URDF** (`robots/open_duck_mini_v2/open_duck_mini_v2.urdf`) et planifie à partir de `robot.com_world()` ([placo_walk_engine.py](https://github.com/apirrone/Open_Duck_reference_motion_generator/blob/main/open_duck_reference_motion_generator/placo_walk_engine.py)). CPU suffisant.

### 1.2 Entraînement (Open_Duck_Playground)
- `jax[cuda12]`, `playground`, tensorflow, tf2onnx ([pyproject](https://github.com/apirrone/Open_Duck_Playground/blob/main/pyproject.toml)) → **GPU NVIDIA CUDA 12**. Copier le pkl dans `playground/open_duck_mini_v2/data/`, `USE_IMITATION_REWARD=True`.
- `uv run playground/open_duck_mini_v2/runner.py --task flat_terrain_backlash --num_timesteps 300000000` (« current win » ; défaut 150 M). Tâches : `flat_terrain`, `rough_terrain`, `*_backlash` ; envs `joystick` / `standing`.
- PPO Brax, config `BerkeleyHumanoidJoystickFlatTerrain` ([runner.py](https://github.com/apirrone/Open_Duck_Playground/blob/main/playground/common/runner.py), [locomotion_params.py](https://github.com/google-deepmind/mujoco_playground/blob/main/mujoco_playground/config/locomotion_params.py)) : 8192 envs, batch 256, lr 3e-4, γ 0,97, acteur (512, 256, 128), critique avec `privileged_state`.
- Durée : 300 M pas en 1 h 11 sur RTX 3090 (68 700 pas/s, [soyeon24](https://github.com/soyeon24/open-duck-mini-v2-build)). Pas de notebook Colab Open Duck ; CPU non documenté comme viable.
- Environnement ([joystick.py](https://github.com/apirrone/Open_Duck_Playground/blob/main/playground/open_duck_mini_v2/joystick.py)) : `ctrl_dt` 0,02 s, `sim_dt` 0,002 s, épisodes 1000 pas ; cible = home + 0,25 × action, limitée 5,24 rad/s.
- Observation (101) : gyro 3, accel 3, commande 7, écart home 14, vitesses ×0,05 14, 3 dernières actions 42, cibles 14, contacts 2, phase cos/sin 2.
- Récompenses : vitesse linéaire 2,5 ; angulaire 6,0 ; couples −1e-3 ; variation actions −0,5 ; immobilité −0,2 ; alive 20 ; imitation 1,0 (position ×15, [custom_rewards.py](https://github.com/apirrone/Open_Duck_Playground/blob/main/playground/open_duck_mini_v2/custom_rewards.py)).
- Bruits : position 0,03/0,05/0,08 rad (hanches/genoux/chevilles), vitesse 2,5 rad/s, gyro 0,1, accel 0,05 ; retard actions 0-2 pas (0-40 ms) ; poussées 0,1-1 m/s toutes les 5-10 s ; commandes vx ±0,15, vy ±0,2, ωz ±1.
- Test CPU : `uv run playground/open_duck_mini_v2/mujoco_infer.py -o <onnx> --model_path <scene.xml>`.

### 1.3 Export ONNX
Automatique à chaque checkpoint (`policy_params_fn` → `export_onnx`, TF → tf2onnx) ; normalisation intégrée ; sortie tanh ([export_onnx.py](https://github.com/apirrone/Open_Duck_Playground/blob/main/playground/common/export_onnx.py)).

### 1.4 Runtime Pi Zero 2 W
- Pi OS Lite 64 bits, virtualenv, `pip install -e .` (v2) ; image prête v0.2.3 ([INSTALL.md](https://github.com/apirrone/Open_Duck_Mini_Runtime/blob/v2/docs/INSTALL.md)).
- Dépendances ([setup.cfg](https://github.com/apirrone/Open_Duck_Mini_Runtime/blob/v2/setup.cfg)) : `rustypot==0.1.0` (1 Mbps, `/dev/ttyACM0`), `onnxruntime==1.18.1` CPU, `adafruit-circuitpython-bno055==5.4.13`, fork pypot Pollen.
- `python v2_rl_walk_mujoco.py --onnx_model_path BEST_WALK_ONNX_2.onnx` ([script](https://github.com/apirrone/Open_Duck_Mini_Runtime/blob/v2/scripts/v2_rl_walk_mujoco.py)) : 50 Hz ; P **30 jambes, 8 tête** ; `action_scale` 0,25 ; `init_pos` codée en dur dans [rustypot_position_hwi.py](https://github.com/apirrone/Open_Duck_Mini_Runtime/blob/v2/mini_bdx_runtime/mini_bdx_runtime/rustypot_position_hwi.py) = keyframe `home` (vérifié) ; `./polynomial_coefficients.pkl` lu pour la période ; « Policy control budget exceeded » si dépassement.
- Pas d'interpolation entre pas. Filtre `--cutoff_frequency` désactivé par défaut, absent à l'entraînement : **ne pas l'activer** ([microduck_rl CLAUDE.md](https://github.com/pollen-robotics/microduck_rl/blob/main/CLAUDE.md)). Limitation 5,24 rad/s commentée dans le runtime.
- IMU ([raw_imu.py](https://github.com/apirrone/Open_Duck_Mini_Runtime/blob/v2/mini_bdx_runtime/mini_bdx_runtime/raw_imu.py)) : thread 50 Hz, gyro + accel (pas le quaternion), NDOF, aucun filtrage (« TODO filter spikes ») ; `--pitch_bias` sans effet avec `raw_imu`.
- Réglages sans réentraîner : `phase_frequency_factor_offset` (config ou croix ±0,05) ; LB ×1,3.
- Règle udev : `latency_timer=1` pour `ftdi_sio`, or `/dev/ttyACM*` = `cdc_acm` — vérifier le pilote.

## 2. Modèle du robot (MJCF/URDF) et régénération

- Fichiers : [xmls/open_duck_mini_v2.xml](https://github.com/apirrone/Open_Duck_Playground/tree/main/playground/open_duck_mini_v2/xmls), [open_duck_mini_v2_backlash.xml](https://github.com/apirrone/Open_Duck_Playground/blob/main/playground/open_duck_mini_v2/xmls/open_duck_mini_v2_backlash.xml), [scene_flat_terrain_backlash.xml](https://github.com/apirrone/Open_Duck_Playground/blob/main/playground/open_duck_mini_v2/xmls/scene_flat_terrain_backlash.xml) (sol friction 0,6, `priority=1`, keyframe `home`).
- Génération : onshape-to-robot depuis le document Onshape ([sim2real.md](https://github.com/apirrone/Open_Duck_Mini/blob/v2/docs/sim2real.md)). [config.json](https://github.com/apirrone/Open_Duck_Playground/blob/main/playground/open_duck_mini_v2/xmls/config.json) : seules les semelles `foot_bottom_tpu` sont des collisions ; STL simplifiés ; tous les joints en classe `sts3215` ; `sensors.xml` et `joints_properties.xml` inclus.
- Retouches manuelles après export : body `base` + site `imu` en (−0,08, 0, 0,05) ; commenter les defaults ; joints `*_backlash` (±0,5°) ; keyframe `home`. Noms attendus : `trunk_assembly`, sites `left_foot`/`right_foot`, geoms `left/right_foot_bottom_tpu` ([constants.py](https://github.com/apirrone/Open_Duck_Playground/blob/main/playground/open_duck_mini_v2/constants.py)).
- Modèle backlash (entraînement de référence) : kp 17,11 ; forcerange ±3,23 N·m ; damping 0,56 ; frictionloss 0,068 ; armature 0,027. **Piège** : [joints_properties.xml](https://github.com/apirrone/Open_Duck_Playground/blob/main/playground/open_duck_mini_v2/xmls/joints_properties.xml) actuel = 17,8 / 3,35 / 0,60 / 0,052 / 0,028 ; modèle sans backlash kp 13,37 → un réexport ne redonne pas les paramètres de référence.
- Masses (vérifié MuJoCo) : total **2,107 kg** ; tronc 0,699 ; cou + tête 0,582 (28 %) ; jambe ≈ 0,41. Masse Onshape remplacée par l'estimation slicer (`useMassPropertyOverrides: True`, [client.py](https://github.com/Rhoban/onshape-to-robot/blob/master/onshape_to_robot/onshape_api/client.py)).
- BAM : [feetech_sts3215_7_4V](https://github.com/Rhoban/bam/tree/main/bam/params/feetech_sts3215_7_4V), export [to_mujoco.py](https://github.com/Rhoban/bam/blob/main/bam/to_mujoco.py) (« deprecated ») : kp = 0,166 · P_fw · Vin · 0,97 · kt/R ; forcerange = Vin · kt/R ; damping = visqueux + kt²/R. Actionneur `vin=7.4`, `kp=32` ([actuator.py](https://github.com/Rhoban/bam/blob/main/bam/feetech/actuator.py)). Calcul m1 (kt 1,178, R 2,479) : P=30 à 7,4 V → kp ≈ 17,0 (cohérent avec 17,11) ; forcerange 3,52 vs 3,23 (identification plus ancienne).
- onshape-to-robot ([doc](https://onshape-to-robot.readthedocs.io/en/latest/), [exporteur MuJoCo](https://onshape-to-robot.readthedocs.io/en/latest/exporter_mujoco.html)) : **Onshape uniquement** (clés API, mate connectors `dof_*`, `frame_*`, `closing_*`) ; ne lit ni FreeCAD ni STEP.
- Options FreeCAD : **A** rester sur Onshape (copie, surcharges de masse, réexport, retouches) ; **B** corriger le MJCF à la main (FreeCAD `Shape.Volume`, `CenterOfMass`, `MatrixOfInertia` × densité, [wiki](https://wiki.freecad.org/Macro_CenterOfMass), ou masse PrusaSlicer, ou pesée ; Huygens ; même chose dans l'URDF Placo) ; **C** [RobotCAD/OVERCROSS](https://github.com/drfenixion/freecad.overcross) (URDF/SDF, pas MJCF) + `compile` MuJoCo ([prepare_robot.md](https://github.com/apirrone/Open_Duck_Mini/blob/v2/docs/prepare_robot.md), « outdated ») + renommage.
- Exemple chiffré (trimesh) : `head_bot_sheet.stl` seule vraie plaque 3 mm (194 × 192 × 3, 65,9 cm³) → ≈ 78 g en PMMA plein. Les « sheet » des jambes et du cou font 7-8 mm.

## 3. Calibration sur le robot réel (ordre)

1. **Configurer chaque servo avant montage** : `python configure_motor.py --id <id>` ([doc](https://github.com/apirrone/Open_Duck_Mini/blob/v2/docs/configure_motors.md), [script](https://github.com/apirrone/Open_Duck_Mini_Runtime/blob/v2/scripts/configure_motor.py)) — P 32, I 0, D 0, accélération 0, accélération max 0, mode 0, ID, position 0. IDs : droite 10-14, gauche 20-24 (hip_yaw, hip_roll, hip_pitch, knee, ankle) ; 30 neck_pitch, 31 head_pitch, 32 head_yaw, 33 head_roll. [configure_all_motors.py](https://github.com/apirrone/Open_Duck_Mini_Runtime/blob/v2/scripts/configure_all_motors.py) sur robot monté. Alternatives d'ID (Arduino SCServo [wiki Waveshare](https://waveshare.com/wiki/ST3215_Servo), `lerobot-setup-motors` [LeRobot](https://huggingface.co/docs/lerobot/so101)) **mais les réglages P/I/D/accélération restent indispensables** (modèle BAM).
2. **Vérifier** : [check_motors.py](https://github.com/apirrone/Open_Duck_Mini_Runtime/blob/v2/scripts/check_motors.py), [check_voltage.py](https://github.com/apirrone/Open_Duck_Mini_Runtime/blob/v2/scripts/check_voltage.py).
3. **Offsets** : [find_soft_offsets.py](https://github.com/apirrone/Open_Duck_Mini_Runtime/blob/v2/scripts/find_soft_offsets.py) (couple coupé, zéro manuel, écart mesuré) → `~/duck_config.json` `joints_offsets` ([example_config.json](https://github.com/apirrone/Open_Duck_Mini_Runtime/blob/v2/example_config.json)). EEPROM = TODO. Ne pas reprendre les valeurs d'un autre robot ([INSTALL.md](https://github.com/apirrone/Open_Duck_Mini_Runtime/blob/v2/docs/INSTALL.md)).
4. **IMU** : `raw_imu.py` ; `imu_server.py` + `imu_client.py --ip` ; `imu_upside_down` ; [calibrate_imu.py](https://github.com/apirrone/Open_Duck_Mini_Runtime/blob/v2/scripts/calibrate_imu.py) → `imu_calib_data.pkl` dans le répertoire courant (sinon « running uncalibrated »).
5. **Contacts** : 4 SS-10 pressés ; gauche GPIO22 (pin 15), droit GPIO27 (pin 13), pull-up, actifs bas ([assembly_guide](https://github.com/apirrone/Open_Duck_Mini/blob/v2/docs/assembly_guide.md)) ; test `mini_bdx_runtime/mini_bdx_runtime/feet_contacts.py`.
6. **Debout** : [turn_on.py](https://github.com/apirrone/Open_Duck_Mini_Runtime/blob/v2/scripts/turn_on.py) (P = 2 puis remontée) ; `start_paused: true` ; A lance. Checklist automatique non écrite ([checklist.md](https://github.com/apirrone/Open_Duck_Mini_Runtime/blob/v2/checklist.md)).
7. **Sécurité** : la boucle ne surveille ni courant ni température ; firmware : coupure 70 °C, surintensité > 2 A / 2 s, blocage > 80 % / 2 s ([datasheet traduite](https://core-electronics.com.au/attachments/uploads/sts3215-smart-servo-datasheet-translated.pdf)).

## 4. Sim2real

### 4.1 Tableau
| On change… | Ce que suppose la simulation | Remède |
|---|---|---|
| Masse / CdM | Inertiels MJCF ; masses ×U(0,9 ; 1,1) | Corriger MJCF (+ URDF), `mujoco_infer`, réentraîner si besoin |
| Semelle (TPU 40 %) | Frottement fixe (§4.2) | Garder TPU ; sinon `friction` + réentraîner |
| Rigidité | Corps rigides | Mécanique |
| Jeu | ±0,5° jambes | Mesurer ; élargir `range` + réentraîner |
| Tension | 7,4 V ; kp ±10 %, forcerange non randomisé | +13,5 % à 8,4 V, −8 % à 6,8 V (calcul) ; rester 2S ; randomiser Vin si réentraînement |
| Gain P | kp ∝ P (30) | Garder 30 |
| Servo | BAM STS3215 7,4 V, 5,24 rad/s | Nouvelle identification BAM + réentraînement |
| Latence | 50 Hz, retard 0-40 ms | < 20 ms/cycle |
| IMU | site `imu` + remappage | Config ; réentraîner si déplacée |

### 4.2 Randomisation réellement active ([randomize.py](https://github.com/apirrone/Open_Duck_Playground/blob/main/playground/common/randomize.py), MJCF compilé)
- **Actif** : masses ×U(0,9 ; 1,1) ; `frictionloss` ×U(0,9 ; 1,1) ; armature ×U(1 ; 1,05) ; kp ×U(0,9 ; 1,1) ; bruits, retards, poussées.
- **Inactif** : frottement sol (`FLOOR_GEOM_ID=0` = maillage visuel du tronc, `contype` 0 ; le sol est le geom 46) ; masse/CdM tronc (`TORSO_BODY_ID=1` = body `base` sans masse ; ±0,1 kg / ±5 cm appliqués à un corps vide, masse possiblement négative) ; jitter `qpos0` (sans effet probable) ; retard IMU (sur gravité, hors observation acteur). Indices hérités du Berkeley Humanoid ; impossible de vérifier si `BEST_WALK` a été entraîné avec ce code.

### 4.3 Retours
- Coques de Jaime : politique « still works, but may exhibit slightly reduced stability » ; conseil de réentraîner ([README](https://github.com/apirrone/Open_Duck_Mini/blob/v2/print/mods/v2_Jaimes_Mods/README.md)).
- Fork Jetson : modèle mis à jour, STS3250, réentraînement Isaac Lab ([dépôt](https://github.com/XiaohuiChen-personal/Open_Duck_Mini_Jetson)).
- ST3025 12 V : identification BAM spécifique ([duck_mini_pro_headless](https://github.com/i1Cps/duck_mini_pro_headless)).
- Microduck : actionneur BAM complet, tension et chute sous charge randomisées ; « IMU randomization CANNOT compensate a systematic mounting bias » ([microduck_rl](https://github.com/pollen-robotics/microduck_rl)).
- Non consultés : issues (robots.txt), Discord.

## 5. ONNX tel quel ?
Oui sur robot conforme (« tested to work on Open Duck hardware built to the standard specs », [INSTALL.md](https://github.com/apirrone/Open_Duck_Mini_Runtime/blob/v2/docs/INSTALL.md)) ; **aucune tolérance chiffrée**. Conditions : 14 DoF même ordre/signes/zéros ; même `home` ; 50 Hz, scale 0,25, P 30 ; STS3215 7,4 V 1/345 ; 2S ; TPU ; IMU compatible ; pkl 0,54 s. Test gratuit : masses modifiées dans le MJCF + `mujoco_infer.py` avec `BEST_WALK_ONNX_2.onnx`.

## 6. Feetech STS3215
BOM : « 7.4v ones, also called 19kg.cm » = **C001, 1/345**. 7,4 V : 19,5 kg·cm, 52 tr/min, 2,5 A ; 12 V : 30 kg·cm, 45 tr/min, 2,7 A ([Waveshare](https://www.waveshare.com/st3215-servo.htm?sku=33014), [datasheet](https://core-electronics.com.au/attachments/uploads/sts3215-smart-servo-datasheet-translated.pdf)). À éviter : 1/191 (C044), 1/147 (C046) ([SO-ARM100](https://github.com/TheRobotStudio/SO-ARM100)), 12 V. Tension : 4-7,4 V (Waveshare) vs 5-8,4 V ([Seeed/OpenELAB](https://openelab.com/products/seeed-studio-feetech-st3215-c001)). TTL half-duplex 1 Mbps, ID 0-253, 12 bits (0,088°). Bibliothèques : [rustypot](https://github.com/pollen-robotics/rustypot), pypot fork, [feetech-servo-sdk](https://pypi.org/project/feetech-servo-sdk/), LeRobot. La Waveshare transmet la tension d'entrée aux servos ([wiki](https://www.waveshare.com/wiki/Bus_Servo_Adapter_(A))).

## 7. IMU BNO055
Câblage I²C : VIN 3V3 (pin 1), GND (pin 9), SDA GPIO2 (pin 3), SCL GPIO3 (pin 5), RST NC. NDOF ; gyro + accel à 50 Hz ; [imu.py](https://github.com/apirrone/Open_Duck_Mini_Runtime/blob/v2/mini_bdx_runtime/mini_bdx_runtime/imu.py) (quaternions IMUPLUS) non utilisé par la marche ; fusion 100 Hz ([Bosch](https://www.bosch-sensortec.com/media/boschsensortec/downloads/datasheets/bst-bno055-ds000.pdf)). Clock stretching : UART (PS1 au 3,3 V, [Adafruit](https://learn.adafruit.com/bno055-absolute-orientation-sensor-with-raspberry-pi-and-beaglebone-black/hardware)) ou `dtparam=i2c_arm_baudrate=10000` ([Adafruit](https://learn.adafruit.com/circuitpython-on-raspberrypi-linux/i2c-clock-stretching)). Code UART commenté ; « TODO set 400KHz ? ».

## 8. Chaîne de dépendances
```
CAD (Onshape public / FreeCAD)
 ├─ onshape-to-robot + retouches ─► MJCF Playground ◄── BAM STS3215 7,4 V (P=30, Vin=7,4)
 └─ URDF placo ─► placo (medium.json, auto_gait.json) ─► recordings ─► fit_poly ─► pkl
                                                                 ├─► Playground/data
                                                                 └─► Runtime/scripts (période)
MJCF + pkl + DR ─► PPO (GPU, ~1 h / 300 M pas) ─► ONNX ─► Runtime (duck_config.json, imu_calib_data.pkl, init_pos, P=30, 50 Hz, scale 0,25)
```
**Si je change X → refaire Y** : géométrie → URDF, MJCF, home/init_pos, références, pkl ×2, réentraînement ; masses → inertiels MJCF/URDF, test ONNX, réentraînement si besoin ; semelle → friction + réentraînement ; servo/P/3S → BAM, joints_properties, réentraînement ; démarche → références, pkl, réentraînement ; IDs/palonniers → config ; IMU → `imu_upside_down` + recalibration (+ site `imu` + réentraînement si déplacée).

## 9. Recommandations BiscaLab
1. STS3215 C001 7,4 V 1/345, 2S, TPU 40 %, géométrie stricte.
2. Peser chaque sous-ensemble vs MJCF (2,107 kg).
3. Laser uniquement pour pièces non structurelles ; corriger les inertiels.
4. Tester la politique fournie avec `mujoco_infer.py` avant de construire.
5. Si réentraînement : corriger `FLOOR_GEOM_ID` (46) et `TORSO_BODY_ID` (2) ; modèle backlash kp 17,11 ; GPU CUDA 12.

## Non trouvé
Tolérance chiffrée ; durée de génération Placo et temps d'entraînement de `BEST_WALK` par l'auteur ; issues/Discord ; rigidité des pièces ; plage de tension officielle ; paramètres BAM 12 V.

## Sources
- https://github.com/apirrone/Open_Duck_Mini (v2) : docs/sim2real.md, prepare_robot.md, configure_motors.md, print_guide.md, assembly_guide.md, print/mods/v2_Jaimes_Mods/README.md
- https://github.com/apirrone/Open_Duck_Mini_Runtime (v2) : README, docs/INSTALL.md, setup.cfg, example_config.json, checklist.md, scripts/*, mini_bdx_runtime/*
- https://github.com/apirrone/Open_Duck_Playground : README, pyproject.toml, joystick.py, custom_rewards.py, constants.py, mujoco_infer.py, common/randomize.py, runner.py, export_onnx.py, xmls/
- https://github.com/apirrone/Open_Duck_reference_motion_generator : README, pyproject, auto_waddle.py, fit_poly.py, gait_generator.py, placo_walk_engine.py, medium.json, auto_gait.json
- https://cad.onshape.com/documents/64074dfcfa379b37d8a47762/w/3650ab4221e215a4f65eb7fe/e/0505c262d882183a25049d05 · https://docs.google.com/spreadsheets/d/1gq4iWWHEJVgAA_eemkTEsshXqrYlFxXAPwO515KpCJc/edit?usp=sharing
- https://github.com/Rhoban/bam · https://bam.readthedocs.io/en/latest/ · https://github.com/Rhoban/onshape-to-robot · https://onshape-to-robot.readthedocs.io/en/latest/
- https://github.com/google-deepmind/mujoco_playground/blob/main/mujoco_playground/config/locomotion_params.py · https://arxiv.org/html/2502.08844v1
- https://github.com/soyeon24/open-duck-mini-v2-build · https://github.com/XiaohuiChen-personal/Open_Duck_Mini_Jetson · https://github.com/i1Cps/duck_mini_pro_headless · https://github.com/pollen-robotics/microduck_rl · https://github.com/drfenixion/freecad.overcross · https://wiki.freecad.org/Macro_CenterOfMass
- https://www.waveshare.com/st3215-servo.htm?sku=33014 · https://waveshare.com/wiki/ST3215_Servo · https://www.waveshare.com/wiki/Bus_Servo_Adapter_(A) · https://core-electronics.com.au/attachments/uploads/sts3215-smart-servo-datasheet-translated.pdf · https://openelab.com/products/seeed-studio-feetech-st3215-c001 · https://github.com/TheRobotStudio/SO-ARM100 · https://huggingface.co/docs/lerobot/so101 · https://pypi.org/project/feetech-servo-sdk/ · https://github.com/pollen-robotics/rustypot
- https://learn.adafruit.com/circuitpython-on-raspberrypi-linux/i2c-clock-stretching · https://learn.adafruit.com/bno055-absolute-orientation-sensor-with-raspberry-pi-and-beaglebone-black/hardware · https://www.bosch-sensortec.com/media/boschsensortec/downloads/datasheets/bst-bno055-ds000.pdf
