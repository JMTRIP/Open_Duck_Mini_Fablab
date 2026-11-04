"""Rendre la main (menu sous l'onglet), Réglages agrandis, nombres à virgule."""
import asyncio
import json
import re
import sys

from playwright.async_api import async_playwright

DOSSIER, BASE = sys.argv[1], sys.argv[2]
resultats = []
DEBORDS = """(() => [...document.querySelectorAll('aside *')]
  .filter(e => e.children.length === 0 && e.textContent.trim() && e.scrollWidth > e.clientWidth + 1)
  .map(e => e.textContent.trim()))()"""


def verifier(ok, texte):
    resultats.append(bool(ok))
    print(("OK     " if ok else "ECHEC  ") + texte, flush=True)


async def ouvrir(p, moteur, appareil, nom):
    nav = await (moteur.launch(channel="chrome") if moteur is p.chromium else moteur.launch())
    ctx = await nav.new_context(**p.devices[appareil])
    page = await ctx.new_page()
    page.etats = []
    page.on("websocket", lambda w: w.on("framereceived", lambda f: page.etats.append(f) if '"etat"' in f else None))
    await page.goto(f"{BASE}/?nom={nom}")
    await page.wait_for_timeout(1500)
    return nav, page


async def taper(page, label, attente=700):
    b = await page.locator(f'[aria-label="{label}"]').first.bounding_box()
    await page.touchscreen.tap(b["x"] + b["width"] / 2, b["y"] + b["height"] / 2)
    await page.wait_for_timeout(attente)


def pilote(page):
    p = json.loads(page.etats[-1])["pilote"]
    return p["nom"] if p else None


async def main():
    async with async_playwright() as p:
        for moteur, appareil in ((p.webkit, "iPhone 13 landscape"), (p.chromium, "Pixel 7 landscape")):
            print(f"--- {moteur.name} {appareil}")
            nav, a = await ouvrir(p, moteur, appareil, "Alice")
            nav2, b = await ouvrir(p, p.chromium, "Pixel 7 landscape", "Bob")
            menu = lambda: a.locator('[role="menu"]').count()
            await taper(a, "Prendre les commandes", 1800)
            verifier(await a.get_by_text("Pour rendre la main").count() == 1, "astuce affichée en prenant la main")
            await taper(a, "Rendre ou passer la main")
            verifier(await menu() == 1 and pilote(a) == "Alice", "un toucher sur son nom : menu ouvert, toujours pilote")
            j = await a.get_by_label("Joystick de déplacement").bounding_box()
            await a.touchscreen.tap(j["x"] + 40, j["y"] + 120)
            await a.wait_for_timeout(500)
            verifier(await menu() == 0 and pilote(a) == "Alice", "toucher ailleurs : menu fermé, toujours pilote")
            await taper(a, "Rendre ou passer la main")
            await a.screenshot(path=f"{DOSSIER}/menu_{moteur.name}.jpg", type="jpeg", quality=55, scale="css")
            await taper(a, "Passer la main à un autre téléphone", 1000)
            verifier(await a.locator("aside").count() == 1, "« passer la main… » ouvre les réglages")
            debords = await a.evaluate(DEBORDS)
            verifier(not debords, f"réglages : aucun texte qui déborde {debords or ''}")
            texte = await a.locator("aside").inner_text()
            points = re.findall(r"\d\.\d", texte.replace("Télécommande 0.2", ""))  # numéro de version : point gardé
            verifier(not points and re.search(r"\d,\d", texte), f"réglages : nombres à virgule {points or ''}")
            radar = await a.locator("text=VX").first.evaluate("e => e.parentElement.innerText")
            verifier("," in radar and "." not in radar, f"radar : {radar.split()[0:3]}")
            if moteur is p.webkit:
                await a.screenshot(path=f"{DOSSIER}/reglages2_{moteur.name}.jpg", type="jpeg", quality=55, scale="css")
            bt = await a.locator("aside").get_by_text("RENDRE LA MAIN", exact=True).bounding_box()  # sa propre ligne
            await a.touchscreen.tap(bt["x"] + bt["width"] / 2, bt["y"] + bt["height"] / 2)
            await a.wait_for_timeout(700)
            verifier(pilote(a) is None, "réglages : « rendre la main » sur sa ligne")
            await taper(a, "Fermer", 900)
            await taper(a, "Prendre les commandes", 900)
            await taper(a, "Rendre ou passer la main")
            await taper(a, "Rendre la main")
            verifier(pilote(a) is None and await menu() == 0, "menu : « rendre la main » en deux touchers")
            await nav.close()
            await nav2.close()
            await asyncio.sleep(3.5)
    print(f"\n{sum(resultats)}/{len(resultats)} vérifications")


asyncio.run(main())
