import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { useSoleil } from '../lib/affichage';
import { useAppui } from '../lib/appui';
import { alpha, NEON } from '../lib/couleurs';

interface Props {
  couleur: string; // « #rrggbb »
  label: string; // nom écrit sous l'icône
  aide?: string; // nom complet pour les lecteurs d'écran
  allume?: boolean; // accessoire en marche, ou bouton tenu
  actif: boolean;
  largeur: number;
  hauteur: number;
  onClic?: () => void; // bouton à bascule
  onAppui?: () => void; // bouton à maintenir (turbo)
  onLacher?: () => void;
  children: ReactNode; // icône
}

/**
 * Pavé d'accessoire : icône et nom en gros, plein de couleur quand l'accessoire est en marche.
 * Au soleil : fond coloré plus dense et bord épais, pour rester visible sur l'écran qui reflète.
 */
export default function BoutonAccessoire({ couleur, label, aide, allume = false, actif, largeur, hauteur, onClic, onAppui, onLacher, children }: Props) {
  const soleil = useSoleil();
  const fin = () => onLacher?.();
  // Bascule (phare, antennes, coin-coin) : au relâcher du doigt, même pouce sur un joystick.
  const appui = useAppui(onClic ? () => onClic() : undefined, { actif });
  const fond = allume ? couleur : alpha(couleur, soleil ? 0.38 : 0.16);
  const bord = allume ? (soleil ? '#ffffff' : couleur) : soleil ? couleur : alpha(couleur, 0.8);
  return (
    <div style={{ filter: allume && !soleil ? `drop-shadow(0 0 10px ${alpha(couleur, 0.85)})` : 'none', transition: 'filter .2s' }}>
      <motion.button
        type="button"
        aria-label={aide ?? label}
        aria-pressed={allume}
        disabled={!actif}
        className="coupe flex flex-col items-center justify-center gap-1"
        style={{
          width: largeur,
          height: hauteur,
          background: fond,
          boxShadow: `inset 0 0 0 ${soleil ? 3 : 2}px ${bord}`,
          color: allume ? NEON.nuit : soleil ? '#ffffff' : couleur,
          // Sans la main : moins coloré, mais toujours lisible.
          opacity: actif ? 1 : soleil ? 0.9 : 0.7,
          filter: actif ? 'none' : 'saturate(0.35)',
          transition: 'background .2s, opacity .3s, filter .3s',
        }}
        whileTap={actif ? { scale: 0.93 } : undefined}
        onPointerDown={(ev) => {
          if (!onAppui) {
            appui.onPointerDown(ev);
            return;
          }
          if (!actif) return;
          try {
            ev.currentTarget.setPointerCapture(ev.pointerId);
          } catch {
            /* rien */
          }
          onAppui();
        }}
        onPointerUp={onAppui ? fin : appui.onPointerUp}
        onPointerCancel={onAppui ? fin : appui.onPointerCancel}
        onLostPointerCapture={onAppui ? fin : undefined}
        onClick={appui.onClick}
        onContextMenu={(ev) => ev.preventDefault()}
      >
        {children}
        <span className="text-[16px] font-bold leading-none tracking-[0.08em]" style={{ color: allume ? NEON.nuit : '#ffffff' }}>
          {label}
        </span>
      </motion.button>
    </div>
  );
}
