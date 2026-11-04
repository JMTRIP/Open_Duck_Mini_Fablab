#!/usr/bin/env python3
"""Serveur de commande du canard BiscaLab (prototype de l'étape 2).

Il remplace la manette Xbox du runtime d'origine :
- il sert l'appli de pilotage (../appli-react/dist si elle est construite, sinon ../appli) ;
- il reçoit les consignes du téléphone par WebSocket sur /ws ;
- il gère le jeton de pilote, le STOP et le chien de garde ;
- il renvoie l'état du canard 10 fois par seconde.

Pour l'instant, le canard est simulé par FauxCanard. Protocole : ../protocole.md

Lancement : python canard_serveur.py [--port 8080] [--code-admin 1234]
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import math
import mimetypes
import os
import re
import secrets
import shutil
import socket
import sys
import time
from dataclasses import dataclass
from pathlib import Path

from aiohttp import WSMsgType, web

from faux_canard import FauxCanard

VERSION = "0.2"
LOG = logging.getLogger("canard")
DOSSIER_APPLI = (Path(__file__).resolve().parent.parent / "appli").resolve()  # appli classique
DOSSIER_REACT = (Path(__file__).resolve().parent.parent / "appli-react" / "dist").resolve()  # npm run build
RACINE = Path(__file__).resolve().parents[3]  # dépôt Open_Duck_Mini_Fablab

LIMITES = {"vx": 0.15, "vy": 0.2, "wz": 1.0}  # m/s, m/s, rad/s : plages d'entraînement
PERIODE_BOUCLE = 0.02     # s, 50 Hz comme la boucle de marche
PERIODE_ETAT = 0.1        # s, état envoyé 10 fois par seconde
CONSIGNE_PERIMEE = 0.3    # s sans consigne : vitesse nulle
PAUSE_APRES = 1.0         # s sans nouvelles du pilote : pause
LIBERE_APRES = 3.0        # s sans nouvelles du pilote : jeton libéré
REPOS_APRES = 2.0         # s joysticks lâchés en marche : le canard se pose (pause « repos »)
REARMEMENT_STOP = 1.0     # s : après un STOP, délai minimal avant de pouvoir repartir
SEUIL_GESTE = 0.05        # consigne réduite au-delà de laquelle un joystick est « poussé »
ACCESSOIRES = ("projecteur", "antennes")
BOUTONS = ACCESSOIRES + ("son",)
RE_ID = re.compile(r"[A-Za-z0-9_-]{8,64}")
CANARD_RESEAU = Path("/usr/local/sbin/canard-reseau")  # installé par ../pi/installer.sh
PROFIL_CANARD = "canard-wifi"  # profil NetworkManager du réseau du canard
DELAI_BASCULE = 3              # s : le temps de prévenir les téléphones avant de couper le Wi-Fi
PERIODE_RESEAU = 5.0           # s entre deux lectures du réseau

# Windows associe parfois .js à text/plain : on fixe les types nous-mêmes.
mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("text/css", ".css")
mimetypes.add_type("application/manifest+json", ".webmanifest")
mimetypes.add_type("image/svg+xml", ".svg")
mimetypes.add_type("font/woff2", ".woff2")
mimetypes.add_type("font/woff", ".woff")


def borne(valeur: object) -> float:
    """Consigne réduite entre -1 et 1 ; 0 si illisible."""
    try:
        v = float(valeur)
    except (TypeError, ValueError):
        return 0.0
    if math.isnan(v):
        return 0.0
    return max(-1.0, min(1.0, v))


def nettoyer_nom(nom: object) -> str:
    texte = re.sub(r"[\x00-\x1f\x7f]", "", str(nom or "")).strip()
    return texte[:20] or "Anonyme"


class Reseau:
    """Wi-Fi du Pi, lu avec NetworkManager : son propre réseau (point d'accès) ou un Wi-Fi existant
    (club, maison). La bascule passe par canard-reseau (../pi/canard-reseau.sh), lancé à part pour
    survivre à la coupure. Sur un PC rien de tout ça : dispo est faux, l'appli cache la section Réseau."""

    def __init__(self, dispo: bool | None = None) -> None:
        if dispo is None:
            dispo = sys.platform.startswith("linux") and CANARD_RESEAU.is_file() and shutil.which("nmcli") is not None
        self.dispo = dispo
        self.mode = "aucun"    # canard (point d'accès), wifi (Wi-Fi existant) ou aucun
        self.nom = ""          # nom du réseau (SSID)
        self.adresse = ""      # adresse du Pi sur ce réseau
        self.adresse_canard = "10.42.0.1"
        self.fichier = Path.home() / ".local" / "state" / "canard-telecommande" / "dernier-wifi.json"
        self.dernier_wifi: dict | None = self._charger() if dispo else None  # pour dire où aller
        self.bascule_a = -1e9  # instant de la dernière bascule lancée
        self._ssid: dict[str, str] = {}

    def vue(self) -> dict | None:
        if not self.dispo:
            return None
        retour = self.dernier_wifi["nom"] if self.dernier_wifi else None
        return {"mode": self.mode, "nom": self.nom, "adresse": self.adresse, "wifi_connu": retour}

    def _charger(self) -> dict | None:
        try:
            d = json.loads(self.fichier.read_text(encoding="utf-8"))
            return {"nom": str(d["nom"]), "adresse": str(d["adresse"])}
        except (OSError, ValueError, KeyError, TypeError):
            return None

    def _garder(self) -> None:
        try:
            self.fichier.parent.mkdir(parents=True, exist_ok=True)
            self.fichier.write_text(json.dumps(self.dernier_wifi, ensure_ascii=False), encoding="utf-8")
        except OSError as exc:
            LOG.debug("Wi-Fi non mémorisé : %s", exc)

    @staticmethod
    async def _commande(*args: str, timeout: float = 10.0) -> tuple[int, str]:
        p = await asyncio.create_subprocess_exec(*args, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT)
        try:
            sortie, _ = await asyncio.wait_for(p.communicate(), timeout)
        except asyncio.TimeoutError:
            p.kill()
            await p.wait()
            return -1, "délai dépassé"
        return p.returncode or 0, sortie.decode(errors="replace").strip()

    async def ssid_de(self, profil: str) -> str:
        if profil not in self._ssid:
            code, s = await self._commande("nmcli", "-g", "802-11-wireless.ssid", "connection", "show", profil)
            if code != 0 or not s:
                return profil
            self._ssid[profil] = s.splitlines()[0].replace("\\:", ":")
        return self._ssid[profil]

    async def lire(self) -> None:
        code, s = await self._commande("nmcli", "-g", "GENERAL.CONNECTION,IP4.ADDRESS", "device", "show", "wlan0")
        if code != 0:
            return
        lignes = s.splitlines() + ["", ""]
        profil = lignes[0].strip()
        adresse = lignes[1].split("|")[0].strip().split("/")[0]
        if profil == PROFIL_CANARD:
            self.mode, self.nom = "canard", await self.ssid_de(profil)
            self.adresse_canard = adresse or self.adresse_canard
        elif profil:
            self.mode, self.nom = "wifi", await self.ssid_de(profil)
            nouveau = {"nom": self.nom, "adresse": adresse}
            if adresse and nouveau != self.dernier_wifi:
                self.dernier_wifi = nouveau
                self._garder()
        else:
            self.mode, self.nom = "aucun", ""
        self.adresse = adresse

    async def suivre(self) -> None:
        while True:
            try:
                await self.lire()
            except Exception:
                LOG.exception("Lecture du réseau impossible")
            await asyncio.sleep(PERIODE_RESEAU)

    async def cible(self, vers: str) -> tuple[str | None, str | None]:
        """Réseau à rejoindre et adresse de l'appli après la bascule (None si on ne sait pas)."""
        if vers == "canard":
            return await self.ssid_de(PROFIL_CANARD), self.adresse_canard
        if self.dernier_wifi:
            return self.dernier_wifi["nom"], self.dernier_wifi["adresse"]
        return None, None

    async def lancer(self, vers: str) -> bool:
        code, s = await self._commande("sudo", "-n", "systemd-run", "--quiet", "--collect",
                                       f"--on-active={DELAI_BASCULE}", str(CANARD_RESEAU), vers)
        if code != 0:
            LOG.error("Changement de réseau impossible : %s", s)
            return False
        self.bascule_a = time.monotonic()
        return True


@dataclass(eq=False)
class Client:
    ws: web.WebSocketResponse
    id: str      # secret, gardé par le téléphone
    num: int     # public, change à chaque connexion
    nom: str


class Controleur:
    """Jeton de pilote, pause, chien de garde et diffusion de l'état.

    Marche « à l'homme mort » : le canard part dès que le pilote pousse un joystick
    et se pose REPOS_APRES secondes après qu'il les a lâchés. Après un arrêt subi
    (STOP, liaison perdue, chute, changement de pilote…), le canard est verrouillé :
    il ne repart qu'une fois les joysticks lâchés, puis poussés de nouveau.
    """

    def __init__(self, canard: FauxCanard, code_admin: str, reseau: Reseau | None = None) -> None:
        self.canard = canard
        self.code_admin = code_admin
        self.reseau = reseau or Reseau()
        self.clients: dict[str, Client] = {}
        self.prochain_num = 1
        self.pilote: str | None = None   # id secret du pilote
        self.pilote_nom = ""
        self.pilote_vu = 0.0             # dernier message du pilote
        self.consigne = (0.0, 0.0, 0.0)  # réduite, entre -1 et 1
        self.consigne_vue = 0.0
        self.sprint = False
        self.pause = True                # le canard démarre en pause
        self.raison = "démarrage"
        self.verrou = True               # il faut lâcher les joysticks avant de repartir
        self.verrou_fin = 0.0            # pas de déverrouillage avant cet instant
        self.dernier_geste = 0.0         # dernière consigne non nulle du pilote
        self.accessoires = {a: False for a in ACCESSOIRES}
        self.debut = time.monotonic()
        self.seq = 0
        self._taches: set[asyncio.Task] = set()

    # ---------- connexions ----------

    async def arrivee(self, ws: web.WebSocketResponse, id_: str, nom: str) -> Client:
        ancien = self.clients.get(id_)
        cl = Client(ws, id_, self.prochain_num, nom)
        self.prochain_num += 1
        self.clients[id_] = cl  # avant de fermer l'ancienne connexion du même téléphone
        if ancien is not None and ancien.ws is not ws:
            self._lancer(ancien.ws.close(code=4001, message=b"remplace par une nouvelle connexion"))
        if self.pilote == id_:
            self.pilote_nom = nom
            self.pilote_vu = time.monotonic()
            LOG.info("%s reprend sa place de pilote", nom)
        LOG.info("Connexion de %s (n°%d), %d téléphone(s)", nom, cl.num, len(self.clients))
        return cl

    def depart(self, cl: Client) -> None:
        if self.clients.get(cl.id) is not cl:
            return  # déjà remplacé par une connexion plus récente
        del self.clients[cl.id]
        LOG.info("Départ de %s (n°%d)", cl.nom, cl.num)
        if self.pilote == cl.id:
            # pause tout de suite ; le jeton reste réservé LIBERE_APRES secondes
            self.mettre_en_pause("pilote déconnecté")

    # ---------- actions ----------

    def mettre_en_pause(self, raison: str, annoncer: bool = True, verrou: bool = True, delai: float = 0.0) -> None:
        """Pause. Avec verrou, le pilote doit lâcher les joysticks (et attendre delai) avant de repartir."""
        self.consigne = (0.0, 0.0, 0.0)
        self.sprint = False
        etait_en_marche = not self.pause
        self.pause, self.raison = True, raison
        if verrou:
            self.verrou = True
            self.verrou_fin = max(self.verrou_fin, time.monotonic() + delai)
        if etait_en_marche:
            (LOG.debug if raison == "repos" else LOG.info)("Pause : %s", raison)
            if annoncer:
                self.evenement("pause", raison)

    def peut_marcher(self) -> bool:
        return not self.canard.vide and not getattr(self.canard, "tombe", False)

    def pret(self) -> bool:
        """En pause, mais un coup de joystick du pilote suffit pour repartir."""
        return (self.pause and not self.verrou and self.pilote in self.clients and self.peut_marcher())

    def repartir(self) -> None:
        self.pause, self.raison = False, ""
        self.verrou = False
        self.dernier_geste = time.monotonic()

    def changer_pilote(self, cl: Client | None, texte: str) -> None:
        self.pilote = cl.id if cl else None
        self.pilote_nom = cl.nom if cl else ""
        self.pilote_vu = time.monotonic()
        self.mettre_en_pause(f"nouveau pilote : {cl.nom}" if cl else "personne ne pilote", annoncer=False)
        LOG.info("%s", texte)
        self.evenement("jeton", texte)

    def stop(self, cl: Client) -> None:
        self.mettre_en_pause(f"STOP par {cl.nom}", annoncer=False, delai=REARMEMENT_STOP)
        LOG.warning("STOP par %s", cl.nom)
        self.evenement("stop", f"STOP par {cl.nom}")

    async def prendre(self, cl: Client, code: object) -> None:
        if self.pilote == cl.id:
            return
        if self.pilote is None:
            self.changer_pilote(cl, f"{cl.nom} prend les commandes")
        elif code is None:
            await self.erreur(cl, "occupe", f"{self.pilote_nom} pilote déjà.")
        elif secrets.compare_digest(str(code).encode(), self.code_admin.encode()):
            self.changer_pilote(cl, f"{cl.nom} reprend la main (administrateur)")
        else:
            await asyncio.sleep(1.0)  # freine les essais au hasard
            await self.erreur(cl, "code", "Code administrateur faux.")

    async def basculer_reseau(self, cl: Client, vers: object, code: object) -> None:
        """Passer du réseau du canard au Wi-Fi existant, ou l'inverse : réservé à l'administrateur."""
        r = self.reseau
        if not r.dispo:
            await self.erreur(cl, "reseau", "Ce serveur ne change pas de réseau : il ne tourne pas sur le Pi.")
            return
        if vers not in ("canard", "wifi"):
            await self.erreur(cl, "inconnu", f"Réseau inconnu : {vers!r}")
            return
        if code is None or not secrets.compare_digest(str(code).encode(), self.code_admin.encode()):
            await asyncio.sleep(1.0)  # freine les essais au hasard
            await self.erreur(cl, "code", "Code administrateur faux.")
            return
        if r.mode == vers:
            await self.erreur(cl, "reseau", "Le canard est déjà sur ce réseau.")
            return
        if time.monotonic() - r.bascule_a < 30:
            await self.erreur(cl, "reseau", "Changement de réseau déjà en cours.")
            return
        wifi, adresse = await r.cible(vers)
        if not await r.lancer(vers):
            await self.erreur(cl, "reseau", "Le changement de réseau n'a pas pu être lancé.")
            return
        lieu = f"le Wi-Fi « {wifi} »" if wifi else "le Wi-Fi du club ou de la maison"
        quoi = "son propre réseau" if vers == "canard" else lieu
        texte = (f"{cl.nom} fait passer le canard sur {quoi}. Rejoins {lieu}, "
                 f"puis ouvre http://{adresse or 'canard.local'}.")
        LOG.warning("Changement de réseau vers %s demandé par %s", vers, cl.nom)
        self.mettre_en_pause("changement de réseau", annoncer=False)
        await self.diffuser(json.dumps({"t": "evenement", "e": "reseau", "texte": texte, "vers": vers,
                                        "wifi": wifi, "adresse": adresse}, ensure_ascii=False))

    async def bouton(self, cl: Client, b: object) -> None:
        if b not in BOUTONS:
            await self.erreur(cl, "inconnu", f"Bouton inconnu : {b!r}")
            return
        if b == "son":
            texte = "Coin coin !"
        else:
            self.accessoires[b] = not self.accessoires[b]
            actif = self.accessoires[b]
            texte = {"projecteur": "Projecteur allumé" if actif else "Projecteur éteint",
                     "antennes": "Antennes en mouvement" if actif else "Antennes au repos"}[b]
        self.evenement("bouton", texte)

    async def recevoir(self, cl: Client, m: dict) -> None:
        maintenant = time.monotonic()
        est_pilote = self.pilote == cl.id
        if est_pilote:
            self.pilote_vu = maintenant  # tout message du pilote est un signe de vie
        t = m.get("t")
        if t == "cmd":
            if est_pilote:  # les consignes des spectateurs sont ignorées
                self.consigne = (borne(m.get("vx")), borne(m.get("vy")), borne(m.get("wz")))
                self.sprint = m.get("sprint") is True
                self.consigne_vue = maintenant
                geste = max(abs(v) for v in self.consigne) > SEUIL_GESTE
                if geste:
                    self.dernier_geste = maintenant
                if self.verrou:
                    if not geste and maintenant >= self.verrou_fin:
                        self.verrou = False  # joysticks lâchés : le canard est prêt
                elif geste and self.pause and self.peut_marcher():
                    self.repartir()  # marche à l'homme mort : pousser suffit
                    LOG.debug("%s repart", cl.nom)
        elif t == "stop":
            self.stop(cl)
        elif t == "ping":
            await self.envoyer(cl, {"t": "pong", "ts": m.get("ts")})
        elif t == "prendre":
            await self.prendre(cl, m.get("code"))
        elif t == "reseau":
            await self.basculer_reseau(cl, m.get("vers"), m.get("code"))
        elif t in ("rendre", "passer", "marche", "pause", "bouton"):
            if not est_pilote:
                await self.erreur(cl, "pas_pilote", "Il faut d'abord prendre les commandes.")
            elif t == "rendre":
                self.changer_pilote(None, f"{cl.nom} rend la main")
            elif t == "passer":
                cible = next((c for c in self.clients.values() if c.num == m.get("a")), None)
                if cible is None or cible is cl:
                    await self.erreur(cl, "destinataire", "Ce téléphone n'est plus connecté.")
                else:
                    self.changer_pilote(cible, f"{cl.nom} passe la main à {cible.nom}")
            elif t == "marche":
                if self.canard.vide:
                    await self.erreur(cl, "batterie", "Batterie vide.")
                elif getattr(self.canard, "tombe", False):
                    await self.erreur(cl, "au_sol", "Le canard est au sol.")
                elif self.pause:  # ancienne appli : bouton Marche
                    self.consigne = (0.0, 0.0, 0.0)
                    self.repartir()
                    LOG.info("Marche lancée par %s", cl.nom)
                    self.evenement("reprise", f"{cl.nom} lance la marche")
            elif t == "pause":
                self.mettre_en_pause(f"pause par {cl.nom}")
            else:
                await self.bouton(cl, m.get("b"))
        elif t != "bonjour":
            await self.erreur(cl, "inconnu", f"Message inconnu : {t!r}")

    # ---------- boucles ----------

    def vitesse(self, maintenant: float) -> tuple[float, float, float]:
        """Consigne appliquée, en m/s et rad/s : nulle en pause ou si elle est périmée."""
        if self.pause or maintenant - self.consigne_vue > CONSIGNE_PERIMEE:
            return (0.0, 0.0, 0.0)
        vx, vy, wz = self.consigne
        return (vx * LIMITES["vx"], vy * LIMITES["vy"], wz * LIMITES["wz"])

    def surveiller(self, maintenant: float) -> None:
        """Chien de garde : pas de marche sans pilote vivant ni batterie, pause si le canard tombe,
        repos quand le pilote a lâché les joysticks."""
        if getattr(self.canard, "tombe", False):
            if not self.pause:
                LOG.warning("Le canard est tombé")
                self.mettre_en_pause("chute", annoncer=False)
                self.evenement("chute", "Le canard est tombé ! Il se relève tout seul.")
            self.verrou = True  # une fois debout, il faudra lâcher puis repousser
        if self.canard.vide:
            if not self.pause:
                self.mettre_en_pause("batterie vide")
            self.verrou = True
        if self.pilote is None:
            if not self.pause:
                self.mettre_en_pause("personne ne pilote")
            return
        silence = maintenant - self.pilote_vu
        if silence > PAUSE_APRES and not (self.pause and self.verrou):
            if not self.pause:
                LOG.warning("Liaison perdue avec %s", self.pilote_nom)
                self.evenement("liaison", f"Plus de nouvelles de {self.pilote_nom}")
            self.mettre_en_pause("liaison perdue", annoncer=False)
        if silence > LIBERE_APRES:
            self.changer_pilote(None, f"Jeton libéré : plus de nouvelles de {self.pilote_nom}")
            return
        if not self.pause and maintenant - self.dernier_geste > REPOS_APRES:
            self.mettre_en_pause("repos", annoncer=False, verrou=False)

    async def boucle(self) -> None:
        precedent = time.monotonic()
        while True:
            await asyncio.sleep(PERIODE_BOUCLE)
            maintenant = time.monotonic()
            dt, precedent = min(maintenant - precedent, 0.1), maintenant
            try:
                self.surveiller(maintenant)
                vx, vy, wz = self.vitesse(maintenant)
                self.canard.avancer(dt, vx, vy, wz, en_marche=not self.pause, sprint=self.sprint)
            except Exception:  # la boucle de sécurité ne doit jamais s'arrêter
                LOG.exception("Erreur dans la boucle de commande")
                self.pause, self.raison, self.verrou = True, "erreur interne", True

    async def diffusion(self) -> None:
        while True:
            await asyncio.sleep(PERIODE_ETAT)
            if self.clients:
                try:
                    await self.diffuser(json.dumps(self.etat(), ensure_ascii=False))
                except Exception:
                    LOG.exception("Erreur pendant l'envoi de l'état")

    def etat(self) -> dict:
        maintenant = time.monotonic()
        self.seq += 1
        vx, vy, wz = self.vitesse(maintenant)
        pilote = None
        if self.pilote is not None:
            cl = self.clients.get(self.pilote)
            pilote = {"num": cl.num if cl else None, "nom": self.pilote_nom, "connecte": cl is not None}
        return {
            "t": "etat",
            "seq": self.seq,
            "temps": round(maintenant - self.debut, 1),
            "pause": self.pause,
            "pret": self.pret(),
            "raison": self.raison,
            "pilote": pilote,
            "clients": [{"num": c.num, "nom": c.nom} for c in sorted(self.clients.values(), key=lambda c: c.num)],
            "vitesse": {"vx": round(vx, 3), "vy": round(vy, 3), "wz": round(wz, 3)},
            "sprint": self.sprint,
            "accessoires": dict(self.accessoires),
            "canard": self.canard.etat(),
            "reseau": self.reseau.vue(),
        }

    # ---------- envois ----------

    def evenement(self, e: str, texte: str) -> None:
        self._lancer(self.diffuser(json.dumps({"t": "evenement", "e": e, "texte": texte}, ensure_ascii=False)))

    async def erreur(self, cl: Client, code: str, texte: str) -> None:
        await self.envoyer(cl, {"t": "erreur", "code": code, "texte": texte})

    async def envoyer(self, cl: Client, msg: dict) -> None:
        await self._envoyer_brut(cl, json.dumps(msg, ensure_ascii=False))

    async def diffuser(self, data: str) -> None:
        clients = list(self.clients.values())
        if clients:
            await asyncio.gather(*(self._envoyer_brut(c, data) for c in clients))

    async def _envoyer_brut(self, cl: Client, data: str) -> None:
        if cl.ws.closed:
            return
        try:  # un téléphone lent ne doit pas bloquer les autres
            await asyncio.wait_for(cl.ws.send_str(data), timeout=0.5)
        except Exception as exc:
            LOG.debug("Envoi impossible à %s : %s", cl.nom, exc)

    def _lancer(self, coro) -> None:
        tache = asyncio.get_running_loop().create_task(coro)
        self._taches.add(tache)
        tache.add_done_callback(self._taches.discard)


# ---------- serveur web ----------

CTL = web.AppKey("ctl", Controleur)
TACHES = web.AppKey("taches", list)
DOSSIER = web.AppKey("dossier", Path)


async def gerer_ws(request: web.Request) -> web.WebSocketResponse:
    ctl = request.app[CTL]
    ws = web.WebSocketResponse(heartbeat=2.0, max_msg_size=4096)
    await ws.prepare(request)
    cl: Client | None = None
    try:
        async for msg in ws:
            if msg.type is not WSMsgType.TEXT:
                continue
            try:
                m = json.loads(msg.data)
            except ValueError:
                m = None
            if not isinstance(m, dict):
                await ws.send_json({"t": "erreur", "code": "json", "texte": "Message illisible."})
                continue
            if cl is None:
                if m.get("t") != "bonjour":
                    await ws.send_json({"t": "erreur", "code": "bonjour_attendu", "texte": "Envoyer bonjour d'abord."})
                    continue
                id_ = str(m.get("id", ""))
                if not RE_ID.fullmatch(id_):
                    await ws.send_json({"t": "erreur", "code": "id_invalide", "texte": "Identifiant invalide."})
                    break
                cl = await ctl.arrivee(ws, id_, nettoyer_nom(m.get("nom")))
                await ws.send_json({"t": "bienvenue", "num": cl.num, "version": VERSION, "limites": LIMITES})
                continue
            await ctl.recevoir(cl, m)
    finally:
        if cl is not None:
            ctl.depart(cl)
    return ws


async def gerer_fichier(request: web.Request) -> web.FileResponse:
    dossier = request.app[DOSSIER]
    nom = request.match_info.get("nom") or "index.html"
    chemin = (dossier / nom).resolve()
    if not chemin.is_relative_to(dossier) or not chemin.is_file():
        raise web.HTTPNotFound()
    # Les fichiers de assets/ (appli React) portent une empreinte dans leur nom : on peut les garder.
    cache = "public, max-age=31536000, immutable" if nom.startswith("assets/") else "no-store"
    return web.FileResponse(chemin, headers={"Cache-Control": cache})


def creer_app(code_admin: str, canard: FauxCanard | None = None, appli: Path | None = None,
              reseau: Reseau | None = None) -> web.Application:
    app = web.Application()
    ctl = Controleur(canard or FauxCanard(), code_admin, reseau)
    app[CTL] = ctl
    app[DOSSIER] = (appli or DOSSIER_APPLI).resolve()
    app.router.add_get("/ws", gerer_ws)
    app.router.add_get("/", gerer_fichier)
    app.router.add_get("/{nom:.+}", gerer_fichier)

    async def demarrer(app: web.Application) -> None:
        app[TACHES] = [asyncio.create_task(ctl.boucle()), asyncio.create_task(ctl.diffusion())]
        if ctl.reseau.dispo:
            app[TACHES].append(asyncio.create_task(ctl.reseau.suivre()))

    async def arreter(app: web.Application) -> None:
        for tache in app[TACHES]:
            tache.cancel()
        for cl in list(ctl.clients.values()):
            await cl.ws.close(code=1001, message=b"arret du serveur")
        fermer = getattr(ctl.canard, "fermer", None)
        if fermer:
            fermer()  # fenêtre 3D du canard virtuel

    app.on_startup.append(demarrer)
    app.on_shutdown.append(arreter)
    return app


def adresse_locale() -> str:
    """Adresse du PC (ou du Pi) sur le réseau local, pour l'afficher."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("10.254.254.254", 1))  # aucun paquet n'est envoyé
            return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"


def main() -> None:
    p = argparse.ArgumentParser(description="Serveur de commande du canard (prototype avec faux canard).")
    p.add_argument("--hote", default="0.0.0.0", help="adresse d'écoute (défaut : toutes)")
    p.add_argument("--port", type=int, default=8080)
    p.add_argument("--code-admin", default=os.environ.get("CANARD_CODE_ADMIN"),
                   help="code pour reprendre la main (sinon tiré au hasard et affiché)")
    p.add_argument("--mujoco", action="store_true", help="canard virtuel MuJoCo au lieu du faux canard")
    p.add_argument("--sans-fenetre", action="store_true", help="avec --mujoco : pas de fenêtre 3D")
    p.add_argument("--playground", type=Path, default=RACINE.parent / "Open_Duck_Playground",
                   help="clone d'Open_Duck_Playground (modèle MuJoCo et coefficients de démarche)")
    p.add_argument("--onnx", type=Path, default=RACINE / "BEST_WALK_ONNX_2.onnx", help="politique de marche")
    p.add_argument("--appli", default="auto",
                   help="appli servie : react, classique, un dossier, ou auto (react si elle est construite)")
    a = p.parse_args()
    if a.appli == "react" or (a.appli == "auto" and (DOSSIER_REACT / "index.html").is_file()):
        appli = DOSSIER_REACT
    elif a.appli in ("auto", "classique"):
        appli = DOSSIER_APPLI
    else:
        appli = Path(a.appli)
    if not (appli / "index.html").is_file():
        p.error(f"pas d'index.html dans {appli} (pour l'appli React : cd appli-react && npm run build)")
    for flux in (sys.stdout, sys.stderr):
        if hasattr(flux, "reconfigure"):
            flux.reconfigure(errors="replace")
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s", datefmt="%H:%M:%S")
    code = a.code_admin or f"{secrets.randbelow(10000):04d}"
    canard = None
    if a.mujoco:
        from canard_mujoco import CanardMujoco  # importé seulement ici : le Pi n'a pas besoin de MuJoCo
        dossier = a.playground / "playground" / "open_duck_mini_v2"
        canard = CanardMujoco(dossier / "xmls" / "scene_flat_terrain_backlash.xml", a.onnx,
                              dossier / "data" / "polynomial_coefficients.pkl", fenetre=not a.sans_fenetre)
    LOG.info("Serveur du canard %s (%s)", VERSION, "canard virtuel MuJoCo" if a.mujoco else "faux canard")
    LOG.info("Sur le téléphone : http://%s:%d", adresse_locale(), a.port)
    LOG.info("Code administrateur : %s", code)
    LOG.info("Appli servie : %s", appli)
    web.run_app(creer_app(code, canard, appli), host=a.hote, port=a.port, print=None, access_log=None)


if __name__ == "__main__":
    main()
