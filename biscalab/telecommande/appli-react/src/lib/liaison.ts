// Liaison WebSocket avec le canard (protocole : ../../protocole.md).
// Un seul exemplaire pour toute l'appli ; React s'y abonne avec useLiaison().
import { useSyncExternalStore } from 'react';
import type { Etat, Message } from './protocole';
import { jouer, retour, vibrer } from './retours';
import { ecrire, lire, nouvelId } from './stockage';

export const VERSION = '0.2';
const PERIODE_CMD = 50; // ms : 20 consignes par seconde, c'est aussi le signe de vie du pilote
const SILENCE_MAX = 1000; // ms sans état du canard : liaison perdue
const SEUIL_GESTE = 0.05; // consigne au-delà de laquelle le canard considère un joystick poussé

export interface Vue {
  connecte: boolean; // WebSocket ouvert
  enLigne: boolean; // au moins un état reçu sur cette connexion
  perdu: boolean; // on avait des nouvelles du canard et on n'en a plus
  remplace: boolean; // l'appli a été ouverte ailleurs sur ce téléphone
  num: number | null; // numéro public donné par le canard
  etat: Etat | null; // dernier message « etat »
  latence: number | null; // aller-retour en ms
  moi: boolean; // c'est ce téléphone qui pilote
}

export interface Annonce {
  id: number;
  texte: string;
  alerte: boolean;
}

export type Accessoire = 'projecteur' | 'antennes' | 'son';

class Liaison {
  /** Consigne réduite (−1 à 1), lue toutes les 50 ms. vx > 0 avance, vy > 0 à gauche, wz > 0 tourne à gauche. */
  axes = { vx: 0, vy: 0, wz: 0 };
  sprint = false;
  nom = '';

  private ws: WebSocket | null = null;
  private essais = 0;
  private recuA = 0;
  private idTel: string;
  private lance = false;
  private etaisPilote = false;
  private enPause = true;
  private alarmeDonnee = false;
  private batterieSignalee = false;
  private numAnnonce = 0;
  private vue: Vue = {
    connecte: false,
    enLigne: false,
    perdu: false,
    remplace: false,
    num: null,
    etat: null,
    latence: null,
    moi: false,
  };
  private abonnes = new Set<() => void>();
  private auditeurs = new Set<(a: Annonce) => void>();

  constructor() {
    const id = lire<unknown>('id', null);
    this.idTel = typeof id === 'string' && /^[0-9a-f]{32}$/.test(id) ? id : this.nouvelleIdentite();
  }

  private nouvelleIdentite(): string {
    const id = nouvelId();
    ecrire('id', id);
    return id;
  }

  // ---------- pour React ----------
  abonner = (f: () => void) => {
    this.abonnes.add(f);
    return () => {
      this.abonnes.delete(f);
    };
  };

  instantane = () => this.vue;

  ecouterAnnonces(f: (a: Annonce) => void): () => void {
    this.auditeurs.add(f);
    return () => {
      this.auditeurs.delete(f);
    };
  }

  private maj(p: Partial<Vue>): void {
    const cles = Object.keys(p) as (keyof Vue)[];
    if (cles.every((c) => this.vue[c] === p[c])) return;
    this.vue = { ...this.vue, ...p };
    for (const f of this.abonnes) f();
  }

  annoncer(texte: string, alerte = false): void {
    const a = { id: ++this.numAnnonce, texte, alerte };
    for (const f of this.auditeurs) f(a);
  }

