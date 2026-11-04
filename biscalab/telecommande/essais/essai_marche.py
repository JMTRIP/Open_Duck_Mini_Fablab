"""Marche à l'homme mort, vue du téléphone : prêt, en marche, STOP joystick tenu, lâcher, repos."""
import asyncio
import json
import sys

from playwright.async_api import async_playwright

DOSSIER, BASE = sys.argv[1], sys.argv[2]
resultats = []


async def main():
    async with async_playwright() as p:
        nav = await p.chromium.launch(channel="chrome", headless=True)
        page = await nav.new_page(viewport={"width": 932, "height": 430}, device_scale_factor=2, has_touch=True)
        erreurs = []
        page.on("console", lambda m: erreurs.append(f"{m.type}: {m.text}") if m.type in ("error", "warning") else None)
        page.on("pageerror", lambda e: erreurs.append(f"pageerror: {e}"))
        etats = []
        page.on("websocket", lambda w: w.on("framereceived", lambda f: etats.append(f) if '"etat"' in f else None))

        voyant = page.get_by_label("Voyant de marche")

        async def lire():
            return (await voyant.get_attribute("aria-label")).replace("Voyant de marche : ", "")

        async def attendu(texte, quoi, delai=350):
            await page.wait_for_timeout(delai)
            v = await lire()
            ok = v.startswith(texte)
            resultats.append(ok)
            print(("OK     " if ok else "ECHEC  ") + f"{quoi} -> « {v} »")

        await page.goto(BASE + "/?nom=Essai")
        await page.wait_for_timeout(1500)
        await attendu("LIBRE", "personne ne pilote")
        await page.get_by_label("Prendre les commandes").click()
        await attendu("PRÊT, pousse un joystick", "jeton pris", 600)
        await page.screenshot(path=DOSSIER + "/m1_pret.png", scale="css")

        joy = await page.get_by_label("Joystick de déplacement").bounding_box()
        cx, cy = joy["x"] + joy["width"] / 2, joy["y"] + joy["height"] / 2
        await page.mouse.move(cx, cy)
        await page.mouse.down()
        await page.mouse.move(cx, cy - 55, steps=5)
        await attendu("EN MARCHE", "joystick poussé")
        await page.screenshot(path=DOSSIER + "/m2_marche.png", scale="css")

        await page.keyboard.press("Escape")  # STOP, joystick toujours tenu
        await attendu("STOP, lâche les joysticks", "STOP, joystick tenu")
        await page.screenshot(path=DOSSIER + "/m3_lache.png", scale="css")
        await attendu("STOP, lâche les joysticks", "1,5 s après, toujours tenu", 1500)
        await page.mouse.up()
        await attendu("PRÊT", "joystick lâché")

        await page.mouse.move(cx, cy)
        await page.mouse.down()
        await page.mouse.move(cx + 40, cy - 40, steps=5)
        await attendu("EN MARCHE", "repoussé : il repart")
        await page.mouse.up()
        await attendu("EN MARCHE", "lâché depuis 1 s : il piétine encore", 1000)
        await attendu("PRÊT", "lâché depuis 2,5 s : il se pose", 1500)
        dernier = json.loads(etats[-1])
        print("        état :", {k: dernier[k] for k in ("pause", "pret", "raison")})

        await page.keyboard.press("Escape")  # STOP sans rien tenir
        await attendu("STOP, un instant", "STOP, rien de tenu", 250)
        await page.screenshot(path=DOSSIER + "/m5_stop.png", scale="css")
        await attendu("PRÊT", "une seconde après le STOP", 1200)

        await page.get_by_label("Mode plein soleil (contraste maximal)").click()
        await page.mouse.move(cx, cy)
        await page.mouse.down()
        await page.mouse.move(cx, cy - 55, steps=5)
        await attendu("EN MARCHE", "plein soleil, en marche")
        await page.screenshot(path=DOSSIER + "/m4_soleil_marche.png", scale="css")
        await page.mouse.up()
        await page.get_by_label("Quitter le mode plein soleil").click()

        print("erreurs console :", erreurs or "aucune")
        print(f"{sum(resultats)}/{len(resultats)} vérifications")
        await nav.close()


asyncio.run(main())
