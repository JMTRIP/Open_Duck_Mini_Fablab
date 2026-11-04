"""Canard virtuel : le modèle MuJoCo d'Open Duck Mini V2 piloté par la politique de marche officielle.

Même interface que FauxCanard (avancer, etat, vide, tombe) : le serveur de commande ne voit
pas la différence. La boucle reprend celle de mujoco_infer.py (Open_Duck_Playground) :
politique ONNX à 50 Hz, 10 pas de simulation de 2 ms, observation de 101 valeurs, cibles
moteur = pose « home » + 0,25 x action, limitées à 5,24 rad/s.

Batterie et températures restent approchées par FauxCanard ; position, contacts des pieds
et chutes viennent de la simulation.
"""

from __future__ import annotations

import contextlib
import math
import pickle
from pathlib import Path

import mujoco
import numpy as np
import onnxruntime as ort

from faux_canard import FauxCanard

PAS_SIM = 0.002                        # s
DECIMATION = 10                        # pas de simulation par décision de la politique
PAS_CONTROLE = PAS_SIM * DECIMATION    # 0,02 s : 50 Hz
ACTION_SCALE = 0.25
DOF_VEL_SCALE = 0.05
VITESSE_MAX_MOTEUR = 5.24              # rad/s, STS3215 en 7,4 V
SPRINT = 1.3                           # fréquence de pas en sprint (bouton LB d'origine)
REDRESSEMENT_MIN = 0.5                 # axe vertical de l'IMU : en dessous, le canard est tombé
DELAI_RELEVE = 2.0                     # s avant de remettre le canard debout