  // ---------- connexion ----------
  /** Démarre la liaison ; sans effet si elle tourne déjà sous ce prénom. */
  demarrer(nom: string): void {
    const change = nom !== this.nom;
    this.nom = nom;
    ecrire('nom', nom);
    if (!this.lance) {
      this.lance = true;
      window.setInterval(() => this.envoyerConsigne(), PERIODE_CMD);
      window.setInterval(() => {
        if (!document.hidden) this.envoyer({ t: 'ping', ts: performance.now() });
      }, 1000);
      window.setInterval(() => this.surveiller(), 250);
      // Appli en arrière-plan : plus de consignes, le canard se met en pause tout seul.
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) this.lacher();
        else if (!this.ws && !this.vue.remplace) this.connecter();
      });
    }
    if (!this.ws) this.connecter();
    else if (change) this.ws.close(); // nouveau prénom : on se reconnecte, le jeton est gardé 3 s
  }

  /** Après « appli ouverte ailleurs » : reprendre la place. */
  reprendre(): void {
    if (!this.vue.remplace) return;
    this.maj({ remplace: false });
    this.connecter();
  }

  private connecter(): void {
    if (this.ws) return;
    const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      this.planifier();
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      this.essais = 0;
      this.maj({ connecte: true });
      this.envoyer({ t: 'bonjour', id: this.idTel, nom: this.nom, version: VERSION });
    };
    ws.onmessage = (ev) => {
      let m: unknown;
      try {
        m = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      if (m && typeof m === 'object') this.recevoir(m as Message);
    };
    ws.onclose = (ev) => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.lacher();
      this.maj({ connecte: false, enLigne: false, num: null, moi: false });
      if (ev.code === 4001) {
        this.maj({ remplace: true });
        return;
      }
      this.planifier();
    };
  }

  private planifier(): void {
    const delai = Math.min(3000, 500 * 2 ** this.essais++);
    window.setTimeout(() => {
      if (!this.ws && !this.vue.remplace && !document.hidden) this.connecter();
    }, delai);
  }

  private envoyer(msg: Record<string, unknown>): boolean {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(msg));
    return true;
  }

  // ---------- réception ----------
  private recevoir(m: Message): void {
    switch (m.t) {
      case 'bienvenue':
        this.maj({ num: m.num });
        jouer('connexion');
        break;
      case 'etat':
        this.surEtat(m);
        break;
      case 'evenement':
        this.surEvenement(m.e, m.texte ?? '');
        break;
      case 'erreur':
        if (m.code === 'id_invalide') this.idTel = this.nouvelleIdentite();
        retour('erreur');
        this.annoncer(m.texte || 'Erreur', true);
        break;
      case 'pong':
        if (typeof m.ts === 'number') this.maj({ latence: performance.now() - m.ts });
        break;
      default:
        break;
    }
  }

  private surEtat(e: Etat): void {
    this.recuA = performance.now();
    const moi = !!(e.pilote && this.vue.num !== null && e.pilote.num === this.vue.num);
    if (!moi && this.vue.moi) this.lacher();
    // Le canard part au premier coup de joystick : petit tic pour le sentir sans regarder l'écran.
    if (moi && this.enPause && !e.pause) vibrer(15);
    this.enPause = e.pause;
    this.etaisPilote = moi;
    const pct = e.canard?.batterie_pct;
    if (typeof pct === 'number') {
      if (pct < 15 && moi && !this.batterieSignalee) {
        this.batterieSignalee = true;
        retour('alarme');
        this.annoncer('Batterie faible : il faut ramener le canard.', true);
      }
      if (pct >= 20) this.batterieSignalee = false;
    }
    this.maj({ etat: e, enLigne: true, moi });
  }

  private surEvenement(e: string, texte: string): void {
    switch (e) {
      case 'jeton':
        retour('jeton');
        this.annoncer(texte);
        break;
      case 'stop':
        retour('stop');
        this.annoncer(texte, true);
        break;
      case 'pause':
        retour('pause');
        this.annoncer(`Pause : ${texte}`);
        break;
      case 'reprise':
        retour('marche');
        this.annoncer(texte);
        break;
      case 'liaison':
      case 'chute':
        retour('alarme');
        this.annoncer(texte, true);
        break;
      case 'bouton':
        if (texte.startsWith('Coin')) {
          jouer('coin');
          vibrer(20);
        } else retour('clic');
        this.annoncer(texte);
        break;
      default:
        if (texte) this.annoncer(texte);
    }
  }

  /** Surveillance côté téléphone, 4 fois par seconde. */
  private surveiller(): void {
    const ouvert = this.ws?.readyState === WebSocket.OPEN;
    const perdu = this.vue.etat !== null && (!ouvert || performance.now() - this.recuA > SILENCE_MAX);
    if (perdu && this.etaisPilote && !this.alarmeDonnee) {
      this.alarmeDonnee = true;
      retour('alarme');
    }
    if (!perdu) this.alarmeDonnee = false;
    this.maj({ perdu });
  }

  private envoyerConsigne(): void {
    if (!this.vue.moi || document.hidden) return;
    const r = (x: number) => Math.round(x * 1000) / 1000;
    this.envoyer({ t: 'cmd', vx: r(this.axes.vx), vy: r(this.axes.vy), wz: r(this.axes.wz), sprint: this.sprint });
  }

  // ---------- actions ----------
  /** Tout lâcher : consigne à zéro, turbo coupé. */
  lacher(): void {
    this.axes = { vx: 0, vy: 0, wz: 0 };
    this.sprint = false;
  }

  /** STOP : accepté de tous les téléphones, même sans le jeton. */
  stop(): void {
    retour('stop');
    if (!this.envoyer({ t: 'stop' })) this.annoncer('Pas de liaison : le canard se met en pause tout seul.', true);
  }

  prendre(code?: string): void {
    retour('clic');
    this.envoyer(code ? { t: 'prendre', code } : { t: 'prendre' });
  }

  rendre(): void {
    retour('clic');
    this.envoyer({ t: 'rendre' });
  }

  passer(num: number): void {
    retour('clic');
    this.envoyer({ t: 'passer', a: num });
  }

  /** Un joystick (ou une flèche du clavier) est-il poussé ? Même seuil que le canard. */
  joysticksPousses(): boolean {
    const { vx, vy, wz } = this.axes;
    return Math.max(Math.abs(vx), Math.abs(vy), Math.abs(wz)) > SEUIL_GESTE;
  }

  bouton(b: Accessoire): void {
    this.envoyer({ t: 'bouton', b });
  }
}

export const liaison = new Liaison();

export function useLiaison(): Vue {
  return useSyncExternalStore(liaison.abonner, liaison.instantane);
}
