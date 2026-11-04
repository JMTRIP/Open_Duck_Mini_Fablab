#!/usr/bin/env python3
"""Tests du serveur de commande : pages, jeton, STOP, chien de garde, reconnexion.

Lancement : python test_serveur.py   (environ 15 secondes, aucun matériel)
"""

from __future__ import annotations

import asyncio
import json
import secrets
import sys

import aiohttp
from aiohttp import web
from yarl import URL

import canard_serveur as cs

CODE = "4242"
resultats: list[tuple[bool, str]] = []


def verifier(ok: bool, texte: str) -> None:
    resultats.append((bool(ok), texte))
    print(("OK     " if ok else "ECHEC  ") + texte, flush=True)


class Tel:
    """Un faux téléphone : se connecte, lit l'état, envoie des consignes."""

    def __init__(self, session: aiohttp.ClientSession, url: str, nom: str, id_: str | None = None) -> None:
        self.session, self.url, self.nom = session, url, nom
        self.id = id_ or secrets.token_hex(16)
        self.etat: dict | None = None
        self.nouvel_etat = asyncio.Event()
        self.file: asyncio.Queue = asyncio.Queue()
        self.num: int | None = None
        self.axes = (0.0, 0.0, 0.0)
        self.actif = False  # envoie des consignes 20 fois par seconde
        self.ferme = asyncio.Event()

    async def connecter(self) -> None:
        self.ferme.clear()
        self.ws = await self.session.ws_connect(self.url)
        self.lecteur = asyncio.create_task(self._lire())
        self.emetteur = asyncio.create_task(self._emettre())
        await self.ws.send_json({"t": "bonjour", "id": self.id, "nom": self.nom, "version": "test"})
        self.num = (await self.attendre("bienvenue"))["num"]

    async def fermer(self) -> None:
        self.actif = False
        await self.ws.close()
        await asyncio.wait_for(self.ferme.wait(), 2)

    async def _lire(self) -> None:
        async for msg in self.ws:
            if msg.type == aiohttp.WSMsgType.TEXT:
                m = json.loads(msg.data)
                if m["t"] == "etat":
                    self.etat = m
                    self.nouvel_etat.set()
                else:
                    await self.file.put(m)
        self.ferme.set()

    async def _emettre(self) -> None:
        while not self.ws.closed:
            if self.actif:
                vx, vy, wz = self.axes
                try:
                    await self.ws.send_json({"t": "cmd", "vx": vx, "vy": vy, "wz": wz, "sprint": False})
                except Exception:
                    return
            await asyncio.sleep(0.05)

    async def envoyer(self, **m) -> None:
        await self.ws.send_json(m)

    async def etat_frais(self) -> dict:
        self.nouvel_etat.clear()
        await asyncio.wait_for(self.nouvel_etat.wait(), 1)
        return self.etat

    async def attendre(self, t: str, timeout: float = 2.0, **champs) -> dict:
        boucle = asyncio.get_running_loop()
        fin = boucle.time() + timeout
        while True:
            m = await asyncio.wait_for(self.file.get(), max(0.01, fin - boucle.time()))
            if m.get("t") == t and all(m.get(k) == v for k, v in champs.items()):
                return m

    def vider(self) -> None:
        while not self.file.empty():
            self.file.get_nowait()


def vider(*tels: Tel) -> None:
    for t in tels:
        t.vider()


