"""Faux canard : imite les retours du robot pour tester l'appli sans matériel.

Ordres de grandeur tirés de l'estimation de consommation du projet :
pack 2S (2 x Molicel P30B), environ 17 Wh utiles, 4 W à l'arrêt,
20 à 40 W en marche ; démarche de référence de 0,54 s par cycle.
"""

from __future__ import annotations

import math
import random

PERIODE_PAS = 0.54        # s, cycle de marche de référence (medium.json)
ENERGIE_UTILE_WH = 17.0   # Wh utiles du pack 2S
P_ARRET_W = 4.0           # W, électronique + servos tenus
P_MARCHE_W = 30.0         # W, marche à pleine consigne
R_PACK = 0.05             # ohm, chute de tension sous charge
T_AMBIANTE = 22.0         # °C
TAU_THERMIQUE = 240.0     # s, constante de temps des servos
ECHAUFFEMENT = {"genoux": 28.0, "hanches": 16.0, "chevilles": 14.0, "tete": 4.0}  # °C en marche continue


class FauxCanard:
    """Batterie, températures, contacts des pieds et position, calculés à partir des consignes."""

    def __init__(self) -> None:
        self.energie_wh = ENERGIE_UTILE_WH
        self.temp = {k: T_AMBIANTE for k in ECHAUFFEMENT}
        self.phase = 0.0
        self.x = self.y = self.cap = 0.0
        self.puissance = P_ARRET_W
        self.bouge = False

    @property
    def vide(self) -> bool:
        return self.energie_wh <= 0.0

    def avancer(self, dt: float, vx: float, vy: float, wz: float,
                en_marche: bool, sprint: bool = False) -> None:
        """Fait évoluer le canard pendant dt secondes avec la consigne (m/s, m/s, rad/s)."""
        f = 1.3 if (sprint and en_marche) else 1.0
        vx, vy, wz = vx * f, vy * f, wz * f
        self.bouge = en_marche and (abs(vx) > 1e-3 or abs(vy) > 1e-3 or abs(wz) > 1e-2)

        if self.bouge:
            c, s = math.cos(self.cap), math.sin(self.cap)
            self.x += (vx * c - vy * s) * dt
            self.y += (vx * s + vy * c) * dt
            self.cap = (self.cap + wz * dt + math.pi) % (2 * math.pi) - math.pi
            self.phase = (self.phase + dt * f / PERIODE_PAS) % 1.0
            effort = min(1.0, max(abs(vx) / 0.15, abs(vy) / 0.2, abs(wz) / 1.0))
        else:
            effort = 0.0

        self.puissance = P_ARRET_W + (P_MARCHE_W - P_ARRET_W) * (0.6 + 0.4 * effort) * self.bouge
        self.energie_wh = max(0.0, self.energie_wh - self.puissance * dt / 3600.0)

        for k, delta in ECHAUFFEMENT.items():
            cible = T_AMBIANTE + delta * (0.6 + 0.4 * effort if self.bouge else 0.05)
            self.temp[k] += (cible - self.temp[k]) * min(1.0, dt / TAU_THERMIQUE)

    def etat(self) -> dict:
        soc = self.energie_wh / ENERGIE_UTILE_WH
        tension = 2 * (3.4 + 0.8 * soc) - R_PACK * self.puissance / 7.4 + random.uniform(-0.01, 0.01)
        if self.bouge:  # double appui autour des changements de pied
            gauche = self.phase < 0.6
            droit = self.phase >= 0.5 or self.phase < 0.1
        else:
            gauche = droit = True
        return {
            "simule": True,
            "batterie_v": round(tension, 2),
            "batterie_pct": round(100 * soc),
            "puissance_w": round(self.puissance, 1),
            "temperatures": {k: round(v, 1) for k, v in self.temp.items()},
            "temp_max": round(max(self.temp.values()), 1),
            "contacts": {"gauche": gauche, "droit": droit},
            "pose": {"x": round(self.x, 3), "y": round(self.y, 3), "cap": round(self.cap, 3)},
            "en_mouvement": self.bouge,
        }
