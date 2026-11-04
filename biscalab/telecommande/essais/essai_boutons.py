"""Tous les boutons au doigt : un seul doigt (iPhone et Android), puis pouce sur le joystick + second doigt (Android)."""
import asyncio
import json
import sys

from playwright.async_api import async_playwright

BASE = sys.argv[1]
resultats = []


def verifier(ok, texte):
    resultats.append(ok)
    print(("OK     " if ok else "ECHEC  ") + texte, flush=True)


async def ouvrir(p, moteur, appareil, nom):
    nav = await (moteur.launch(channel="chrome") if moteur is p.chromium else moteur.launch())
    ctx = await nav.new_context(**p.devices[appareil])
    page = await ctx.new_page()
    page.etats, page.evts, page.erreurs = [], [], []
    page.on("pageerror", lambda e: page.erreurs.append(str(e)))

    def ws(w):
        w.on("framereceived", lambda f: (page.etats if '"etat"' in f else page.evts).append(f))
    page.on("websocket", ws)
    await page.goto(f"{BASE}/?nom={nom}")
    await page.wait_for_timeout(1500)
    return nav, ctx, page


def acc(page, a):
    return json.loads(page.etats[-1])["accessoires"][a]


async def centre(page, label):
    b = await page.locator(f'[aria-label="{label}"]').first.bounding_box()
    return b["x"] + b["width"] / 2, b["y"] + b["height"] / 2


async def taper(page, label, attente=700):
    x, y = await centre(page, label)
    await page.touchscreen.tap(x, y)
    await page.wait_for_timeout(attente)


async def un_doigt(p, moteur, appareil):
    print(f"--- un doigt, {moteur.name} {appareil}")
    nav, ctx, page = await ouvrir(p, moteur, appareil, "Un-doigt")
    soleil = lambda: page.evaluate("document.documentElement.classList.contains('soleil')")
    # panneau ouvert = son calque reçoit les touchers (fermé, il les laisse passer même pendant qu'il glisse)
    panneau = lambda: page.evaluate("[...document.querySelectorAll('div')].filter(d => d.className === 'absolute inset-0 z-[70]' && d.style.pointerEvents === 'auto').length")
    await taper(page, "Prendre les commandes")
    verifier(json.loads(page.etats[-1])["pilote"]["nom"] == "Un-doigt", "onglet : prendre la main")
    await taper(page, "Mode plein soleil (contraste maximal)")
    verifier(await soleil(), "soleil : allumé en un appui")
    await taper(page, "Quitter le mode plein soleil")
    verifier(not await soleil(), "soleil : éteint en un appui")
    for a, label in (("projecteur", "Phare (projecteur)"), ("antennes", "Antennes")):
        avant = acc(page, a)
        await taper(page, label)
        un = acc(page, a)
        await taper(page, label)
        verifier(un != avant and acc(page, a) == avant, f"{label} : basculé puis rebasculé, un appui chacun")
    n = len(page.evts)
    await taper(page, "Coin-coin")
    verifier(sum('Coin' in f for f in page.evts[n:]) == 1, "coin-coin : un seul son par appui")
    await taper(page, "Commande à la voix (bientôt)", 300)
    verifier(await page.get_by_text("Bientôt : la commande").count() == 1, "micro : réagit")
    await taper(page, "Phrases du canard (bientôt)", 300)
    verifier(await page.get_by_text("Bientôt : les phrases").count() == 1, "phrases : réagit")
    await taper(page, "Réglages et détails", 900)
    verifier(await panneau() == 1, "réglages : ouvert, et reste ouvert (pas de toucher fantôme sur « Fermer »)")
    await taper(page, "Vibrations")
    verifier(await page.get_by_role("switch", name="Vibrations").get_attribute("aria-checked") == "false", "réglages : interrupteur Vibrations basculé une fois")
    await taper(page, "Vibrations")
    await taper(page, "Fermer", 900)
    verifier(await panneau() == 0, "réglages : fermé par la croix")
    await taper(page, "Réglages et détails", 900)
    await page.touchscreen.tap(20, 200)
    await page.wait_for_timeout(900)
    verifier(await panneau() == 0, "réglages : fermé en touchant le fond")
    await taper(page, "Rendre ou passer la main")
    await taper(page, "Rendre la main")
    verifier(json.loads(page.etats[-1])["pilote"] is None, "onglet puis menu : rendre la main")
    verifier(not page.erreurs, f"pas d'erreur JavaScript {page.erreurs or ''}")
    await nav.close()


