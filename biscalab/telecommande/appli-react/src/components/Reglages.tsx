import { AnimatePresence, motion } from 'framer-motion';
import { OctagonX, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useSoleil } from '../lib/affichage';
import { enModeAppli, estIOS } from '../lib/appareil';
import { useAppui } from '../lib/appui';
import { alpha, NEON } from '../lib/couleurs';
import { nombre, signe } from '../lib/format';
import { liaison, useLiaison, VERSION } from '../lib/liaison';
import type { Canard } from '../lib/protocole';
import { reglages, regler, retour } from '../lib/retours';
import { ConseilIPhone } from './Accueil';
import Touche from './Touche';

interface Props {
  ouvert: boolean;
  section: 'tout' | 'telephones';
  onFermer: () => void;
}

// Panneau large, au premier plan (au-dessus du STOP, qui est donc répété dans son en-tête).
// À gauche : prénom, retours, téléphones. À droite : capteurs.
const LARGEUR_REGLAGES = 700;

const NOMS: Record<string, string> = { genoux: 'Genoux', hanches: 'Hanches', chevilles: 'Chevilles', tete: 'Tête' };
const VALEUR = '#ffffff';
const fx = (n?: number, d = 2) => (typeof n === 'number' ? nombre(n, d) : '–'); // virgule décimale
const sg = signe;

function Titre({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-2 mt-5 text-[19px] font-bold tracking-[0.16em]" style={{ color: NEON.grisBleu }}>
      {children}
    </h3>
  );
}

function Interrupteur({ libelle, valeur, onChange }: { libelle: string; valeur: boolean; onChange: (v: boolean) => void }) {
  return (
    <Touche role="switch" coche={valeur} label={libelle} action={() => onChange(!valeur)} className="flex w-full items-center justify-between py-2">
      <span className="text-[25px] font-bold tracking-[0.03em]">{libelle}</span>
      <span
        className="relative h-[34px] w-[64px] shrink-0 rounded-full transition-colors"
        style={{
          background: valeur ? alpha(NEON.cyan, 0.35) : 'rgba(255,255,255,.1)',
          boxShadow: `inset 0 0 0 2px ${valeur ? NEON.cyan : 'rgba(255,255,255,.35)'}`,
        }}
      >
        <motion.span
          className="absolute top-[5px] h-[24px] w-[24px] rounded-full"
          animate={{ left: valeur ? 35 : 5 }}
          transition={{ type: 'spring', stiffness: 600, damping: 32 }}
          style={{ background: valeur ? NEON.cyan : NEON.grisBleu, boxShadow: valeur ? `0 0 10px ${NEON.cyan}` : 'none' }}
        />
      </span>
    </Touche>
  );
}

function Ligne({ libelle, valeur, couleur = VALEUR }: { libelle: string; valeur: string; couleur?: string }) {
  return (
    <>
      <dt className="text-[21px] font-bold leading-[34px]" style={{ color: NEON.grisBleu }}>
        {libelle}
      </dt>
      <dd className="whitespace-nowrap text-right font-mono text-[22px] leading-[34px]" style={{ color: couleur }}>
        {valeur}
      </dd>
    </>
  );
}

const couleurTemp = (t: number) => (t >= 65 ? NEON.rose : t >= 55 ? NEON.jaune : VALEUR);

