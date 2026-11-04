import { motion } from 'framer-motion';
import type { CSSProperties, ReactNode } from 'react';
import { useSoleil } from '../lib/affichage';
import { soumettre, useAppui } from '../lib/appui';
import { alpha } from '../lib/couleurs';

// D'après « Cyber Button » (21st.dev, @jahed) : dalle à texture de points, traits lumineux
// qui débordent du cadre, halo pointillé à l'appui. Texte en gras pour rester lisible dehors.
interface Props {
  lueur: string; // couleur « #rrggbb »
  largeur: number;
  hauteur: number;
  taillePolice?: number;
  debord?: number; // de combien les traits lumineux dépassent du cadre
  disabled?: boolean;
  type?: 'button' | 'submit';
  label?: string;
  onClick?: () => void;
  children: ReactNode;
}

export default function BoutonCyber({
  lueur,
  largeur,
  hauteur,
  taillePolice = 18,
  debord = 16,
  disabled = false,
  type = 'button',
  label,
  onClick,
  children,
}: Props) {
  const soleil = useSoleil();
  // Au relâcher du doigt ; un bouton d'envoi soumet son formulaire (le clavier garde le chemin natif).
  const appui = useAppui(type === 'submit' ? soumettre : onClick ? () => onClick() : undefined, {
    actif: !disabled,
    natif: type === 'submit',
  });
  const ombre = `0 0 12px ${lueur}`;
  const traitV: CSSProperties = { top: -debord, bottom: -debord, width: 2, background: `linear-gradient(180deg, transparent, ${lueur}, transparent)`, boxShadow: ombre };
  const traitH: CSSProperties = { left: -debord, right: -debord, height: 2, background: `linear-gradient(90deg, transparent, ${lueur}, transparent)`, boxShadow: ombre };
  const bord = 'pointer-events-none absolute opacity-80 transition-opacity duration-300 group-active:opacity-100';
  return (
    <span className="group relative inline-flex" style={{ width: largeur, height: hauteur, opacity: disabled ? (soleil ? 0.9 : 0.7) : 1, filter: disabled ? 'saturate(0.35)' : 'none', transition: 'opacity .3s, filter .3s' }}>
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-8 opacity-0 transition-opacity duration-300 group-active:opacity-100"
        style={{
          backgroundImage: `radial-gradient(${alpha(lueur, 0.35)} 1px, transparent 1px)`,
          backgroundSize: '3px 3px',
          maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 55%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 20%, transparent 55%)',
        }}
      />
      <span aria-hidden className={`${bord} left-0`} style={traitV} />
      <span aria-hidden className={`${bord} right-0`} style={traitV} />
      <span aria-hidden className={`${bord} top-0`} style={traitH} />
      <span aria-hidden className={`${bord} bottom-0`} style={traitH} />
      <motion.button
        type={type}
        aria-label={label}
        disabled={disabled}
        {...appui}
        whileTap={disabled ? undefined : { scale: 0.96 }}
        className="relative flex h-full w-full items-center justify-center gap-3 font-titre font-bold uppercase tracking-[0.24em]"
        style={{
          fontSize: taillePolice,
          textIndent: '0.24em',
          color: lueur,
          background: `radial-gradient(${alpha(lueur, 0.2)} 1px, transparent 1px) 0 0 / 4px 4px, ${alpha(lueur, soleil ? 0.32 : 0.14)}`,
          boxShadow: soleil ? `inset 0 0 0 3px ${lueur}` : `inset 0 0 0 2px ${alpha(lueur, 0.7)}, 0 0 26px -6px ${lueur}`,
        }}
      >
        {children}
      </motion.button>
    </span>
  );
}
