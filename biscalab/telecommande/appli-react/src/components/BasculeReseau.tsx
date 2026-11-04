import { AnimatePresence, motion } from 'framer-motion';
import { Wifi } from 'lucide-react';
import { alpha, NEON } from '../lib/couleurs';
import { liaison, useLiaison } from '../lib/liaison';
import Touche from './Touche';

/** Le canard change de réseau : dire à chacun quel Wi-Fi rejoindre et quelle adresse ouvrir ensuite. */
export default function BasculeReseau() {
  const { bascule } = useLiaison();
  const port = window.location.port ? `:${window.location.port}` : '';
  const adresse = bascule ? `http://${bascule.adresse || 'canard.local'}${port}` : '';
  const wifi = bascule?.wifi ? `« ${bascule.wifi} »` : bascule?.vers === 'canard' ? 'du canard' : 'du club';

  return (
    <AnimatePresence>
      {bascule && (
        <motion.div
          className="absolute -inset-[400px] z-[95] grid place-items-center" // couvre aussi les marges de l'écran
          style={{ background: 'rgba(0,0,0,.75)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            role="alertdialog"
            aria-label="Le canard change de réseau"
            className="coupe-l w-[560px] px-7 py-6"
            style={{ background: 'linear-gradient(180deg, #0a1a2e, #050b16)', boxShadow: `inset 0 0 0 2px ${alpha(NEON.cyan, 0.6)}` }}
            initial={{ scale: 0.92, y: 10 }}
            animate={{ scale: 1, y: 0 }}
          >
            <h2 className="flex items-center gap-3 text-[24px] font-bold tracking-[0.16em]" style={{ color: NEON.cyanClair }}>
              <Wifi size={28} strokeWidth={2.6} />
              LE CANARD CHANGE DE RÉSEAU
            </h2>
            <ol className="mt-4 flex flex-col gap-3 text-[21px] font-bold leading-snug text-white">
              <li>
                1. Dans les réglages Wi-Fi du téléphone, rejoins le Wi-Fi <span style={{ color: NEON.jaune }}>{wifi}</span>
                {bascule.vers === 'canard' && <span style={{ color: NEON.grisBleu }}> (mot de passe sur la fiche du canard)</span>}.
              </li>
              <li>2. Puis ouvre l'appli à sa nouvelle adresse :</li>
            </ol>
            <a
              href={adresse}
              className="coupe mt-3 block px-4 py-3 text-center font-mono text-[24px] font-bold"
              style={{ background: alpha(NEON.cyan, 0.2), color: NEON.cyanClair, boxShadow: `inset 0 0 0 2px ${NEON.cyan}` }}
            >
              {adresse.replace('http://', '')}
            </a>
            <div className="mt-4 flex justify-end">
              <Touche
                action={() => liaison.oublierBascule()}
                className="coupe px-4 py-2.5 text-[16px] font-bold tracking-[0.12em]"
                style={{ color: NEON.grisBleu, background: 'rgba(255,255,255,.06)' }}
              >
                FERMER
              </Touche>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
