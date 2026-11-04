import { motion } from 'framer-motion';
import { ChevronDown, Gamepad2 } from 'lucide-react';
import { useAppui } from '../lib/appui';
import { alpha, NEON } from '../lib/couleurs';
import type { Vue } from '../lib/liaison';

interface Props {
  vue: Vue;
  menuOuvert: boolean;
  onPrendre: () => void;
  onMenu: () => void; // c'est moi qui pilote : petit menu « rendre / passer la main »
  onReprendre: () => void; // quelqu'un d'autre pilote : code administrateur
}

/** Onglet du haut (le « PLAYER 1 » des jeux) : qui tient la main, et le geste pour la prendre ou la rendre. */
export default function OngletPilote({ vue, menuOuvert, onPrendre, onMenu, onReprendre }: Props) {
  const e = vue.etat;
  const p = e?.pilote ?? null;
  let haut: string;
  let bas: string;
  let couleur: string = NEON.jaune;
  let appel = false;
  let menu = false;
  let action: (() => void) | undefined;
  let aide = '';
  if (!e) {
    haut = 'CANARD';
    bas = 'CONNEXION…';
    couleur = NEON.cyanClair;
  } else if (!p) {
    haut = 'PERSONNE NE PILOTE';
    bas = 'PRENDRE LA MAIN';
    appel = true;
    action = onPrendre;
    aide = 'Prendre les commandes';
  } else if (vue.moi) {
    haut = "C'EST TOI QUI PILOTES";
    bas = p.nom.toUpperCase();
    menu = true;
    action = onMenu;
    aide = 'Rendre ou passer la main';
  } else {
    haut = `PILOTE ${p.num}${p.connecte ? '' : ' · COUPÉ'}`;
    bas = p.nom.toUpperCase();
    couleur = NEON.roseClair;
    action = onReprendre;
    aide = 'Reprendre la main avec le code';
  }
  const appui = useAppui(action, { actif: !!action }); // au relâcher du doigt

  return (
    <motion.button
      type="button"
      disabled={!action}
      {...appui}
      data-menu-pilote
      aria-label={aide || bas}
      aria-haspopup={menu ? 'menu' : undefined}
      aria-expanded={menu ? menuOuvert : undefined}
      className="onglet flex h-[56px] w-[240px] flex-col items-center justify-center"
      style={{ background: `linear-gradient(180deg, ${alpha(NEON.cyan, menuOuvert ? 0.45 : 0.3)}, ${alpha(NEON.cyan, 0.1)})` }}
      whileTap={action ? { scale: 0.97 } : undefined}
    >
      <span className="flex items-center gap-1.5 text-[12px] font-bold tracking-[0.14em]" style={{ color: NEON.cyanClair }}>
        <Gamepad2 size={15} />
        {haut}
      </span>
      <span className="flex max-w-[206px] items-center gap-1">
        <motion.span
          className="truncate whitespace-nowrap text-[22px] font-bold leading-tight tracking-[0.08em]"
          style={{ color: couleur }}
          animate={appel ? { opacity: [1, 0.5, 1] } : { opacity: 1 }}
          transition={appel ? { duration: 1.4, repeat: Infinity } : { duration: 0.2 }}
        >
          {bas}
        </motion.span>
        {/* le pilote voit qu'il y a un menu derrière son nom */}
        {menu && (
          <ChevronDown
            size={22}
            strokeWidth={3}
            className="shrink-0 transition-transform"
            style={{ color: couleur, transform: menuOuvert ? 'rotate(180deg)' : 'none' }}
          />
        )}
      </span>
    </motion.button>
  );
}