async def principal() -> None:
    app = cs.creer_app(CODE)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "127.0.0.1", 0)
    await site.start()
    port = site._server.sockets[0].getsockname()[1]
    base = f"http://127.0.0.1:{port}"
    url = f"{base}/ws"
    boucle = asyncio.get_running_loop()

    async with aiohttp.ClientSession() as s:
        # --- pages de l'appli ---
        async with s.get(base + "/") as r:
            verifier(r.status == 200 and r.content_type == "text/html", "page d'accueil servie")
        async with s.get(base + "/app.js") as r:
            verifier(r.status == 200 and r.content_type == "text/javascript", "app.js servi en text/javascript")
        async with s.get(URL(base + "/%2E%2E/serveur/canard_serveur.py", encoded=True)) as r:
            verifier(r.status == 404, "pas d'accès aux fichiers hors de l'appli")

        # --- arrivée ---
        a, b = Tel(s, url, "Alice"), Tel(s, url, "Bob")
        await a.connecter()
        await b.connecter()
        e = await a.etat_frais()
        verifier(e["pause"] and not e["pret"] and e["raison"] == "démarrage" and e["pilote"] is None,
                 "démarrage en pause, sans pilote")
        verifier([c["nom"] for c in e["clients"]] == ["Alice", "Bob"], "deux téléphones listés")
        verifier("id" not in json.dumps(e["clients"]), "les identifiants secrets ne sont pas diffusés")

        # --- jeton ---
        vider(a, b)
        await b.envoyer(t="marche")
        verifier((await b.attendre("erreur"))["code"] == "pas_pilote", "marche refusée sans jeton")
        await a.envoyer(t="prendre")
        await b.attendre("evenement", e="jeton")
        a.actif = True
        await asyncio.sleep(0.15)
        e = await a.etat_frais()
        verifier(e["pilote"]["num"] == a.num and e["pause"] and e["pret"],
                 "Alice prend le jeton : canard en pause, prêt à partir")
        vider(b)
        await b.envoyer(t="prendre")
        verifier((await b.attendre("erreur"))["code"] == "occupe", "Bob ne peut pas prendre un jeton tenu")

        # --- marche à l'homme mort ---
        await b.envoyer(t="cmd", vx=1, vy=0, wz=0)
        await asyncio.sleep(0.15)
        e = await b.etat_frais()
        verifier(e["pause"], "joystick d'un spectateur : le canard ne part pas")
        a.axes = (1.0, 0.0, 0.0)
        await asyncio.sleep(0.15)
        e = await b.etat_frais()
        verifier(not e["pause"] and not e["pret"], "pousser un joystick suffit pour partir")
        await asyncio.sleep(0.2)
        e = await b.etat_frais()
        verifier(not e["pause"] and abs(e["vitesse"]["vx"] - 0.15) < 1e-6, "consigne pleine = 0,15 m/s")
        await b.envoyer(t="cmd", vx=-1, vy=0, wz=0)
        e = await b.etat_frais()
        verifier(e["vitesse"]["vx"] > 0, "consigne d'un spectateur ignorée")
        a.axes = (5.0, "abc", float("nan"))
        await asyncio.sleep(0.2)
        v = (await a.etat_frais())["vitesse"]
        verifier(abs(v["vx"] - 0.15) < 1e-6 and v["vy"] == 0 and v["wz"] == 0, "valeurs hors plage ou illisibles bornées")

        # --- repos quand on lâche, reprise quand on repousse ---
        a.axes = (0.0, 0.0, 0.0)
        t0 = boucle.time()
        while not (await b.etat_frais())["pause"] and boucle.time() - t0 < 3:
            pass
        dt = boucle.time() - t0
        e = b.etat
        verifier(e["pause"] and e["pret"] and e["raison"] == "repos" and 1.9 <= dt <= 2.4,
                 f"joysticks lâchés : le canard se pose {dt:.2f} s après (attendu 2 s), prêt à repartir")
        a.axes = (0.0, 0.0, 1.0)
        await asyncio.sleep(0.15)
        e = await b.etat_frais()
        verifier(not e["pause"] and e["vitesse"]["wz"] > 0, "il repart dès qu'on repousse un joystick")

        # --- STOP par un spectateur, joystick tenu ---
        vider(a, b)
        await b.envoyer(t="stop")
        await a.attendre("evenement", e="stop")
        e = await a.etat_frais()
        verifier(e["pause"] and not e["pret"] and e["vitesse"]["wz"] == 0 and "STOP" in e["raison"],
                 "STOP d'un spectateur accepté")
        await asyncio.sleep(1.3)
        e = await a.etat_frais()
        verifier(e["pause"] and not e["pret"], "après un STOP, joystick toujours tenu : le canard reste arrêté")
        a.axes = (0.0, 0.0, 0.0)
        await asyncio.sleep(0.15)
        e = await a.etat_frais()
        verifier(e["pause"] and e["pret"], "joysticks lâchés : prêt à repartir")
        a.axes = (1.0, 0.0, 0.0)
        await asyncio.sleep(0.15)
        verifier(not (await a.etat_frais())["pause"], "lâcher puis repousser : il repart")

        # --- STOP : une seconde avant de pouvoir repartir ---
        await b.envoyer(t="stop")
        a.axes = (0.0, 0.0, 0.0)
        await asyncio.sleep(0.5)
        e = await a.etat_frais()
        verifier(e["pause"] and not e["pret"], "STOP : pas de nouveau départ avant une seconde")
        await asyncio.sleep(0.7)
        e = await a.etat_frais()
        verifier(e["pause"] and e["pret"], "STOP : prêt après une seconde, joysticks lâchés")

        # --- chien de garde ---
        a.axes = (1.0, 0.0, 0.0)
        await asyncio.sleep(0.15)
        verifier(not (await a.etat_frais())["pause"], "en marche avant de couper la liaison")
        vider(a, b)
        a.actif = False
        t0 = boucle.time()
        await b.attendre("evenement", timeout=2.5, e="liaison")
        dt = boucle.time() - t0
        verifier(0.9 <= dt <= 1.4, f"pause {dt:.2f} s après le silence du pilote (attendu 1 s)")
        await b.attendre("evenement", timeout=3.0, e="jeton")
        dt = boucle.time() - t0
        e = await b.etat_frais()
        verifier(e["pilote"] is None and 2.9 <= dt <= 3.5, f"jeton libéré {dt:.2f} s après (attendu 3 s)")

        # --- code administrateur ---
        vider(a, b)
        await a.envoyer(t="prendre")
        await a.attendre("evenement", e="jeton")
        a.actif = True
        await b.envoyer(t="prendre", code="0000")
        t0 = boucle.time()
        err = await b.attendre("erreur", timeout=3)
        verifier(err["code"] == "code" and boucle.time() - t0 >= 0.9, "code faux refusé, avec une seconde d'attente")
        vider(a, b)
        await b.envoyer(t="prendre", code=CODE)
        await a.attendre("evenement", e="jeton")
        a.actif, b.actif = False, True
        e = await b.etat_frais()
        verifier(e["pilote"]["num"] == b.num and e["pause"], "bon code : Bob reprend la main, canard en pause")

        # --- passer la main ---
        vider(a, b)
        await b.envoyer(t="passer", a=a.num)
        await a.attendre("evenement", e="jeton")
        b.actif, a.actif = False, True
        e = await a.etat_frais()
        verifier(e["pilote"]["num"] == a.num, "Bob passe la main à Alice")

        # --- ancienne appli : bouton Marche ---
        vider(a)
        await a.envoyer(t="marche")
        await a.attendre("evenement", e="reprise")
        verifier(not (await a.etat_frais())["pause"], "message « marche » de l'ancienne appli toujours accepté")

        # --- coupure et reconnexion du pilote ---
        a.axes = (1.0, 0.0, 0.0)
        await a.fermer()
        await asyncio.sleep(0.2)
        e = await b.etat_frais()
        verifier(e["pause"] and e["pilote"] and not e["pilote"]["connecte"], "pilote coupé : pause immédiate, jeton réservé")
        vider(b)
        await b.envoyer(t="prendre")
        verifier((await b.attendre("erreur"))["code"] == "occupe", "jeton réservé : Bob ne peut pas le prendre")
        await a.connecter()
        a.actif = True
        await asyncio.sleep(0.3)
        e = await a.etat_frais()
        verifier(e["pilote"]["num"] == a.num and e["pilote"]["connecte"], "Alice revient et retrouve le jeton")
        verifier(e["pause"] and not e["pret"], "elle revient joystick poussé : le canard attend qu'elle le lâche")
        a.axes = (0.0, 0.0, 0.0)

        # --- même téléphone ouvert deux fois ---
        a2 = Tel(s, url, "Alice", id_=a.id)
        await a2.connecter()
        try:
            await asyncio.wait_for(a.ferme.wait(), 2)
            remplace = True
        except asyncio.TimeoutError:
            remplace = False
        a.actif, a2.actif = False, True
        e = await a2.etat_frais()
        verifier(remplace and e["pilote"]["num"] == a2.num and len(e["clients"]) == 2,
                 "deuxième onglet : remplace le premier et garde le jeton")

        # --- accessoires ---
        vider(b)
        await a2.envoyer(t="bouton", b="projecteur")
        ev = await b.attendre("evenement", e="bouton")
        e = await b.etat_frais()
        verifier(e["accessoires"]["projecteur"] and "allumé" in ev["texte"], "projecteur allumé par le pilote")

        # --- messages invalides ---
        ws = await s.ws_connect(url)
        await ws.send_json({"t": "cmd"})
        m = json.loads((await ws.receive()).data)
        verifier(m["code"] == "bonjour_attendu", "bonjour obligatoire avant tout")
        await ws.send_str("pas du json")
        m = json.loads((await ws.receive()).data)
        verifier(m["code"] == "json", "message illisible signalé")
        await ws.send_json({"t": "bonjour", "id": "x", "nom": "Intrus"})
        m = json.loads((await ws.receive()).data)
        verifier(m["code"] == "id_invalide", "identifiant trop court refusé")
        await ws.close()

        # --- ping ---
        vider(b)
        await b.envoyer(t="ping", ts=123.5)
        verifier((await b.attendre("pong"))["ts"] == 123.5, "ping / pong")

        # --- réseau : sur un PC, pas de bascule ---
        e = await b.etat_frais()
        verifier("reseau" in e and e["reseau"] is None, "sur un PC, pas de section réseau")
        vider(b)
        await b.envoyer(t="reseau", vers="wifi", code=CODE)
        verifier((await b.attendre("erreur"))["code"] == "reseau", "sur un PC, changement de réseau refusé")

        for t in (a2, b):
            t.actif = False
            await t.ws.close()
    await runner.cleanup()
    await essais_reseau()


