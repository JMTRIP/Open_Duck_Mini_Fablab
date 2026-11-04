// Messages échangés avec le canard : voir ../../protocole.md

export interface Pilote {
  num: number;
  nom: string;
  connecte: boolean;
}

export interface Client {
  num: number;
  nom: string;
}

export interface Pose {
  x: number; // m, vers l'avant du départ
  y: number; // m, vers la gauche du départ
  cap: number; // rad, > 0 vers la gauche
}

export interface Canard {
  simule?: boolean;
  modele?: string;
  batterie_v?: number;
  batterie_pct?: number;
  puissance_w?: number;
  temperatures?: Record<string, number>;
  temp_max?: number;
  contacts?: { gauche: boolean; droit: boolean };
  pose?: Pose;
  en_mouvement?: boolean;
  tombe?: boolean;
  chutes?: number;
}

/** Wi-Fi du Pi : son propre réseau (point d'accès) ou un Wi-Fi existant. Absent sur un PC. */
export interface Reseau {
  mode: 'canard' | 'wifi' | 'aucun';
  nom: string; // nom du réseau (SSID)
  adresse: string; // adresse du Pi sur ce réseau
  wifi_connu: string | null; // dernier Wi-Fi existant vu (club, maison)
}

export interface Etat {
  t: 'etat';
  seq: number;
  temps: number;
  pause: boolean;
  pret?: boolean; // en pause, mais un coup de joystick du pilote suffit pour partir (protocole 0.2)
  raison: string;
  pilote: Pilote | null;
  clients: Client[];
  vitesse: { vx: number; vy: number; wz: number };
  sprint: boolean;
  accessoires: Record<string, boolean>;
  canard: Canard;
  reseau?: Reseau | null;
}

export type Message =
  | { t: 'bienvenue'; num: number; version: string; limites: Record<string, number> }
  | Etat
  | { t: 'evenement'; e: string; texte?: string; vers?: 'canard' | 'wifi'; wifi?: string | null; adresse?: string | null }
  | { t: 'erreur'; code: string; texte?: string }
  | { t: 'pong'; ts: number };
