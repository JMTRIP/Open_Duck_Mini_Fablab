// Retours pour le pilote : petits sons synthétisés (aucun fichier) et vibrations.
import { estIOS } from './appareil';
import { ID_HAPTIQUE } from './appui';
import { ecrire, lire } from './stockage';

export const reglages = {
  sons: lire<boolean>('sons', true),
  vibrations: lire<boolean>('vibrations', true),
};

export function regler(cle: 'sons' | 'vibrations', valeur: boolean): void {
  reglages[cle] = valeur;
  ecrire(cle, valeur);
}

let ctxAudio: AudioContext | null = null;
let gesteFait = false;

/** Les navigateurs n'autorisent le son qu'après un geste : à appeler au premier appui. */
export function autoriserSon(): void {
  gesteFait = true;
  audio();
}

function audio(): AudioContext | null {
  if (!gesteFait) return null;
  if (!ctxAudio) {
    const Ctx =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    ctxAudio = new Ctx();
  }
  if (ctxAudio.state === 'suspended') ctxAudio.resume().catch(() => {});
  return ctxAudio;
}

interface OptionsNote {
  type?: OscillatorType;
  vol?: number;
  glisse?: number | null;
}

function note(freq: number, debut: number, duree: number, { type = 'sine', vol = 0.18, glisse = null }: OptionsNote = {}) {
  const ctx = audio();
  if (!ctx) return;
  const t0 = ctx.currentTime + debut;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (glisse) osc.frequency.exponentialRampToValueAtTime(glisse, t0 + duree);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duree);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duree + 0.03);
}

const SONS = {
  clic: () => note(1400, 0, 0.03, { type: 'triangle', vol: 0.07 }),
  connexion: () => {
    note(660, 0, 0.09);
    note(990, 0.1, 0.12);
  },
  jeton: () => {
    note(523, 0, 0.08);
    note(659, 0.09, 0.08);
    note(784, 0.18, 0.14);
  },
  marche: () => note(440, 0, 0.18, { glisse: 880 }),
  pause: () => note(660, 0, 0.18, { glisse: 330 }),
  stop: () => {
    note(220, 0, 0.35, { type: 'square', vol: 0.12 });
    note(165, 0.05, 0.35, { type: 'square', vol: 0.1 });
  },
  alarme: () => {
    for (let i = 0; i < 3; i++) {
      note(880, i * 0.22, 0.1, { type: 'square', vol: 0.1 });
      note(660, i * 0.22 + 0.11, 0.1, { type: 'square', vol: 0.1 });
    }
  },
  coin: () => {
    note(520, 0, 0.12, { type: 'sawtooth', vol: 0.12, glisse: 380 });
    note(520, 0.16, 0.14, { type: 'sawtooth', vol: 0.12, glisse: 360 });
  },
  turbo: () => note(300, 0, 0.22, { type: 'sawtooth', vol: 0.05, glisse: 900 }),
  erreur: () => note(200, 0, 0.15, { type: 'square', vol: 0.08 }),
} satisfies Record<string, () => void>;

export type NomSon = keyof typeof SONS;

const VIBRATIONS: Record<NomSon, number | number[]> = {
  clic: 8,
  connexion: 15,
  jeton: [30, 40, 30],
  marche: 25,
  pause: 60,
  stop: 300,
  alarme: [200, 100, 200, 100, 200],
  coin: 20,
  turbo: 12,
  erreur: [80, 50, 80],
};

// iPhone : pas de navigator.vibrate. Depuis iOS 18, basculer un interrupteur
// <input type="checkbox" switch> donne un petit retour haptique : on s'en sert, caché.
let interrupteurIOS: HTMLLabelElement | null = null;

function tapIOS(): void {
  if (!interrupteurIOS) {
    const boite = document.createElement('div');
    boite.id = ID_HAPTIQUE; // ses click passent la garde anti-click fantôme (lib/appui)
    boite.setAttribute('aria-hidden', 'true');
    boite.style.cssText = 'position:fixed;left:-200px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
    const entree = document.createElement('input');
    entree.type = 'checkbox';
    entree.setAttribute('switch', '');
    entree.id = 'haptique-ios';
    entree.tabIndex = -1;
    const etiquette = document.createElement('label');
    etiquette.htmlFor = entree.id;
    boite.append(entree, etiquette);
    document.body.append(boite);
    interrupteurIOS = etiquette;
  }
  interrupteurIOS.click();
}

export function vibrer(motif: number | number[]): void {
  if (!reglages.vibrations) return;
  try {
    if (typeof navigator.vibrate === 'function') navigator.vibrate(motif);
    else if (estIOS) tapIOS();
  } catch {
    /* rien */
  }
}

export function jouer(nom: NomSon): void {
  if (!reglages.sons) return;
  try {
    SONS[nom]();
  } catch {
    /* rien */
  }
}

export function retour(nom: NomSon): void {
  jouer(nom);
  vibrer(VIBRATIONS[nom]);
}
