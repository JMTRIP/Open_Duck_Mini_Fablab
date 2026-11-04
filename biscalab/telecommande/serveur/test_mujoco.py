#!/usr/bin/env python3
"""Vérifie le canard virtuel sans fenêtre : debout, avance, pas de côté, rotation, arrêt.

Lancement : python test_mujoco.py [--playground CHEMIN] [--onnx CHEMIN]
"""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

from canard_mujoco import CanardMujoco

RACINE = Path(__file__).resolve().parents[3]  # dépôt Open_Duck_Mini_Fablab


def chemins(playground: Path, onnx: Path) -> tuple[Path, Path, Path]:
    dossier = playground / "playground" / "open_duck_mini_v2"
    return (dossier / "xmls" / "scene_flat_terrain_backlash.xml", onnx,
            dossier / "data" / "polynomial_coefficients.pkl")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--playground", type=Path, default=RACINE.parent / "Open_Duck_Playground")
    p.add_argument("--onnx", type=Path, default=RACINE / "BEST_WALK_ONNX_2.onnx")
    a = p.parse_args()

    c = CanardMujoco(*chemins(a.playground, a.onnx), fenetre=False)
    print(f"pas par cycle : {c.pas_par_cycle}, entrée ONNX : {c.nom_entree} ({c.type_entree.__name__})")
    resultats = []

    def phase(nom: str, duree: float, vx: float, vy: float, wz: float) -> dict:
        p0 = c.etat()["pose"]
        cap0 = cap = p0["cap"]
        dcap = 0.0  # cumulé pas à pas : plus d'un demi-tour ne doit pas repartir à -180°
        for _ in range(int(duree / 0.02)):
            c.avancer(0.02, vx, vy, wz, en_marche=True)
            nouveau = c.etat()["pose"]["cap"]
            dcap += (nouveau - cap + math.pi) % (2 * math.pi) - math.pi
            cap = nouveau
        p1 = c.etat()["pose"]
        dx, dy = p1["x"] - p0["x"], p1["y"] - p0["y"]
        avant = dx * math.cos(cap0) + dy * math.sin(cap0)       # dans le repère de départ
        gauche = -dx * math.sin(cap0) + dy * math.cos(cap0)
        r = {"avant": avant / duree, "gauche": gauche / duree, "rotation": dcap / duree, "chutes": c.chutes}
        print(f"{nom:<22} avant {r['avant']:+.3f} m/s   gauche {r['gauche']:+.3f} m/s   "
              f"rotation {r['rotation']:+.2f} rad/s   chutes {c.chutes}")
        return r

    r = phase("immobile 3 s", 3, 0, 0, 0)
    resultats.append((r["chutes"] == 0 and abs(r["avant"]) < 0.05, "tient debout sans consigne"))
    r = phase("avance 0,15 m/s 6 s", 6, 0.15, 0, 0)
    resultats.append((r["chutes"] == 0 and r["avant"] > 0.05, "avance"))
    r = phase("recule 0,15 m/s 4 s", 4, -0.15, 0, 0)
    resultats.append((r["chutes"] == 0 and r["avant"] < -0.03, "recule"))
    r = phase("pas à gauche 4 s", 4, 0, 0.2, 0)
    resultats.append((r["chutes"] == 0 and r["gauche"] > 0.03, "pas de côté à gauche"))
    r = phase("tourne à gauche 4 s", 4, 0, 0, 1.0)
    resultats.append((r["chutes"] == 0 and r["rotation"] > 0.3, "tourne à gauche"))
    r = phase("tourne à droite 4 s", 4, 0, 0, -1.0)
    resultats.append((r["chutes"] == 0 and r["rotation"] < -0.3, "tourne à droite"))
    r = phase("arrêt 3 s", 3, 0, 0, 0)
    resultats.append((r["chutes"] == 0 and abs(r["avant"]) < 0.05, "s'arrête et reste debout"))

    print()
    for ok, texte in resultats:
        print(("OK     " if ok else "ECHEC  ") + texte)
    echecs = sum(not ok for ok, _ in resultats)
    print(f"\n{len(resultats) - echecs}/{len(resultats)} tests réussis")
    sys.exit(1 if echecs else 0)


if __name__ == "__main__":
    main()
