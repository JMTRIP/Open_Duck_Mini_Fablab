import { AnimatePresence, motion } from 'framer-motion';
import { LogOut, Users } from 'lucide-react';
import { useEffect } from 'react';
import { useSoleil } from '../lib/affichage';
import { alpha, NEON } from '../lib/couleurs';
import Touche from './Touche';

interface Props {
  ouvert: boolean;
  gauche: number; // position sur la scène, sous l'onglet du pilote
  largeur: number;
  autres: number; // autres téléphones connectés
  onRendre: () => void;
  onPasser: () => void;
  onFermer: () => void;
}

/**
 * Petit menu sous l'onglet quand on pilote : rendre la main, ou la passer à un autre téléphone.
 * Deux appuis pour rendre la main : un toucher par mégarde sur l'onglet ne fait rien perdre.
 * Se referme tout seul, ou dès qu'on touche ailleurs (sans bloquer les joysticks).
 */
export default function MenuPilote({ ouvert, gauche, largeur, autres, onRendre, onPasser, onFermer }: Props) {
  const soleil = useSoleil();

  useEffect(() => {
    if (!ouvert) return;
    const ailleurs = (ev: PointerEvent) => {
      if (ev.target instanceof Element && ev.target.closest('[data-menu-pilote]')) return;
      onFermer();
    };
    const minuterie = window.setTimeout(onFermer, 8000);
    document.addEventListener('pointerdown', ailleurs, true);
    return () => {
      document.removeEventListener('pointerdown', ailleurs, true);
      window.clearTimeout(minuterie);
    };
  }, [ouvert, onFermer]);

  const bouton = 'coupe flex h-14 w-full items-center justify-center gap-2.5 text-[22px] font-bold tracking-[0.1em]';
  return (
    <AnimatePresence>
      {ouvert && (
        <motion.div
          data-menu-pilote
          role="menu"
          aria-label="Menu du pilote"
          className="coupe-l absolute z-[85] flex flex-col gap-2 p-3" // au-dessus des annonces (z-80)
          style={{
            left: gauche,
            top: 60,
            width: largeur,
            background: soleil ? '#000' : 'rgba(5,12,26,.97)',
            boxShadow: `inset 0 0 0 ${soleil ? 3 : 2}px ${NEON.jaune}, 0 12px 30px rgba(0,0,0,.6)`,
          }}
          initial={{ opacity: 0, y: -8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
        >
          <Touche
            label="Rendre la main"
            action={onRendre}
            className={bouton}
            style={{ background: alpha(NEON.jaune, soleil ? 0.35 : 0.2), color: NEON.jaune, boxShadow: `inset 0 0 0 2px ${alpha(NEON.jaune, 0.8)}` }}
          >
            <LogOut size={24} strokeWidth={2.6} />
            RENDRE LA MAIN
          </Touche>
          {autres > 0 && (
            <Touche
              label="Passer la main à un autre téléphone"
              action={onPasser}
              className={bouton}
              style={{ background: alpha(NEON.cyan, soleil ? 0.3 : 0.16), color: NEON.cyanClair, boxShadow: `inset 0 0 0 2px ${alpha(NEON.cyan, 0.7)}` }}
            >
              <Users size={24} strokeWidth={2.6} />
              PASSER LA MAIN…
            </Touche>
          )}
          <p className="px-1 text-center text-[15px] font-semibold leading-snug" style={{ color: NEON.grisBleu }}>
            Le canard s'arrête et attend le prochain pilote.
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
