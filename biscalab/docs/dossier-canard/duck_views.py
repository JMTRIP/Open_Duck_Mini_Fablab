#!/usr/bin/env python3
"""Silhouettes du canard pour la page : vue de côté et vue de face, pièce par pièce.

Calculées depuis le modèle de simulation du dépôt (mini_bdx/robots/open_duck_mini_v2/robot.xml
et ses STL), mis dans la posture « home » de la marche fournie. Chaque pièce imprimable devient un
contour SVG que la page colore selon le registre des pièces ; le matériel (servos, cartes, cellules)
reste en gris pour que l'on reconnaisse le robot.

Lancer :  python3 duck_views.py        (depuis n'importe où ; cherche le modèle à la racine du dépôt)
Sortie :  src/duck.json, injecté dans la page à la place de __DUCK__ par build.py.
À relancer seulement si le modèle amont change. Dépendances : numpy, trimesh, shapely.
"""
import json
import math
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

import numpy as np
import shapely
import trimesh
from shapely import union_all, set_precision
from shapely.geometry import MultiPolygon, Polygon

ROOT = Path(__file__).resolve().parent
CANDIDATES = [ROOT.parents[2] / "mini_bdx/robots/open_duck_mini_v2", Path("/home/claude/open_duck_mini_fablab/mini_bdx/robots/open_duck_mini_v2")]
MODEL = next((p for p in CANDIDATES if (p / "robot.xml").exists()), None)
if MODEL is None:
    sys.exit("Modèle introuvable : " + " ; ".join(str(p) for p in CANDIDATES))

# Posture « home » de la politique fournie (keyframe du Playground, scene_flat_terrain.xml), en radians.
HOME = {
    "left_hip_yaw": 0.002, "left_hip_roll": 0.053, "left_hip_pitch": -0.63, "left_knee": 1.368, "left_ankle": -0.784,
    "neck_pitch": 0.0, "head_pitch": 0.0, "head_yaw": 0.0, "head_roll": 0.0,
    "right_hip_yaw": -0.003, "right_hip_roll": -0.065, "right_hip_pitch": 0.635, "right_knee": 1.379, "right_ankle": -0.796,
}
# Nom du maillage dans le modèle → nom de la pièce dans le registre (fichiers de print/)
PRINT = {
    "foot_top": "foot_top", "foot_side": "foot_side", "foot_bottom_pla": "foot_bottom_pla", "foot_bottom_tpu": "foot_bottom_tpu",
    "left_knee_to_ankle_left_sheet": "knee_to_ankle_left_sheet", "left_knee_to_ankle_right_sheet": "knee_to_ankle_right_sheet",
    "leg_spacer": "leg_spacer", "left_roll_to_pitch": "left_roll_to_pitch", "right_roll_to_pitch": "right_roll_to_pitch",
    "roll_motor_bottom": "roll_motor_bottom", "roll_motor_top": "roll_motor_top",
    "trunk_bottom": "trunk_bottom", "trunk_top": "trunk_top", "neck_left_sheet": "neck_left_sheet", "neck_right_sheet": "neck_right_sheet",
    "head_pitch_to_yaw": "head_pitch_to_yaw", "head_yaw_to_roll": "head_yaw_to_roll", "head_roll_mount": "head_roll_mount", "head": "head", "head_bot_sheet": "head_bot_sheet",
    "left_antenna_holder": "left_antenna_holder", "right_antenna_holder": "right_antenna_holder", "left_cache": "left_cache", "right_cache": "right_cache",
    "body_front": "body_front", "body_middle_bottom": "body_middle_bottom", "body_middle_top": "body_middle_top", "body_back": "body_back", "battery_pack_lid": "battery_pack_lid",
}
# Matériel qu'on dessine en gris (le reste du modèle est ignoré : palonniers, roulements, câbles)
HARDWARE = {"wj-wk00-0122topcabinetcase_95", "wj-wk00-0123middlecase_56", "wj-wk00-0124bottomcase_45", "cell", "board", "raspberrypizerow", "bno055", "bms", "sg90", "antenna", "usb_c_charger", "power_switch", "holder"}


def quat_to_mat(q):
    w, x, y, z = q
    n = math.sqrt(w * w + x * x + y * y + z * z) or 1.0
    w, x, y, z = w / n, x / n, y / n, z / n
    return np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
    ])


def pose(pos, quat):
    T = np.eye(4)
    T[:3, :3] = quat_to_mat(quat)
    T[:3, 3] = pos
    return T


def axis_angle(axis, ang):
    a = np.array(axis, dtype=float)
    a /= np.linalg.norm(a) or 1.0
    x, y, z = a
    c, s, C = math.cos(ang), math.sin(ang), 1 - math.cos(ang)
    R = np.array([
        [c + x * x * C, x * y * C - z * s, x * z * C + y * s],
        [y * x * C + z * s, c + y * y * C, y * z * C - x * s],
        [z * x * C - y * s, z * y * C + x * s, c + z * z * C],
    ])
    T = np.eye(4)
    T[:3, :3] = R
    return T


