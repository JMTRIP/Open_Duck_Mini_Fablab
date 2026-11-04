"""Changement de réseau depuis l'appli : section Réseau des Réglages, code, consigne affichée à tous.
Lance lui-même un serveur d'essai avec un faux réseau (aucune bascule réelle).
Lancement : python essais/essai_reseau.py <dossier-captures>"""
import asyncio
import sys
import time
from pathlib import Path

from aiohttp import web
from playwright.async_api import async_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "serveur"))
import canard_serveur as cs  # noqa: E402

DOSSIER = sys.argv[1]
CODE = "1111"
resultats = []


def verifier(ok, texte):
    resultats.append(bool(ok))
    print(("OK     " if ok else "ECHEC  ") + texte, flush=True)


class FauxReseau(cs.Reseau):
    def __init__(self):
        super().__init__(dispo=False)
        self.dispo = True
        self.mode, self.nom, self.adresse = "canard", "Canard-BiscaLab", "10.42.0.1"
        self.dernier_wifi = {"nom": "biscalab 3", "adresse": "192.168.1.19"}
        self.lances = []

    async def lire(self):
        pass

    async def ssid_de(self, profil):
        return "Canard-BiscaLab"

    async def lancer(self, vers):
        self.lances.append(vers)
        self.bascule_a = time.monotonic()
        return True


async def taper(page, cible, attente=700):
    b = await cible.bounding_box()
    await page.touchscreen.tap(b["x"] + b["width"] / 2, b["y"] + b["height"] / 2)
    await page.wait_for_timeout(attente)


async def main():
    reseau = FauxReseau()
    runner = web.AppRunner(cs.creer_app(CODE, appli=cs.DOSSIER_REACT, reseau=reseau))
    await runner.setup()
    site = web.TCPSite(runner, "127.0.0.1", 0)
    await site.start()
    base = f"http://127.0.0.1:{site._server.sockets[0].getsockname()[1]}"
    async with async_playwright() as p:
        for moteur, appareil in ((p.webkit, "iPhone 13 landscape"), (p.chromium, "Pixel 7 landscape")):
            print(f"--- {moteur.name} {appareil}")
            reseau.lances.clear()
            reseau.bascule_a = -1e9
            nav = await (moteur.launch(channel="chrome") if moteur is p.chromium else moteur.launch())
            a = await (await nav.new_context(**p.devices[appareil])).new_page()
            b = await (await nav.new_context(**p.devices[appareil])).new_page()
            for page, nom in ((a, "Alice"), (b, "Bob")):
                await page.goto(f"{base}/?nom={nom}")
                await page.wait_for_timeout(1500)
            await taper(a, a.get_by_label("Réglages et détails"), 1000)
            aside = a.locator("aside")
            verifier(await aside.get_by_text("Son réseau « Canard-BiscaLab »").count() == 1, "réglages : réseau en cours affiché")
            bouton = aside.get_by_text("PASSER SUR « BISCALAB 3 »")
            verifier(await bouton.count() == 1, "réglages : bouton pour passer sur le Wi-Fi du club")
            await aside.evaluate("e => e.scrollTo(0, e.scrollHeight)")
            await a.wait_for_timeout(300)
            await a.screenshot(path=f"{DOSSIER}/reseau_reglages_{moteur.name}.png", scale="css")
            await taper(a, bouton)
            verifier(await a.get_by_text("CHANGER DE RÉSEAU").count() == 1, "le bouton demande le code administrateur")
            await a.get_by_label("Code administrateur").fill("0000")
            await taper(a, a.get_by_text("CHANGER", exact=True), 1600)
            verifier(not reseau.lances, "code faux : rien n'est lancé")
            await taper(a, bouton)
            await a.get_by_label("Code administrateur").fill(CODE)
            await taper(a, a.get_by_text("CHANGER", exact=True), 1200)
            verifier(reseau.lances == ["wifi"], "bon code : changement de réseau lancé")
            for page, nom in ((a, "Alice"), (b, "Bob")):
                carte = page.get_by_role("alertdialog")
                ok = await carte.count() == 1 and "biscalab 3" in await carte.inner_text()
                lien = await page.locator('[role="alertdialog"] a').get_attribute("href") if ok else None
                verifier(ok and lien and lien.startswith("http://192.168.1.19"), f"{nom} voit quel Wi-Fi rejoindre et l'adresse ({lien})")
            await b.screenshot(path=f"{DOSSIER}/reseau_consigne_{moteur.name}.png", scale="css")
            fermer = b.get_by_role("alertdialog").get_by_text("FERMER", exact=True)
            await taper(b, fermer, 1500)
            verifier(await b.get_by_role("alertdialog").count() == 0, "la consigne se ferme")
            await nav.close()
    await runner.cleanup()
    print(f"\n{sum(resultats)}/{len(resultats)} vérifications réussies")


asyncio.run(main())