/** Panneau qui glisse depuis la droite, par-dessus tout : prénom, retours, téléphones, capteurs. */
export default function Reglages({ ouvert, section, onFermer }: Props) {
  const vue = useLiaison();
  const soleil = useSoleil();
  const e = vue.etat;
  const [sons, setSons] = useState(reglages.sons);
  const [vib, setVib] = useState(reglages.vibrations);
  const [prenom, setPrenom] = useState(liaison.nom);
  const zoneTel = useRef<HTMLDivElement>(null);
  const voile = useAppui<HTMLDivElement>(() => onFermer(), { actif: ouvert, direct: true });

  useEffect(() => {
    if (!ouvert) return;
    setPrenom(liaison.nom);
    if (section === 'telephones') {
      // Défiler le panneau seul (scrollIntoView ferait aussi bouger la scène entière).
      const id = window.setTimeout(() => {
        // offsetTop / offsetHeight : en pixels de la scène, sans l'agrandissement (contrairement à getBoundingClientRect).
        const zone = zoneTel.current;
        const panneau = zone?.closest('aside');
        if (!zone || !panneau || zone.offsetParent !== panneau) return;
        const entete = (panneau.firstElementChild as HTMLElement | null)?.offsetHeight ?? 0;
        panneau.scrollTo({ top: Math.max(0, zone.offsetTop - entete - 8), behavior: 'smooth' });
      }, 280);
      return () => window.clearTimeout(id);
    }
  }, [ouvert, section]);

  const c: Canard = e?.canard ?? {};
  const v = e?.vitesse;
  const temps = Object.entries(c.temperatures ?? {});

  const changerPrenom = (ev: FormEvent) => {
    ev.preventDefault();
    const n = prenom.trim().slice(0, 20);
    if (!n || n === liaison.nom) return;
    retour('clic');
    liaison.demarrer(n);
    liaison.annoncer(`Tu t'appelles maintenant ${n}.`);
  };

  return (
    // Fermé, ce calque laisse passer les touchers tout de suite, même pendant que le panneau glisse.
    <div className="absolute inset-0 z-[70]" style={{ pointerEvents: ouvert ? 'auto' : 'none' }}>
      <AnimatePresence>
        {ouvert && (
          <motion.div
            key="voile"
            className="absolute -inset-[400px]" // déborde de la scène : couvre aussi les marges de l'écran
            style={{ background: 'rgba(0,0,0,.6)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            {...voile}
          />
        )}
        {ouvert && (
          <motion.aside
            key="panneau"
            aria-label="Réglages"
            className="defile absolute bottom-0 right-0 top-0 overflow-y-auto"
            style={{
              width: LARGEUR_REGLAGES,
              background: soleil ? '#000' : 'linear-gradient(180deg, rgba(7,18,38,.98), rgba(4,7,15,.99))',
              borderLeft: `${soleil ? 3 : 2}px solid ${alpha(NEON.cyan, soleil ? 1 : 0.55)}`,
              boxShadow: `-10px 0 40px rgba(0,0,0,.6), -1px 0 16px ${alpha(NEON.cyan, 0.25)}`,
            }}
            initial={{ x: LARGEUR_REGLAGES + 20 }}
            animate={{ x: 0 }}
            exit={{ x: LARGEUR_REGLAGES + 20 }}
            transition={{ type: 'spring', stiffness: 420, damping: 40 }}
          >
            {/* en-tête fixe : titre, STOP (le grand est caché par le panneau), fermer */}
            <div
              className="sticky top-0 z-10 flex items-center gap-3 px-6 pb-2 pt-3"
              style={{ background: soleil ? '#000' : 'rgba(7,18,38,.98)', borderBottom: `1px solid ${alpha(NEON.cyan, 0.25)}` }}
            >
              <h2 className="flex-1 text-[28px] font-bold tracking-[0.2em]" style={{ color: NEON.jaune }}>
                RÉGLAGES
              </h2>
              <motion.button
                type="button"
                aria-label="Stop, depuis les réglages"
                className="coupe flex h-14 items-center gap-2 px-5 text-[25px] font-bold tracking-[0.2em] text-white"
                style={{ background: 'linear-gradient(180deg, #ff5a8e, #d4004a)' }}
                whileTap={{ scale: 0.94 }}
                onPointerDown={(ev) => {
                  ev.preventDefault();
                  liaison.stop();
                }}
                onClick={(ev) => {
                  if (ev.detail === 0) liaison.stop(); // clavier
                }}
              >
                <OctagonX size={26} strokeWidth={2.6} />
                STOP
              </motion.button>
              <Touche
                label="Fermer"
                action={onFermer}
                className="coupe grid h-14 w-14 place-items-center"
                style={{ background: alpha(NEON.jaune, soleil ? 0.3 : 0.14), color: NEON.jaune, boxShadow: `inset 0 0 0 2px ${NEON.jaune}` }}
              >
                <X size={30} strokeWidth={2.6} />
              </Touche>
            </div>

            <div className="grid grid-cols-[280px_1fr] gap-x-7 px-6 pb-6">
              {/* ---------- colonne de gauche ---------- */}
              <div className="min-w-0">
                <Titre>TON PRÉNOM</Titre>
                <form onSubmit={changerPrenom} className="flex gap-2">
                  <input
                    value={prenom}
                    onChange={(ev) => setPrenom(ev.target.value)}
                    maxLength={20}
                    autoComplete="given-name"
                    className="coupe min-w-0 flex-1 bg-white/5 px-3 py-2 text-[24px] font-bold tracking-[0.04em] outline-none"
                    style={{ color: '#ffffff', boxShadow: `inset 0 0 0 2px ${alpha(NEON.cyan, 0.5)}` }}
                  />
                  <Touche type="submit" className="coupe px-4 text-[22px] font-bold tracking-[0.12em]" style={{ background: alpha(NEON.cyan, 0.2), color: NEON.cyanClair }}>
                    OK
                  </Touche>
                </form>

                <Titre>RETOURS</Titre>
                <Interrupteur
                  libelle="Sons"
                  valeur={sons}
                  onChange={(x) => {
                    setSons(x);
                    regler('sons', x);
                    if (x) retour('clic');
                  }}
                />
                <Interrupteur
                  libelle="Vibrations"
                  valeur={vib}
                  onChange={(x) => {
                    setVib(x);
                    regler('vibrations', x);
                    if (x) retour('clic');
                  }}
                />

                <div ref={zoneTel}>
                  <Titre>TÉLÉPHONES</Titre>
                  {!e && (
                    <p className="text-[21px] font-semibold" style={{ color: NEON.grisBleu }}>
                      Pas encore de liaison avec le canard.
                    </p>
                  )}
                  <ul className="flex flex-col gap-2">
                    {(e?.clients ?? []).map((cl) => {
                      const estPilote = e?.pilote?.num === cl.num;
                      const estMoi = cl.num === vue.num;
                      return (
                        <li key={cl.num} className="flex flex-col gap-1.5 py-0.5">
                          <span className="flex min-w-0 items-center gap-2 text-[25px] font-bold">
                            <span className="truncate">{cl.nom}</span>
                            {estMoi && (
                              <span className="text-[19px] font-semibold" style={{ color: NEON.grisBleu }}>
                                (toi)
                              </span>
                            )}
                            {estPilote && (
                              <span className="coupe px-2 py-[2px] text-[16px] font-bold tracking-[0.1em]" style={{ background: alpha(NEON.jaune, 0.22), color: NEON.jaune }}>
                                PILOTE
                              </span>
                            )}
                          </span>
                          {vue.moi && (
                            <Touche
                              action={() => (estMoi ? liaison.rendre() : liaison.passer(cl.num))}
                              className="coupe self-start px-3 py-2 text-[19px] font-bold tracking-[0.08em]"
                              style={{ background: alpha(NEON.jaune, 0.18), color: NEON.jaune, boxShadow: `inset 0 0 0 2px ${alpha(NEON.jaune, 0.6)}` }}
                            >
                              {estMoi ? 'RENDRE LA MAIN' : 'LUI PASSER LA MAIN'}
                            </Touche>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {estIOS && !enModeAppli() && (
                  <div className="mt-5">
                    <ConseilIPhone />
                  </div>
                )}
                <p className="mt-5 text-[18px] font-semibold leading-snug" style={{ color: NEON.grisBleu }}>
                  Télécommande {VERSION}. Clavier : Échap ou Espace = STOP, flèches = piloter, Maj = turbo.
                </p>
              </div>

              {/* ---------- colonne de droite : capteurs ---------- */}
              <div className="min-w-0">
                <Titre>CAPTEURS</Titre>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4">
                  <Ligne libelle="Avance" valeur={v ? `${sg(v.vx)} m/s${e?.sprint ? ' turbo' : ''}` : '–'} />
                  <Ligne libelle="De côté" valeur={v ? `${sg(v.vy)} m/s` : '–'} />
                  <Ligne libelle="Rotation" valeur={v ? `${sg(v.wz)} rad/s` : '–'} />
                  <Ligne
                    libelle="Batterie"
                    valeur={typeof c.batterie_pct === 'number' ? `${c.batterie_pct} % · ${fx(c.batterie_v)} V` : '–'}
                    couleur={typeof c.batterie_pct === 'number' && c.batterie_pct < 25 ? NEON.jaune : VALEUR}
                  />
                  <Ligne libelle="Puissance" valeur={typeof c.puissance_w === 'number' ? `${fx(c.puissance_w, 1)} W` : '–'} />
                  <Ligne
                    libelle="Pieds"
                    valeur={c.contacts ? `G ${c.contacts.gauche ? 'posé' : 'levé'} · D ${c.contacts.droit ? 'posé' : 'levé'}` : '–'}
                  />
                  {c.pose && (
                    <>
                      <Ligne libelle="Position" valeur={`x${sg(c.pose.x)} y${sg(c.pose.y)} m`} />
                      <Ligne libelle="Cap" valeur={`${Math.round((c.pose.cap * 180) / Math.PI)}°`} />
                    </>
                  )}
                  {typeof c.chutes === 'number' && (
                    <Ligne libelle="Chutes" valeur={`${c.chutes}${c.tombe ? ' (au sol)' : ''}`} couleur={c.tombe ? NEON.rose : VALEUR} />
                  )}
                  <Ligne libelle="Latence" valeur={vue.latence === null ? '–' : `${Math.round(vue.latence)} ms`} />
                </dl>
                {temps.length > 0 && (
                  <>
                    <Titre>TEMPÉRATURES</Titre>
                    <dl className="grid grid-cols-2 gap-x-4">
                      {temps.map(([k, t]) => (
                        <div key={k} className="flex items-baseline justify-between gap-1.5">
                          <dt className="whitespace-nowrap text-[21px] font-bold leading-[34px]" style={{ color: NEON.grisBleu }}>
                            {NOMS[k] ?? k}
                          </dt>
                          <dd className="whitespace-nowrap font-mono text-[22px] leading-[34px]" style={{ color: couleurTemp(Number(t)) }}>
                            {nombre(Number(t), 1)}°
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </>
                )}
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
