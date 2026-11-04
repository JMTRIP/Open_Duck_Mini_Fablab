import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { alpha, NEON } from '../lib/couleurs';
import { liaison, type Annonce } from '../lib/liaison';

/** Messages courts sous l'onglet du haut (changement de pilote, pause, chute…). */
export default function Annonces() {
  const [liste, setListe] = useState<Annonce[]>([]);

  useEffect(
    () =>
      liaison.ecouterAnnonces((a) => {
        setListe((l) => [...l.slice(-1), a]); // deux au plus
        window.setTimeout(() => setListe((l) => l.filter((x) => x.id !== a.id)), a.alerte ? 4000 : 2500);
      }),
    [],
  );

  return (
    <div className="pointer-events-none absolute left-0 right-0 top-[96px] z-[80] flex flex-col items-center gap-1.5">
      <AnimatePresence initial={false}>
        {liste.map((a) => (
          <motion.div
            key={a.id}
            layout
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6 }}
            className="coupe max-w-[340px] px-4 py-2 text-center text-[16px] font-bold tracking-[0.04em]"
            style={{
              background: a.alerte ? alpha(NEON.rose, 0.92) : 'rgba(4,10,22,.95)',
              color: a.alerte ? '#fff' : NEON.cyanClair,
              borderLeft: `3px solid ${a.alerte ? '#ffffff' : NEON.cyan}`,
              boxShadow: `0 0 20px ${alpha(a.alerte ? NEON.rose : NEON.cyan, 0.35)}`,
            }}
          >
            {a.texte}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