class FauxReseau(cs.Reseau):
    """Le Pi sur son propre réseau, sans NetworkManager : on note les bascules demandées."""

    def __init__(self) -> None:
        super().__init__(dispo=False)
        self.dispo = True
        self.mode, self.nom, self.adresse = "canard", "Canard-BiscaLab", "10.42.0.1"
        self.dernier_wifi = {"nom": "biscalab 3", "adresse": "192.168.1.19"}
        self.lances: list[str] = []

    async def lire(self) -> None:
        pass

    async def ssid_de(self, profil: str) -> str:
        return "Canard-BiscaLab"

    async def lancer(self, vers: str) -> bool:
        self.lances.append(vers)
        self.bascule_a = cs.time.monotonic()
        return True


async def essais_reseau() -> None:
    reseau = FauxReseau()
    app = cs.creer_app(CODE, reseau=reseau)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "127.0.0.1", 0)
    await site.start()
    url = f"http://127.0.0.1:{site._server.sockets[0].getsockname()[1]}/ws"
    async with aiohttp.ClientSession() as s:
        a, b = Tel(s, url, "Alice"), Tel(s, url, "Bob")
        await a.connecter()
        await b.connecter()
        e = await a.etat_frais()
        verifier(e["reseau"] == {"mode": "canard", "nom": "Canard-BiscaLab", "adresse": "10.42.0.1", "wifi_connu": "biscalab 3"},
                 "sur le Pi : réseau en cours et dernier Wi-Fi connu diffusés")
        await a.envoyer(t="reseau", vers="wifi", code="0000")
        verifier((await a.attendre("erreur"))["code"] == "code" and not reseau.lances, "changement de réseau : code faux refusé")
        await a.envoyer(t="reseau", vers="canard", code=CODE)
        verifier((await a.attendre("erreur"))["code"] == "reseau" and not reseau.lances, "déjà sur le réseau du canard : refusé")
        vider(a, b)
        await a.envoyer(t="reseau", vers="wifi", code=CODE)
        ev = await b.attendre("evenement", e="reseau")
        verifier(reseau.lances == ["wifi"] and ev["wifi"] == "biscalab 3" and ev["adresse"] == "192.168.1.19"
                 and "192.168.1.19" in ev["texte"], "bon code : bascule lancée, tous les téléphones prévenus")
        e = await b.etat_frais()
        verifier(e["pause"] and e["raison"] == "changement de réseau", "canard en pause pendant le changement de réseau")
        reseau.mode = "wifi"
        await a.envoyer(t="reseau", vers="canard", code=CODE)
        verifier((await a.attendre("erreur"))["code"] == "reseau" and reseau.lances == ["wifi"],
                 "deux changements de suite : le second est refusé")
        for t in (a, b):
            await t.ws.close()
    await runner.cleanup()


def main() -> None:
    for flux in (sys.stdout, sys.stderr):
        if hasattr(flux, "reconfigure"):
            flux.reconfigure(errors="replace")
    asyncio.run(principal())
    echecs = [t for ok, t in resultats if not ok]
    print(f"\n{len(resultats) - len(echecs)}/{len(resultats)} tests réussis")
    sys.exit(1 if echecs else 0)


if __name__ == "__main__":
    main()
