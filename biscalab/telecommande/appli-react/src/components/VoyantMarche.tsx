import { motion } from 'framer-motion';
import { BatteryWarning, Footprints, Gamepad2, Hand, Hourglass, LoaderCircle, Move, OctagonX, TriangleAlert, Unplug } from 'lucide-react';
import type { ReactNode } from 'react';
import { useSoleil } from '../lib/affichage';
import { alpha, NEON } from '../lib/couleurs';
import { liaison, type Vue } from '../lib/liaison';

// Voyant de marche : remplace l'ancien bouton « Activer / Pause ».
// Le canard part quand le pilote pousse un joystick et se pose quand il les lâche ;
// le voyant dit seulement où on en est et, pour le pilote, quoi faire.
interface Voyant {
  titre: string;
  aide: string;
  couleur: string;
  plein: boolean; // fond plein de couleur (en marche, ou geste attendu du pilote)
  clignote: boolean;
  icone: ReactNode;
}

const I = 24;

function lireVoyant(vue: Vue): Voyant {
  const e = vue.etat;
  if (!e) return { titre: 'CONNEXION…', aide: 'recherche du canard', couleur: NEON.cyan, plein: false, clignote: true, icone: <LoaderCircle size={I} /> };
  const moi = vue.moi;
  const nom = e.pilote?.nom ?? '';
  const r = e.raison ?? '';
  if (e.canard?.tombe)
    return { titre: 'AU SOL', aide: 'il se relève tout seul', couleur: NEON.rose, plein: false, clignote: true, icone: <TriangleAlert size={I} /> };
  if (!e.pause)
    return { titre: 'EN MARCHE', aide: moi ? 'lâche tout pour t’arrêter' : `${nom} pilote`, couleur: NEON.vert, plein: true, clignote: false, icone: <Footprints size={I} /> };
  if (r === 'batterie vide')
    return { titre: 'BATTERIE VIDE', aide: 'recharge le canard', couleur: NEON.rose, plein: false, clignote: true, icone: <BatteryWarning size={I} /> };
  if (!e.pilote)
    return { titre: 'LIBRE', aide: 'prends la main en haut', couleur: NEON.cyan, plein: false, clignote: false, icone: <Gamepad2 size={I} /> };
  if (!e.pilote.connecte)
    return { titre: 'EN ATTENTE', aide: `${nom} s’est déconnecté`, couleur: NEON.jaune, plein: false, clignote: true, icone: <Unplug size={I} /> };

  const pret = { titre: 'PRÊT', aide: moi ? 'pousse un joystick' : `${nom} a la main`, couleur: NEON.cyan, plein: false, clignote: false, icone: <Move size={I} /> };
  if (e.pret) return pret;

  // Pause verrouillée : le pilote doit lâcher les joysticks avant de repartir.
  const stop = r.startsWith('STOP');
  const anodin = r === 'démarrage' || r.startsWith('nouveau pilote');
  if (moi) {
    if (liaison.joysticksPousses())
      return { titre: stop ? 'STOP' : 'EN PAUSE', aide: 'lâche les joysticks', couleur: NEON.jaune, plein: true, clignote: false, icone: <Hand size={I} /> };
    if (stop) return { titre: 'STOP', aide: 'un instant…', couleur: NEON.rose, plein: false, clignote: false, icone: <OctagonX size={I} /> };
    return pret; // le verrou se lève à la prochaine consigne nulle, dans 50 ms
  }
  if (anodin) return pret;
  if (stop) return { titre: 'STOP', aide: r.replace(/^STOP /, ''), couleur: NEON.rose, plein: false, clignote: false, icone: <OctagonX size={I} /> };
  if (r === 'liaison perdue')
    return { titre: 'LIAISON PERDUE', aide: `plus de nouvelles de ${nom}`, couleur: NEON.rose, plein: false, clignote: true, icone: <Unplug size={I} /> };
  return { titre: 'EN PAUSE', aide: r === 'chute' ? 'après une chute' : r, couleur: NEON.jaune, plein: false, clignote: false, icone: <Hourglass size={I} /> };
}

export default function VoyantMarche({ vue, largeur, hauteur }: { vue: Vue; largeur: number; hauteur: number }) {
  const soleil = useSoleil();
  const v = lireVoyant(vue);
  const texte = v.plein ? NEON.nuit : '#ffffff';
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Voyant de marche : ${v.titre}, ${v.aide}`}
      style={{ filter: v.plein && !soleil ? `drop-shadow(0 0 12px ${alpha(v.couleur, 0.8)})` : 'none', transition: 'filter .2s' }}
    >
      <motion.div
        key={v.titre}
        initial={{ opacity: 0.4, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.15 }}
        className="coupe flex items-center gap-3 px-4"
        style={{
          width: largeur,
          height: hauteur,
          background: v.plein ? v.couleur : alpha(v.couleur, soleil ? 0.34 : 0.14),
          boxShadow: `inset 0 0 0 ${soleil ? 3 : 2}px ${v.plein ? (soleil ? '#ffffff' : v.couleur) : soleil ? v.couleur : alpha(v.couleur, 0.8)}`,
          color: v.plein ? NEON.nuit : v.couleur,
          transition: 'background .2s',
        }}
      >
        <span className={`shrink-0 ${v.clignote ? 'clignote' : ''}`} style={{ color: v.plein ? NEON.nuit : soleil ? '#ffffff' : v.couleur }}>
          {v.icone}
        </span>
        <span className="flex min-w-0 flex-col leading-none">
          <span className={`truncate text-[21px] font-bold tracking-[0.1em] ${v.clignote ? 'clignote' : ''}`} style={{ color: v.plein ? NEON.nuit : soleil ? '#ffffff' : v.couleur }}>
            {v.titre}
          </span>
          <span className="mt-1 truncate text-[15px] font-bold" style={{ color: texte }}>
            {v.aide}
          </span>
        </span>
      </motion.div>
    </div>
  );
}