def vec(s, default):
    return np.array([float(v) for v in s.split()]) if s else np.array(default, dtype=float)


MESHES = {}


def mesh(name):
    if name not in MESHES:
        m = trimesh.load(MODEL / (name + ".stl"), force="mesh")
        MESHES[name] = (np.asarray(m.vertices, dtype=float), np.asarray(m.faces, dtype=int))
    return MESHES[name]


instances = []   # (mesh, piece or None, hardware?, world vertices, faces)
counts = {}


def walk(body, T):
    T = T @ pose(vec(body.get("pos"), [0, 0, 0]), vec(body.get("quat"), [1, 0, 0, 0]))
    for j in body.findall("joint"):
        ang = HOME.get(j.get("name"), 0.0)
        if ang:
            jp = vec(j.get("pos"), [0, 0, 0])
            t1, t2 = np.eye(4), np.eye(4)
            t1[:3, 3] = jp
            t2[:3, 3] = -jp
            T = T @ t1 @ axis_angle(vec(j.get("axis"), [0, 0, 1]), ang) @ t2
    for g in body.findall("geom"):
        if g.get("type") != "mesh":
            continue
        name = g.get("mesh")
        piece = PRINT.get(name)
        if piece is None and name not in HARDWARE:
            continue
        Tg = T @ pose(vec(g.get("pos"), [0, 0, 0]), vec(g.get("quat"), [1, 0, 0, 0]))
        v, f = mesh(name)
        w = (Tg[:3, :3] @ v.T).T + Tg[:3, 3]
        ex = None
        if piece:
            counts[piece] = counts.get(piece, 0) + 1
            ex = counts[piece]
        instances.append((name, piece, ex, w, f))
    for child in body.findall("body"):
        walk(child, T)


root = ET.parse(MODEL / "robot.xml").getroot()
for b in root.find("worldbody").findall("body"):
    walk(b, np.eye(4))


def silhouette(P, f, hull=False):
    """Contour 2D (mm) d'un maillage projeté : union des triangles, ou enveloppe convexe pour le matériel."""
    if hull:
        return shapely.MultiPoint(P).convex_hull.simplify(0.3)
    tris = P[f]
    a = 0.5 * np.abs((tris[:, 1, 0] - tris[:, 0, 0]) * (tris[:, 2, 1] - tris[:, 0, 1]) - (tris[:, 2, 0] - tris[:, 0, 0]) * (tris[:, 1, 1] - tris[:, 0, 1]))
    tris = tris[a > 0.01]
    polys = set_precision(shapely.polygons(tris), 0.05)
    u = union_all(polys).buffer(0.05).buffer(-0.05)   # referme les micro-fentes entre triangles
    return u.simplify(0.25)


def path_of(geom):
    polys = list(geom.geoms) if isinstance(geom, MultiPolygon) else [geom] if isinstance(geom, Polygon) else []
    out = []
    for pg in polys:
        if pg.is_empty or pg.area < 2:
            continue
        for ring in [pg.exterior] + list(pg.interiors):
            pts = list(ring.coords)[:-1]
            if len(pts) < 3:
                continue
            out.append("M" + " ".join("%.1f,%.1f" % (x, y) for x, y in pts) + "Z")
    return "".join(out)


VIEWS = {
    # Le robot regarde vers -x. Vue de côté : depuis sa gauche (+y), tête vers la droite de l'image ; loin = petit y, dessiné d'abord.
    "side": (lambda w: np.column_stack([-w[:, 0], -w[:, 2]]) * 1000.0, lambda w: w[:, 1].mean()),
    # Vue de face : le robot regarde le lecteur (lecteur en -x) ; sa gauche à droite de l'image ; loin = grand x, dessiné d'abord.
    "front": (lambda w: np.column_stack([-w[:, 1], -w[:, 2]]) * 1000.0, lambda w: -w[:, 0].mean()),
}
out = {"views": {}, "counts": counts}
for view, (proj, depth) in VIEWS.items():
    parts, minx, miny, maxx, maxy = [], 1e9, 1e9, -1e9, -1e9
    for name, piece, ex, w, f in instances:
        P = proj(w)
        geom = silhouette(P, f, hull=piece is None)
        d = path_of(geom)
        if not d:
            continue
        bx = geom.bounds
        minx, miny, maxx, maxy = min(minx, bx[0]), min(miny, bx[1]), max(maxx, bx[2]), max(maxy, bx[3])
        parts.append({"mesh": name, "piece": piece, "ex": ex, "hw": piece is None, "z": round(float(depth(w)), 4), "d": d})
    parts.sort(key=lambda p: p["z"])   # loin d'abord
    for p in parts:
        del p["z"]
    m = 6
    out["views"][view] = {"box": [round(minx - m, 1), round(miny - m, 1), round(maxx - minx + 2 * m, 1), round(maxy - miny + 2 * m, 1)], "parts": parts}
    print(view, len(parts), "contours ·", sum(len(p["d"]) for p in parts), "caractères")

(ROOT / "src" / "duck.json").write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
print("pièces imprimables :", sum(1 for i in instances if i[1]), "exemplaires ·", {k: v for k, v in counts.items()})
