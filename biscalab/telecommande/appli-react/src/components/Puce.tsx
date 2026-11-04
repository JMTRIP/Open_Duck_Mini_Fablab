import type { ReactNode } from 'react';
import { useSoleil } from '../lib/affichage';
import { alpha, NEON } from '../lib/couleurs';

export type Ton = 'cyan' | 'rose' | 'jaune' | 'vert';

const TONS: Record<Ton, { bord: string; texte: string }> = {
  cyan: { bord: NEON.cyan, texte: '#d2feff' },
  rose: { bord: NEON.rose, texte: '#ffc2d5' },
  jaune: { bord: NEON.jaune, texte: '#fffbb8' },
  vert: { bord: NEON.vert, texte: '#c6ffe0' },
};

interface Props {
  ton?: Ton;
  icone?: ReactNode;
  clignote?: boolean;
  children: ReactNode;
}

/** Étiquette d'état à coin coupé, bord gauche lumineux ; textes gras pour rester lisibles dehors. */
export default function Puce({ ton = 'cyan', icone, clignote = false, children }: Props) {
  const t = TONS[ton];
  const soleil = useSoleil();
  return (
    <span
      className={`coupe flex h-9 items-center gap-2 whitespace-nowrap px-3 text-[16px] font-bold tracking-[0.05em] ${clignote ? 'clignote' : ''}`}
      style={{ background: alpha(t.bord, soleil ? 0.34 : 0.18), borderLeft: `4px solid ${t.bord}`, color: t.texte }}
    >
      {icone && (
        <span className="flex" style={{ color: t.bord }}>
          {icone}
        </span>
      )}
      {children}
    </span>
  );
}
