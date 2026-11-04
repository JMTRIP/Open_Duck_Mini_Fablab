import { AnimatePresence, motion } from 'framer-motion';
import { useState, type FormEvent } from 'react';
import { useAppui } from '../lib/appui';
import { alpha, NEON } from '../lib/couleurs';
import { liaison } from '../lib/liaison';
import Touche from './Touche';

interface Props {
  ouvert: boolean;
  onFermer: () => void;
  titre?: string;
  texte?: string;
  bouton?: string;
  onCode?: (code: string) => void; // par défaut : reprendre la main
}

/** Demande du code administrateur : reprendre la main à quelqu'un d'autre, changer de réseau… */
export default function DialogueCode({
  ouvert,
  onFermer,
  titre = 'REPRENDRE LA MAIN',
  texte = "Quelqu'un d'autre pilote. Le code administrateur s'affiche au démarrage du canard.",
  bouton = 'REPRENDRE',
  onCode = (c) => liaison.prendre(c),
}: Props) {
  const [code, setCode] = useState('');
  // Toucher le fond (pas le cadre) referme le dialogue.
  const voile = useAppui<HTMLDivElement>(() => onFermer(), { actif: ouvert, direct: true });

  const valider = (ev: FormEvent) => {
    ev.preventDefault();
    const c = code.trim();
    if (!c) return;
    onCode(c);
    setCode('');
    onFermer();
  };

  return (
    <AnimatePresence>
      {ouvert && (
        <motion.div
          className="absolute -inset-[400px] z-50 grid place-items-center" // couvre aussi les marges de l'écran
          style={{ background: 'rgba(0,0,0,.6)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          {...voile}
        >
          <motion.form
            onSubmit={valider}
            onClick={(ev) => ev.stopPropagation()}
            className="coupe-l -mt-16 w-[340px] px-6 py-5"
            style={{ background: 'linear-gradient(180deg, #0a1a2e, #050b16)', boxShadow: `inset 0 0 0 1px ${alpha(NEON.rose, 0.5)}` }}
            initial={{ scale: 0.92, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
          >
            <h2 className="text-[20px] font-bold tracking-[0.2em]" style={{ color: NEON.roseClair }}>
              {titre}
            </h2>
            <p className="mt-1 text-[15px] font-semibold leading-snug" style={{ color: NEON.grisBleu }}>
              {texte}
            </p>
            <input
              autoFocus
              inputMode="numeric"
              autoComplete="off"
              aria-label="Code administrateur"
              value={code}
              onChange={(ev) => setCode(ev.target.value)}
              maxLength={12}
              className="coupe mt-3 w-full bg-white/5 px-3 py-2 text-center font-mono text-[22px] tracking-[0.5em] outline-none"
              style={{ color: '#fff', boxShadow: `inset 0 0 0 1px ${alpha(NEON.rose, 0.45)}` }}
            />
            <div className="mt-4 flex justify-end gap-2">
              <Touche action={onFermer} className="coupe px-4 py-2.5 text-[15px] font-bold tracking-[0.12em]" style={{ color: NEON.grisBleu, background: 'rgba(255,255,255,.06)' }}>
                ANNULER
              </Touche>
              <Touche type="submit" className="coupe px-4 py-2.5 text-[15px] font-bold tracking-[0.12em] text-white" style={{ background: alpha(NEON.rose, 0.85) }}>
                {bouton}
              </Touche>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