class CanardMujoco:
    def __init__(self, scene: Path, onnx: Path, coefficients: Path, fenetre: bool = True) -> None:
        self.model = mujoco.MjModel.from_xml_path(str(scene))
        self.model.opt.timestep = PAS_SIM
        self.data = mujoco.MjData(self.model)

        home = self.model.keyframe("home")
        self.qpos_home = home.qpos.copy()
        self.ctrl_home = home.ctrl.copy()
        noms = [self.model.actuator(k).name for k in range(self.model.nu)]
        ids = [self.model.joint(n).id for n in noms]
        self.adr_qpos = np.array([self.model.jnt_qposadr[i] for i in ids])
        self.adr_qvel = np.array([self.model.jnt_dofadr[i] for i in ids])

        def capteur(nom: str) -> slice:
            i = mujoco.mj_name2id(self.model, mujoco.mjtObj.mjOBJ_SENSOR, nom)
            a = self.model.sensor_adr[i]
            return slice(a, a + 3)

        self.s_gyro = capteur("gyro")
        self.s_accel = capteur("accelerometer")
        self.s_haut = capteur("upvector")
        self.sol = self.model.body("floor").id
        self.pied_g = self.model.body("foot_assembly").id    # ordre de mujoco_infer_base.py
        self.pied_d = self.model.body("foot_assembly_2").id
        self.tronc = self.model.body("trunk_assembly").id

        self.politique = ort.InferenceSession(str(onnx), providers=["CPUExecutionProvider"])
        entree = self.politique.get_inputs()[0]
        self.nom_entree = entree.name
        self.type_entree = np.float64 if "double" in entree.type else np.float32

        with open(coefficients, "rb") as f:
            premier = next(iter(pickle.load(f).values()))
        self.pas_par_cycle = int(premier["period"] * premier["fps"])  # 27 pas de 20 ms

        self.batterie = FauxCanard()  # batterie et températures approchées
        self.avec_fenetre = fenetre
        self.fenetre = None
        self.reste = 0.0
        self.temps = 0.0
        self.chutes = 0
        self.t_chute = 0.0
        self.tombe = False
        self.remettre_debout()

    # ---------- état de la simulation ----------

    def remettre_debout(self) -> None:
        mujoco.mj_resetData(self.model, self.data)
        self.data.qpos[:] = self.qpos_home
        self.data.ctrl[:] = self.ctrl_home
        mujoco.mj_forward(self.model, self.data)
        self.cibles = self.ctrl_home.copy()
        self.cibles_prec = self.ctrl_home.copy()
        nu = self.model.nu
        self.a1, self.a2, self.a3 = np.zeros(nu), np.zeros(nu), np.zeros(nu)
        self.i_phase = 0.0
        self.tombe = False

    @property
    def vide(self) -> bool:
        return self.batterie.vide

    def contacts(self) -> tuple[bool, bool]:
        gauche = droit = False
        for i in range(self.data.ncon):
            c = self.data.contact[i]
            corps = {self.model.geom_bodyid[c.geom1], self.model.geom_bodyid[c.geom2]}
            if self.sol in corps:
                gauche |= self.pied_g in corps
                droit |= self.pied_d in corps
        return gauche, droit

    # ---------- boucle ----------

    def _pas(self, consigne: np.ndarray, facteur: float) -> None:
        """Une décision de la politique (20 ms), puis 10 pas de simulation."""
        self.i_phase = (self.i_phase + facteur) % self.pas_par_cycle
        angle = 2 * math.pi * self.i_phase / self.pas_par_cycle
        accel = self.data.sensordata[self.s_accel].copy()
        accel[0] += 1.3  # même correction que mujoco_infer.py
        obs = np.concatenate([
            self.data.sensordata[self.s_gyro],
            accel,
            consigne,
            self.data.qpos[self.adr_qpos] - self.ctrl_home,
            self.data.qvel[self.adr_qvel] * DOF_VEL_SCALE,
            self.a1, self.a2, self.a3,
            self.cibles,
            np.array(self.contacts(), dtype=float),
            [math.cos(angle), math.sin(angle)],
        ]).astype(self.type_entree)
        action = self.politique.run(None, {self.nom_entree: obs[None, :]})[0][0]

        self.a3, self.a2, self.a1 = self.a2, self.a1, action.copy()
        delta = VITESSE_MAX_MOTEUR * PAS_CONTROLE
        cibles = np.clip(self.ctrl_home + action * ACTION_SCALE,
                         self.cibles_prec - delta, self.cibles_prec + delta)
        self.cibles_prec = cibles.copy()
        self.cibles = cibles
        self.data.ctrl[:] = cibles
        for _ in range(DECIMATION):
            mujoco.mj_step(self.model, self.data)

    def avancer(self, dt: float, vx: float, vy: float, wz: float,
                en_marche: bool, sprint: bool = False) -> None:
        """Avance la simulation de dt secondes (rattrape le retard par pas de 20 ms)."""
        self.batterie.avancer(dt, vx, vy, wz, en_marche, sprint)
        consigne = np.zeros(7)
        if en_marche:
            consigne[:3] = (vx, vy, wz)
        facteur = SPRINT if (sprint and en_marche) else 1.0
        self.reste = min(self.reste + dt, 5 * PAS_CONTROLE)  # au plus 100 ms de retard
        self._ouvrir_fenetre()
        with self._verrou():
            while self.reste >= PAS_CONTROLE:
                self.reste -= PAS_CONTROLE
                self.temps += PAS_CONTROLE
                self._pas(consigne, facteur)
            self._surveiller_chute()
        if self.fenetre is not None and self.fenetre.is_running():
            self.fenetre.sync()

    def _surveiller_chute(self) -> None:
        debout = self.data.sensordata[self.s_haut][2] >= REDRESSEMENT_MIN
        if not self.tombe and not debout:
            self.tombe = True
            self.chutes += 1
            self.t_chute = self.temps
        elif self.tombe and self.temps - self.t_chute > DELAI_RELEVE:
            self.remettre_debout()

    # ---------- fenêtre 3D ----------

    def _ouvrir_fenetre(self) -> None:
        if not self.avec_fenetre or self.fenetre is not None:
            return
        import mujoco.viewer
        self.fenetre = mujoco.viewer.launch_passive(self.model, self.data,
                                                    show_left_ui=False, show_right_ui=False)
        with self.fenetre.lock():
            cam = self.fenetre.cam
            cam.type = mujoco.mjtCamera.mjCAMERA_TRACKING
            cam.trackbodyid = self.tronc
            cam.distance, cam.elevation, cam.azimuth = 1.3, -18.0, 145.0

    def _verrou(self):
        if self.fenetre is not None and self.fenetre.is_running():
            return self.fenetre.lock()
        return contextlib.nullcontext()

    def fermer(self) -> None:
        if self.fenetre is not None:
            self.fenetre.close()

    # ---------- état pour le téléphone ----------

    def etat(self) -> dict:
        e = self.batterie.etat()
        gauche, droit = self.contacts()
        q = self.data.qpos
        w, x, y, z = q[3:7]
        cap = math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z))
        e.update({
            "modele": "mujoco",
            "contacts": {"gauche": bool(gauche), "droit": bool(droit)},
            "pose": {"x": round(float(q[0]), 3), "y": round(float(q[1]), 3), "cap": round(cap, 3)},
            "tombe": self.tombe,
            "chutes": self.chutes,
        })
        return e