async def deux_doigts(p):
    print("--- pouce sur le joystick + second doigt, chromium Pixel 7")
    nav, ctx, page = await ouvrir(p, p.chromium, "Pixel 7 landscape", "Deux-doigts")
    await taper(page, "Prendre les commandes")
    cdp = await ctx.new_cdp_session(page)
    jx, jy = await centre(page, "Joystick de déplacement")
    soleil = lambda: page.evaluate("document.documentElement.classList.contains('soleil')")

    async def avec_pouce(label, attente=500):
        bx, by = await centre(page, label)
        pouce = {"x": jx, "y": jy - 40, "id": 1}
        await cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": jx, "y": jy, "id": 1}]})
        await cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [pouce]})
        await page.wait_for_timeout(150)
        await cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [pouce, {"x": bx, "y": by, "id": 2}]})
        await page.wait_for_timeout(80)
        await cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [pouce]})
        await page.wait_for_timeout(attente)
        marche = not json.loads(page.etats[-1])["pause"]
        await cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
        await page.wait_for_timeout(300)
        return marche

    marche = await avec_pouce("Mode plein soleil (contraste maximal)")
    verifier(await soleil() and marche, "soleil allumé pendant que le canard marche au joystick")
    await avec_pouce("Quitter le mode plein soleil")
    verifier(not await soleil(), "soleil éteint, pouce sur le joystick")
    for a, label in (("projecteur", "Phare (projecteur)"), ("antennes", "Antennes")):
        avant = acc(page, a)
        await avec_pouce(label)
        verifier(acc(page, a) != avant, f"{label} basculé, pouce sur le joystick")
    n = len(page.evts)
    await avec_pouce("Coin-coin")
    verifier(sum('Coin' in f for f in page.evts[n:]) == 1, "coin-coin, pouce sur le joystick")
    await avec_pouce("Réglages et détails", 900)
    verifier(await page.locator("aside").count() == 1, "réglages ouverts, pouce sur le joystick")
    await nav.close()


async def dialogue(p):
    print("--- dialogue du code administrateur, iPhone")
    await asyncio.sleep(3.5)  # jeton du test précédent libéré
    nav1, _, a = await ouvrir(p, p.webkit, "iPhone 13 landscape", "Alice")
    nav2, _, b = await ouvrir(p, p.webkit, "iPhone 13 landscape", "Bob")
    await taper(a, "Prendre les commandes")
    await taper(b, "Reprendre la main avec le code")
    verifier(await b.get_by_label("Code administrateur").count() == 1, "dialogue ouvert")
    await taper(b, "Code administrateur", 200)  # toucher le cadre ne ferme pas
    verifier(await b.get_by_label("Code administrateur").count() == 1, "toucher le cadre ne le ferme pas")
    await b.touchscreen.tap(20, 300)
    await b.wait_for_timeout(700)
    verifier(await b.get_by_label("Code administrateur").count() == 0, "toucher le fond le ferme")
    await taper(b, "Reprendre la main avec le code")
    await b.get_by_label("Code administrateur").fill("1111")
    box = await b.get_by_text("REPRENDRE", exact=True).bounding_box()
    await b.touchscreen.tap(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
    await b.wait_for_timeout(1500)
    verifier(json.loads(b.etats[-1])["pilote"]["nom"] == "Bob", "bon code : Bob reprend la main (envoi une seule fois)")
    await nav1.close()
    await nav2.close()


async def accueil(p):
    print("--- accueil, iPhone")
    nav = await p.webkit.launch()
    ctx = await nav.new_context(**p.devices["iPhone 13 landscape"])
    page = await ctx.new_page()
    await page.goto(BASE + "/")
    await page.wait_for_timeout(800)
    champ = page.locator("input").first
    await champ.fill("Léa")
    box = await page.get_by_text("C'EST PARTI", exact=False).first.bounding_box()
    await page.touchscreen.tap(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
    await page.wait_for_timeout(1200)
    verifier(await page.get_by_label("Stop : arrêt immédiat du canard").count() == 1, "accueil : ENTRER mène au pilotage")
    await nav.close()


async def clavier(p):
    print("--- clavier, chromium")
    nav = await p.chromium.launch(channel="chrome")
    page = await nav.new_page(viewport={"width": 932, "height": 430})
    await page.goto(BASE + "/?nom=Clavier")
    await page.wait_for_timeout(1200)
    await page.get_by_label("Mode plein soleil (contraste maximal)").focus()
    await page.keyboard.press("Enter")
    await page.wait_for_timeout(300)
    verifier(await page.evaluate("document.documentElement.classList.contains('soleil')"), "Entrée sur le bouton soleil : une bascule")
    await page.get_by_label("Quitter le mode plein soleil").click()
    await page.wait_for_timeout(300)
    verifier(not await page.evaluate("document.documentElement.classList.contains('soleil')"), "clic souris : une bascule")
    await nav.close()


async def main():
    async with async_playwright() as p:
        await un_doigt(p, p.webkit, "iPhone 13 landscape")
        await un_doigt(p, p.chromium, "Pixel 7 landscape")
        await deux_doigts(p)
        await dialogue(p)
        await accueil(p)
        await clavier(p)
    print(f"\n{sum(resultats)}/{len(resultats)} vérifications")


asyncio.run(main())
