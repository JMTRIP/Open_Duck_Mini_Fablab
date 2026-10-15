#!/usr/bin/env python3
"""Balise la première occurrence de chaque terme (par section) dans les pages opérationnelles :
<i class="t" data-t="slug">texte</i>. Ignore code, pre, a, titres, svg, pills, kpi, etc."""
import re, json, sys
from pathlib import Path

SRC = Path(__file__).parent / 'src'
TERMS = json.loads((SRC / 'terms.json').read_text())

# (regex, slug) — ordre : du plus spécifique au plus général
PATTERNS = [
    (r"GitHub Desktop", "github-desktop"), (r"\bGitHub\b", "github"), (r"\bGit\b", "git"),
    (r"\bpull requests?\b", "pull-request"), (r"\bforks?\b", "fork"), (r"\bclone\b", "clone"),
    (r"\bcommits?\b", "commit"), (r"\bbranches?\b", "branche"), (r"\bissues?\b", "issue"),
    (r"\bjalons?\b|\bmilestones?\b", "milestone"), (r"\bconflits?\b", "conflit"), (r"\bamont\b", "amont"),
    (r"\bMarkdown\b", "markdown"), (r"\bCSV\b", "csv"), (r"Apache-2\.0", "licence-apache"),
    (r"CAO paramétrique|paramétrique", "parametrique"), (r"\bCAO\b", "cao"), (r"\bmaillages?\b", "maillage"),
    (r"\bSTL\b", "stl"), (r"\bSTEP\b", "step"), (r"\b3MF\b", "3mf"), (r"\bFCStd\b", "fcstd"),
    (r"FreeCAD", "freecad"), (r"Onshape", "onshape"), (r"\bkerf\b", "kerf"), (r"\bjeu mécanique\b|\bjeu\b", "jeu"),
    (r"\bremplissage\b", "remplissage"), (r"\borientation\b", "orientation"), (r"\bPLA\b", "pla"), (r"\bPETG\b", "petg"),
    (r"\bTPU\b", "tpu"), (r"\binserts?\b", "insert"), (r"\broulements?\b", "roulement"), (r"PrusaSlicer", "prusaslicer"),
    (r"\bslicer\b", "slicer"), (r"\bbuse\b", "buse"), (r"\bXCS\b", "xcs"), (r"\bgravure\b", "gravure"), (r"laser CO₂|CO₂ 55 W", "laser-co2"),
    (r"\btension\b", "tension"), (r"\bcourant\b", "courant"), (r"Li-ion", "li-ion"), (r"\b18650\b", "18650"), (r"\b2S\b", "2s"),
    (r"\bBMS\b", "bms"), (r"\bUBEC\b", "ubec"), (r"\bXT30\b", "xt30"), (r"\bGPIO\b", "gpio"), (r"pull-up", "pull-up"),
    (r"I²C", "i2c"), (r"\bUART\b", "uart"), (r"bus série", "bus-serie"), (r"half-duplex", "half-duplex"),
    (r"multimètre", "multimetre"), (r"court-circuit", "court-circuit"),
    (r"STS3215", "sts3215"), (r"Waveshare", "waveshare"), (r"servomoteurs?|\bservos?\b", "servo"), (r"\bcodeur\b", "codeur"),
    (r"\bIDs?\b", "id-servo"), (r"\bcouple\b", "couple"), (r"kg·cm", "kg-cm"), (r"\bPID\b", "pid"), (r"gain P\b", "gain-p"),
    (r"backlash", "backlash"), (r"\boffsets?\b", "offset"), (r"palonniers?", "palonnier"), (r"firmwares?", "firmware"),
    (r"banc servo", "banc-servo"), (r"alimentation de laboratoire|alimentation labo", "alim-labo"), (r"potence", "potence"),
    (r"Raspberry Pi OS", "raspberry-pi-os"), (r"(?:Raspberry )?Pi Zero 2 W", "pi-zero-2w"), (r"Raspberry Pi\b", "raspberry-pi"),
    (r"microSD|carte SD", "carte-sd"), (r"\bflash(?:er|ée|é)\b", "flasher"), (r"\bSSH\b", "ssh"), (r"\bterminal\b", "terminal"),
    (r"\bPython\b", "python"), (r"virtualenv|\bvenv\b", "venv"), (r"\bpip\b", "pip"), (r"\bJSON\b", "json"), (r"\bscripts?\b", "script"),
    (r"systemd", "systemd"), (r"manette", "bluetooth-manette"),
    (r"BNO055", "bno055"), (r"\bIMU\b", "imu"), (r"accéléromètre", "accelerometre"), (r"gyroscope|\bgyro\b", "gyroscope"),
    (r"magnétomètre", "magnetometre"), (r"\bfusion\b", "fusion"), (r"quaternion", "quaternion"), (r"contacts? de pied", "contact-pied"),
    (r"\bNDOF\b", "ndof"), (r"clock stretching", "clock-stretching"),
    (r"degrés? de liberté|\bDDL\b", "ddl"), (r"cinématique", "cinematique"), (r"centre de masse", "centre-de-masse"),
    (r"polygone de sustentation", "polygone-sustentation"), (r"simple appui|double appui|phases? d'appui", "phase-appui"),
    (r"période de marche|\bpériode\b", "periode-marche"), (r"\binertiels?\b|\binertie\b", "inertie"),
    (r"MuJoCo", "mujoco"), (r"\bMJCF\b", "mjcf"), (r"\bURDF\b", "urdf"), (r"Placo", "placo"),
    (r"mouvements? de référence|démarches? de référence", "mouvement-reference"), (r"apprentissage par renforcement|\bRL\b", "rl"),
    (r"\bpolitique\b", "politique"), (r"récompenses?", "recompense"), (r"\bPPO\b", "ppo"), (r"réseau de neurones|\bMLP\b", "reseau-neurones"),
    (r"\bobservation\b", "observation"), (r"\bONNX\b", "onnx"), (r"sim2real|sim → réel", "sim2real"), (r"randomisation", "domain-randomization"),
    (r"\bGPU\b", "gpu"), (r"\bBAM\b", "bam"), (r"50 Hz", "frequence-controle"), (r"\bruntime\b", "runtime"),
    (r"pose « home »|posture « home »|pose home|posture home", "home-pose"), (r"\bCRC\b", "crc"), (r"\bsimulation\b", "simulation"),
    (r"fiches? de test", "fiche-de-test"), (r"GO ?/ ?NO-GO", "go-no-go"), (r"journal de bord", "journal-de-bord"), (r"\bBOM\b", "bom"),
    (r"FabLab", "fablab"), (r"« fini »", "dod"),
]
for _, slug in PATTERNS:
    assert slug in TERMS, slug

