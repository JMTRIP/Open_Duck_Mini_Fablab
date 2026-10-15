#!/usr/bin/env python3
"""Icônes PWA : carré arrondi dégradé violet→bleu (charte Domo), canard original stylisé."""
from PIL import Image, ImageDraw
from pathlib import Path

OUT = Path(__file__).parent / "pwa" / "icons"
OUT.mkdir(parents=True, exist_ok=True)

def gradient(size, c1, c2):
    img = Image.new("RGBA", (size, size))
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * size)
            px[x, y] = tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3)) + (255,)
    return img

def rounded_mask(size, radius):
    m = Image.new("L", (size, size), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    return m

def duck(draw, s, color=(250, 250, 255, 255), beak=(255, 196, 92, 255), eye=(50, 40, 90, 255)):
    # Corps : ellipse ; tête : cercle ; bec : triangle ; queue : petit triangle. Formes génériques.
    cx, cy = s * 0.52, s * 0.62
    draw.ellipse((cx - s * 0.30, cy - s * 0.16, cx + s * 0.30, cy + s * 0.16), fill=color)
    hx, hy = s * 0.34, s * 0.40
    draw.ellipse((hx - s * 0.13, hy - s * 0.13, hx + s * 0.13, hy + s * 0.13), fill=color)
    draw.polygon([(hx - s * 0.12, hy + s * 0.01), (hx - s * 0.28, hy + s * 0.05), (hx - s * 0.12, hy + s * 0.08)], fill=beak)
    draw.ellipse((hx - s * 0.02, hy - s * 0.06, hx + s * 0.03, hy - s * 0.01), fill=eye)
    draw.polygon([(cx + s * 0.26, cy - s * 0.06), (cx + s * 0.40, cy - s * 0.20), (cx + s * 0.30, cy + s * 0.02)], fill=color)
    # Pattes
    for dx in (-0.06, 0.08):
        draw.line([(cx + s * dx, cy + s * 0.14), (cx + s * dx, cy + s * 0.26)], fill=beak, width=max(2, int(s * 0.03)))
        draw.line([(cx + s * dx - s * 0.05, cy + s * 0.26), (cx + s * dx + s * 0.05, cy + s * 0.26)], fill=beak, width=max(2, int(s * 0.03)))

def make(size, radius_ratio, pad_ratio, name):
    base = gradient(size, (118, 64, 230), (72, 120, 235))
    mask = rounded_mask(size, int(size * radius_ratio))
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    img.paste(base, (0, 0), mask)
    d = ImageDraw.Draw(img)
    # Dessiner le canard dans une zone réduite (padding pour maskable)
    inner = int(size * (1 - 2 * pad_ratio))
    layer = Image.new("RGBA", (inner, inner), (0, 0, 0, 0))
    duck(ImageDraw.Draw(layer), inner)
    img.alpha_composite(layer, (int(size * pad_ratio), int(size * pad_ratio)))
    img.save(OUT / name)

make(512, 0.22, 0.08, "icon-512.png")
make(192, 0.22, 0.08, "icon-192.png")
make(180, 0.0, 0.08, "apple-touch-icon.png")
make(32, 0.22, 0.04, "icon-32.png")
# Maskable : fond plein (pas d'arrondi), contenu dans la zone sûre centrale (~80 %)
base = gradient(512, (118, 64, 230), (72, 120, 235))
d = ImageDraw.Draw(base)
layer = Image.new("RGBA", (360, 360), (0, 0, 0, 0))
duck(ImageDraw.Draw(layer), 360)
base.alpha_composite(layer, (76, 76))
base.save(OUT / "icon-maskable-512.png")
print("icons ok")
