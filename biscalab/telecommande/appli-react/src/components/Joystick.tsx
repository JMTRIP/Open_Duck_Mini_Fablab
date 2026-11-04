import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { Lock } from 'lucide-react';
import { useEffect, useRef, useState, type PointerEvent as EvPointeur } from 'react';
import { useSoleil } from '../lib/affichage';
import { alpha, NEON } from '../lib/couleurs';
import { vibrer } from '../lib/retours';

const ZONE_MORTE = 0.08; // fraction du débattement sans effet
const RESSORT = { type: 'spring' as const, stiffness: 700, damping: 30 };

const TEINTES = {
  cyan: { neon: NEON.cyan, fond: ['#0d2232', '#07111d', '#04080f'] },
  rose: { neon: NEON.rose, fond: ['#2a0c1d', '#12070f', '#06040a'] },
} as const;

interface Props {
  taille: number; // diamètre du socle, en px de la scène
  capuchon: number; // diamètre du manche
  anneau: number; // rayon de l'anneau lumineux
  course: number; // débattement maximal du manche
  teinte: keyof typeof TEINTES;
  vertical: boolean; // false : gauche/droite seulement (rotation)
  actif: boolean; // false : ne répond pas (on n'a pas la main), mais reste bien visible
  libelle: string;
  onChange: (x: number, y: number) => void; // −1 à 1, y vers le haut
}

/**
 * Joystick tactile : un doigt par joystick, les deux en même temps ; retour au centre en ressort.
 * En mode plein soleil : socle teinté, anneau épais, manche clair, sans lueurs (invisibles au soleil).
 */