SKIP_TAGS = {'code', 'pre', 'a', 'h1', 'h2', 'h3', 'h4', 'svg', 'summary', 'th', 'title', 'kbd', 'i', 'b', 'button', 'input', 'label', 'style', 'script', 'textarea'}
SKIP_CLASS = ('pill', 'eyebrow', 'kpi', 'tree', 'phase', 'wire', 'sb-', 'tb-', 'sheet', 'tabbar', 'path', 'gl')
TOKEN = re.compile(r'(<[^>]+>)')

def mark_section(html: str) -> str:
    for pat, slug in PATTERNS:
        rx = re.compile(pat)
        parts = TOKEN.split(html)
        stack = []  # (tag, skip)
        done = False
        for i, part in enumerate(parts):
            if not part:
                continue
            if part.startswith('<'):
                if part.startswith('</'):
                    name = re.match(r'</\s*([a-zA-Z0-9]+)', part).group(1).lower()
                    # dépiler jusqu'au tag
                    for j in range(len(stack) - 1, -1, -1):
                        if stack[j][0] == name:
                            del stack[j:]
                            break
                elif part.startswith('<!--') or part.endswith('/>'):
                    continue
                else:
                    m = re.match(r'<\s*([a-zA-Z0-9]+)', part)
                    if not m:
                        continue
                    name = m.group(1).lower()
                    if name in ('br', 'hr', 'img', 'input', 'meta', 'link', 'use', 'path', 'rect', 'circle', 'line'):
                        continue
                    cls = re.search(r'class="([^"]*)"', part)
                    skip = name in SKIP_TAGS or (cls and any(c in cls.group(1) for c in SKIP_CLASS))
                    stack.append((name, skip))
                continue
            if any(s for _, s in stack):
                continue
            m = rx.search(part)
            if m:
                before, word, after = part[:m.start()], m.group(0), part[m.end():]
                parts[i] = f'{before}<i class="t" data-t="{slug}">{word}</i>{after}'
                done = True
                break
        if done:
            html = ''.join(parts)
    return html

def mark_file(path: Path) -> int:
    s = path.read_text()
    pieces = re.split(r'(?=<section class="page")', s)
    out = [pieces[0]] + [mark_section(p) for p in pieces[1:]]
    new = ''.join(out)
    n = new.count('<i class="t"') - s.count('<i class="t"')
    path.write_text(new)
    return n

if __name__ == '__main__':
    files = sys.argv[1:] or ['03a-accueil-projet-equipe.html', '03b-github-cao.html', '04a-fabrication-bom.html', '04b-electronique-logiciel.html', '05a-marche.html', '05b-planning-risques-formation-sources.html']
    for f in files:
        print(f, '+', mark_file(SRC / f))
