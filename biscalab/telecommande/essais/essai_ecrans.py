"""Vérifie que la télécommande tient entière dans l'écran, pour plusieurs téléphones, sous Chrome et WebKit (Safari)."""
import asyncio
import sys

from playwright.async_api import async_playwright

DOSSIER = sys.argv[1]
BASE = sys.argv[2]
ECRANS = {
    "iphone15pro": (852, 393),
    "iphoneSE": (667, 375),
    "iphoneProMax": (932, 430),
    "android": (800, 360),
    "androidLarge": (915, 412),
    "tablette": (1024, 768),
}
ELEMENTS = ["Stop : arrêt immédiat du canard", "Réglages et détails", "Mode plein soleil (contraste maximal)", "Turbo (maintenir)",
            "Antennes", "Coin-coin", "Phare (projecteur)", "Joystick de déplacement", "Joystick de rotation",
            "Commande à la voix (bientôt)", "Phrases du canard (bientôt)", "Prendre les commandes", "Voyant de marche"]


async def main():
    async with async_playwright() as p:
        for moteur in (p.chromium, p.webkit):
            nav = await (moteur.launch(channel="chrome") if moteur is p.chromium else moteur.launch())
            for nom, (l, h) in ECRANS.items():
                ctx = await nav.new_context(viewport={"width": l, "height": h}, device_scale_factor=2,
                                            is_mobile=moteur is p.chromium, has_touch=True)
                page = await ctx.new_page()
                erreurs = []
                page.on("pageerror", lambda e: erreurs.append(str(e)))
                await page.goto(BASE + "/?nom=Essai")
                await page.wait_for_timeout(1200)
                hors = []
                boites = {}
                for lab in ELEMENTS:
                    b = await page.get_by_label(lab).first.bounding_box()
                    boites[lab] = b
                    if not b or b["x"] < -0.5 or b["y"] < -0.5 or b["x"] + b["width"] > l + 0.5 or b["y"] + b["height"] > h + 0.5:
                        hors.append(lab)
                noms = list(boites)
                chevauche = [f"{a} / {b}" for i, a in enumerate(noms) for b in noms[i + 1:]
                             if boites[a] and boites[b]
                             and min(boites[a]["x"] + boites[a]["width"], boites[b]["x"] + boites[b]["width"]) - max(boites[a]["x"], boites[b]["x"]) > 1
                             and min(boites[a]["y"] + boites[a]["height"], boites[b]["y"] + boites[b]["height"]) - max(boites[a]["y"], boites[b]["y"]) > 1]
                if chevauche: print("   chevauchements :", chevauche)
                stop = await page.get_by_label("Stop : arrêt immédiat du canard").bounding_box()
                centre = stop["x"] + stop["width"] / 2
                print(f"{moteur.name:8} {nom:13} {l}x{h}  hors écran : {hors or 'rien'}  "
                      f"STOP centré à {centre:.0f}/{l / 2:.0f}  erreurs : {erreurs or 'aucune'}")
                if nom in ("iphone15pro", "iphoneSE"):
                    await page.screenshot(path=f"{DOSSIER}/ecran_{moteur.name}_{nom}.png", scale="css")
                await ctx.close()
            await nav.close()


asyncio.run(main())
