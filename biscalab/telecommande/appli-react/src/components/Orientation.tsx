import { motion } from 'framer-motion';
import { Smartphone } from 'lucide-react';
import { NEON } from '../lib/couleurs';

/** Paysage obligatoire : en portrait, la télécommande est masquée et on demande de tourner le téléphone. */
export default function Orientation() {
  return (
    <div className="fixed inset-0 z-[100] hidden flex-col items-center justify-center gap-5 bg-nuit px-8 text-center portrait:flex">
      <motion.div
        animate={{ rotate: [0, 0, -90, -90, 0] }}
        transition={{ duration: 2.6, repeat: Infinity, times: [0, 0.15, 0.45, 0.85, 1], ease: 'easeInOut' }}
        style={{ color: NEON.cyan, filter: `drop-shadow(0 0 12px ${NEON.cyan})` }}
      >
        <Smartphone size={76} strokeWidth={1.6} />
      </motion.div>
      <p className="text-[24px] font-bold tracking-[0.2em]" style={{ color: NEON.cyanClair }}>
        TOURNE TON TÉLÉPHONE
      </p>
      <p className="font-mono text-[12px]" style={{ color: NEON.grisBleu }}>
        La télécommande se tient en paysage, un pouce sur chaque joystick.
      </p>
    </div>
  );
}
