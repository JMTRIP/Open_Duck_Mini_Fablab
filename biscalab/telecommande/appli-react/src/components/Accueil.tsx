import { motion } from 'framer-motion';
import { Play } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { enModeAppli, estIOS } from '../lib/appareil';
import { alpha, NEON } from '../lib/couleurs';
import { autoriserSon } from '../lib/retours';
import BoutonCyber from './BoutonCyber';
import Decor from './Decor';

/** Safari sur iPhone ne permet pas le plein écran : il faut ajouter la télécommande à l'écran d'accueil. */
export function ConseilIPhone() {
  return (
    <p className="coupe w-full px-3 py-2 text-center text-[14px] font-semibold leading-snug" style={{ background: alpha(NEON.jaune, 0.1), color: '#fbf7a0' }}>
      Sur iPhone, pour le plein écran : touche « Partager », puis « Sur l'écran d'accueil ». La télécommande s'ouvrira comme une
      vraie appli, sans les barres de Safari.
    </p>
  );
}

/** Plein écran puis paysage verrouillé (Android). Sur iPhone, ce n'est pas permis : l'appli demande de tourner. */
async function pleinEcranPaysage(): Promise<void> {
  try {
    const d = document.documentElement;
    if (!document.fullscreenElement && typeof d.requestFullscreen === 'function') {
      await d.requestFullscreen({ navigationUI: 'hide' });
    }
    const o = screen.orientation as unknown as { lock?: (sens: string) => Promise<void> } | undefined;
    await o?.lock?.('landscape');
  } catch {
    /* rien : refusé ou pas disponible */
  }
}

export default function Accueil({ nom, onValider }: { nom: string; onValider: (nom: string) => void }) {
  const [prenom, setPrenom] = useState(nom);

  const valider = (ev: FormEvent) => {
    ev.preventDefault();
    const n = prenom.trim().slice(0, 20);
    if (!n) return;
    autoriserSon();
    void pleinEcranPaysage();
    onValider(n);
  };

  return (
    <>
      <Decor />
      <div className="defile fixed inset-0 grid place-items-center overflow-y-auto p-4">
        <motion.form
          onSubmit={valider}
          className="coupe-l flex w-full max-w-[380px] flex-col items-center gap-5 px-7 py-7"
          style={{
            background: 'rgba(5,12,24,.85)',
            boxShadow: `inset 0 0 0 1px ${alpha(NEON.cyan, 0.35)}, 0 0 40px ${alpha(NEON.cyan, 0.12)}`,
          }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="text-center">
            <p className="font-mono text-[11px] tracking-[0.3em]" style={{ color: NEON.cyanClair }}>
              BISCALAB · OPEN DUCK MINI
            </p>
            <h1
              className="mt-1 text-[32px] font-bold leading-none tracking-[0.12em] text-white"
              style={{ textShadow: `2px 0 0 ${alpha(NEON.cyan, 0.8)}, -2px 0 0 ${alpha(NEON.rose, 0.8)}` }}
            >
              TÉLÉCOMMANDE
            </h1>
            <p className="mt-1 text-[18px] font-semibold tracking-[0.42em]" style={{ color: NEON.jaune }}>
              DU CANARD
            </p>
          </div>
          <label className="flex w-full flex-col gap-1.5">
            <span className="font-mono text-[11px] tracking-[0.2em]" style={{ color: NEON.grisBleu }}>
              TON PRÉNOM
            </span>
            <input
              value={prenom}
              onChange={(ev) => setPrenom(ev.target.value)}
              maxLength={20}
              autoComplete="given-name"
              enterKeyHint="go"
              className="coupe w-full bg-white/5 px-4 py-3 text-[20px] font-semibold tracking-[0.08em] text-white outline-none"
              style={{ boxShadow: `inset 0 0 0 1px ${alpha(NEON.cyan, 0.4)}` }}
            />
          </label>
          <BoutonCyber lueur={NEON.vert} largeur={240} hauteur={46} type="submit" disabled={!prenom.trim()}>
            <Play size={15} fill="currentColor" />
            C'EST PARTI
          </BoutonCyber>
          <p className="text-center text-[14px] font-semibold leading-snug" style={{ color: NEON.grisBleu }}>
            Le téléphone passe en plein écran. Tiens-le en paysage, un pouce sur chaque joystick.
          </p>
          {estIOS && !enModeAppli() && <ConseilIPhone />}
        </motion.form>
      </div>
    </>
  );
}
