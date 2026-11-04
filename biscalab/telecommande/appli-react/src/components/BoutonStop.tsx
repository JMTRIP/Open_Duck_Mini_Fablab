import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';

/** Gros STOP rose : réagit dès l'appui (pas au relâcher), pour tout le monde, pilote ou pas. */
export default function BoutonStop({ onStop }: { onStop: () => void }) {
  const [eclair, setEclair] = useState(0);
  return (
    <div className="pulse-stop h-full w-full">
      <motion.button
        type="button"
        aria-label="Stop : arrêt immédiat du canard"
        className="coupe-l relative grid h-full w-full place-items-center overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, #ff5a8e, #d4004a 70%, #a3003a)',
          boxShadow: 'inset 0 2px 0 rgba(255,255,255,.35)',
        }}
        whileTap={{ scale: 0.95 }}
        onPointerDown={(ev) => {
          ev.preventDefault();
          onStop();
          setEclair((n) => n + 1);
        }}
        onClick={(ev) => {
          if (ev.detail === 0) onStop(); // clavier (Entrée sur le bouton)
        }}
        onContextMenu={(ev) => ev.preventDefault()}
      >
        <span
          className="relative z-10 font-titre text-[48px] font-bold leading-none tracking-[0.36em] text-white"
          style={{ textIndent: '0.36em', textShadow: '2px 0 0 #00f0ff, -2px 0 0 #7a00ff, 0 2px 6px rgba(0,0,0,.45)' }}
        >
          STOP
        </span>
        <AnimatePresence>
          {eclair > 0 && (
            <motion.span
              key={eclair}
              aria-hidden
              className="absolute inset-0 bg-white"
              initial={{ opacity: 0.75 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.45 }}
            />
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
