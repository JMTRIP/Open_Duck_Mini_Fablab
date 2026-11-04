import { motion } from 'framer-motion';
import type { CSSProperties, ReactNode } from 'react';
import { useSoleil } from '../lib/affichage';
import { useAppui } from '../lib/appui';
import { alpha, NEON } from '../lib/couleurs';

interface Props {
  couleur: string;
  label: string;
  taille?: number;
  allume?: boolean;
  style?: CSSProperties;
  onClick: () => void;
  children: ReactNode;
}

/** Petit bouton carré à coins coupés (réglages, plein soleil, voix, phrases). */
export default function BoutonCarre({ couleur, label, taille = 48, allume = false, style, onClick, children }: Props) {
  const soleil = useSoleil();
  const appui = useAppui(() => onClick()); // au relâcher du doigt, même pouce sur un joystick
  return (
    <motion.button
      type="button"
      aria-label={label}
      aria-pressed={allume}
      {...appui}
      whileTap={{ scale: 0.9 }}
      className="coupe absolute grid place-items-center"
      style={{
        ...style,
        width: taille,
        height: taille,
        background: allume ? couleur : alpha(couleur, soleil ? 0.34 : 0.16),
        boxShadow: `inset 0 0 0 ${soleil ? 3 : 2}px ${soleil ? couleur : alpha(couleur, 0.8)}`,
        color: allume ? NEON.nuit : couleur,
      }}
    >
      {children}
    </motion.button>
  );
}