export default function Joystick({ taille, capuchon, anneau, course, teinte, vertical, actif, libelle, onChange }: Props) {
  const t = TEINTES[teinte];
  const soleil = useSoleil();
  const R = taille / 2;
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [tenu, setTenu] = useState(false);
  const pid = useRef<number | null>(null);
  const zone = useRef<HTMLDivElement>(null);
  const rappel = useRef(onChange);
  rappel.current = onChange;

  // L'anneau s'illumine avec le débattement ; la flèche poussée s'allume.
  const plancher = soleil ? 1 : 0.75;
  const eclat = useTransform(() => plancher + (1 - plancher) * Math.min(1, Math.hypot(x.get(), y.get()) / course));
  const haut = useTransform(() => 0.6 + 0.4 * Math.max(0, -y.get() / course));
  const bas = useTransform(() => 0.6 + 0.4 * Math.max(0, y.get() / course));
  const gauche = useTransform(() => 0.6 + 0.4 * Math.max(0, -x.get() / course));
  const droite = useTransform(() => 0.6 + 0.4 * Math.max(0, x.get() / course));

  const lacher = () => {
    if (pid.current === null) return;
    pid.current = null;
    setTenu(false);
    animate(x, 0, RESSORT);
    animate(y, 0, RESSORT);
    rappel.current(0, 0);
  };

  useEffect(() => {
    if (!actif) lacher();
  }, [actif]); // eslint-disable-line react-hooks/exhaustive-deps

  const suivre = (ev: EvPointeur<HTMLDivElement>) => {
    const el = zone.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const k = r.width / taille; // la scène est agrandie ou réduite
    let dx = (ev.clientX - (r.left + r.width / 2)) / (course * k);
    let dy = vertical ? (ev.clientY - (r.top + r.height / 2)) / (course * k) : 0;
    const n = Math.hypot(dx, dy);
    if (n > 1) {
      dx /= n;
      dy /= n;
    }
    x.set(dx * course);
    y.set(dy * course);
    const m = Math.min(1, n);
    const f = m < ZONE_MORTE ? 0 : (m - ZONE_MORTE) / (1 - ZONE_MORTE) / m;
    rappel.current(dx * f, -dy * f);
  };

  const appui = (ev: EvPointeur<HTMLDivElement>) => {
    if (pid.current !== null || !actif) return;
    pid.current = ev.pointerId;
    try {
      ev.currentTarget.setPointerCapture(ev.pointerId);
    } catch {
      /* rien */
    }
    x.stop();
    y.stop();
    setTenu(true);
    vibrer(8);
    suivre(ev);
    ev.preventDefault();
  };
  const bouge = (ev: EvPointeur<HTMLDivElement>) => {
    if (ev.pointerId === pid.current) suivre(ev);
  };
  const fin = (ev: EvPointeur<HTMLDivElement>) => {
    if (ev.pointerId === pid.current) lacher();
  };

  const coupures = vertical ? 4 : 2;
  const trait = (2 * Math.PI * anneau) / coupures - 30;
  const rg = anneau + 10; // couronne de graduations
  const pasG = (2 * Math.PI * rg) / 48;
  const p = Math.round(taille * 0.058); // pointe des flèches, depuis le bord
  const epaisseur = soleil ? 7 : 4.5;

  return (
    <div
      ref={zone}
      aria-label={libelle}
      className="relative touch-none select-none rounded-full"
      style={{
        width: taille,
        height: taille,
        // Sans la main, le joystick reste lisible : seulement moins coloré, avec un cadenas.
        opacity: actif ? 1 : soleil ? 0.9 : 0.7,
        filter: actif ? 'none' : 'saturate(0.35)',
        transition: 'opacity .35s, filter .35s',
      }}
      onPointerDown={appui}
      onPointerMove={bouge}
      onPointerUp={fin}
      onPointerCancel={fin}
      onLostPointerCapture={fin}
    >
      {/* socle */}
      <div
        className="absolute inset-0 rounded-full"
        style={
          soleil
            ? { background: '#000', boxShadow: `inset 0 0 0 3px ${t.neon}` }
            : {
                background: 'conic-gradient(from 20deg, #141922, #3c4556, #171c26, #2d3443, #141922, #384152, #141922)',
                boxShadow: '0 18px 30px rgba(0,0,0,.75), inset 0 1px 2px rgba(255,255,255,.2)',
              }
        }
      >
        <div
          className="absolute rounded-full"
          style={{
            inset: Math.round(taille * 0.0375),
            background: soleil
              ? `radial-gradient(circle, ${alpha(t.neon, 0.34)} 0%, ${alpha(t.neon, 0.2)} 60%, ${alpha(t.neon, 0.1)} 100%)`
              : `radial-gradient(circle at 50% 45%, ${t.fond[0]} 0%, ${t.fond[1]} 62%, ${t.fond[2]} 100%)`,
            boxShadow: soleil ? 'none' : `inset 0 6px 16px rgba(0,0,0,.85), inset 0 0 30px ${alpha(t.neon, 0.12)}`,
          }}
        />
      </div>

      {/* anneau lumineux, graduations, flèches */}
      <motion.svg
        aria-hidden
        className="pointer-events-none absolute inset-0"
        width={taille}
        height={taille}
        viewBox={`0 0 ${taille} ${taille}`}
        style={{ opacity: eclat, filter: soleil ? 'none' : `drop-shadow(0 0 6px ${alpha(t.neon, 0.8)})` }}
      >
        <circle cx={R} cy={R} r={rg} fill="none" stroke={soleil ? t.neon : alpha(t.neon, 0.65)} strokeWidth={6} strokeDasharray={`${soleil ? 2.4 : 1.4} ${pasG - (soleil ? 2.4 : 1.4)}`} />
        <circle cx={R} cy={R} r={anneau} fill="none" stroke={t.neon} strokeWidth={epaisseur} strokeDasharray={`${trait} 30`} strokeDashoffset={-15} />
        {vertical ? (
          <circle cx={R} cy={R} r={anneau - 20} fill="none" stroke={alpha(t.neon, soleil ? 0.8 : 0.5)} strokeWidth={soleil ? 2.5 : 1.5} strokeDasharray="3 5" />
        ) : (
          <path d={`M${R - course} ${R}h${2 * course}`} stroke={alpha(t.neon, soleil ? 0.6 : 0.4)} strokeWidth={12} strokeLinecap="round" />
        )}
        {vertical && (
          <motion.polygon points={`${R},${p} ${R - 10},${p + 16} ${R + 10},${p + 16}`} fill={t.neon} style={{ opacity: soleil ? 1 : haut }} />
        )}
        {vertical && (
          <motion.polygon
            points={`${R},${taille - p} ${R - 10},${taille - p - 16} ${R + 10},${taille - p - 16}`}
            fill={t.neon}
            style={{ opacity: soleil ? 1 : bas }}
          />
        )}
        <motion.polygon points={`${p},${R} ${p + 16},${R - 10} ${p + 16},${R + 10}`} fill={t.neon} style={{ opacity: soleil ? 1 : gauche }} />
        <motion.polygon
          points={`${taille - p},${R} ${taille - p - 16},${R - 10} ${taille - p - 16},${R + 10}`}
          fill={t.neon}
          style={{ opacity: soleil ? 1 : droite }}
        />
        {!vertical && (
          <g transform={`scale(${taille / 196})`} fill="none" stroke={t.neon} strokeWidth={soleil ? 3.4 : 2.6} strokeLinecap="round" strokeLinejoin="round">
            <path d="M46 46a62 62 0 0 1 26-18" />
            <path d="M42 36l4 10 10-2" />
            <path d="M150 46a62 62 0 0 0-26-18" />
            <path d="M154 36l-4 10-10-2" />
          </g>
        )}
      </motion.svg>

      {/* lueur sous le manche (inutile au soleil) */}
      {!soleil && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute rounded-full"
          style={{
            width: capuchon * 1.25,
            height: capuchon * 1.25,
            left: R - capuchon * 0.625,
            top: R - capuchon * 0.625,
            x,
            y,
            background: `radial-gradient(circle, ${alpha(t.neon, 0.55)}, ${alpha(t.neon, 0)} 70%)`,
          }}
        />
      )}
      {/* manche : métal sombre d'habitude, métal clair au soleil */}
      <motion.div
        aria-hidden
        className="capuchon pointer-events-none absolute"
        style={{
          width: capuchon,
          height: capuchon,
          left: R - capuchon / 2,
          top: R - capuchon / 2,
          x,
          y,
          background: soleil ? 'radial-gradient(circle at 36% 30%, #ffffff 0%, #c9d3df 45%, #7a8492 100%)' : undefined,
          boxShadow: soleil
            ? `0 0 0 4px ${t.neon}, 0 0 0 6px #000`
            : `0 12px 20px rgba(0,0,0,.75), inset 0 2px 3px rgba(255,255,255,.28), inset 0 -8px 12px rgba(0,0,0,.6), 0 0 0 3px #10141b, 0 0 0 4px ${alpha(t.neon, 0.6)}, 0 0 26px ${alpha(t.neon, 0.55)}`,
        }}
        animate={{ scale: tenu ? 0.95 : 1 }}
        transition={{ duration: 0.12 }}
      >
        <div
          className="absolute rounded-full"
          style={{
            inset: Math.round(capuchon * 0.24),
            background: soleil ? '#1a1f27' : 'radial-gradient(circle at 50% 60%, #12161d, #262c37)',
            boxShadow: 'inset 0 3px 6px rgba(0,0,0,.7), 0 1px 0 rgba(255,255,255,.12)',
          }}
        />
      </motion.div>

      {/* sans la main : cadenas et consigne, bien lisibles */}
      {!actif && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[22%] flex justify-center">
          <span className="coupe flex items-center gap-1.5 px-2.5 py-1 text-[14px] font-bold tracking-[0.08em] text-white" style={{ background: 'rgba(0,0,0,.85)', boxShadow: 'inset 0 0 0 2px #ffffff' }}>
            <Lock size={15} strokeWidth={2.6} />
            PRENDS LA MAIN
          </span>
        </div>
      )}
    </div>
  );
}
