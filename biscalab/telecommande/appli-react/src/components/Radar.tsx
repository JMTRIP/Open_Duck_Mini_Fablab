import { motion } from 'framer-motion';
import { useRef } from 'react';
import { alpha, NEON } from '../lib/couleurs';
import type { Pose } from '../lib/protocole';
import { signe } from '../lib/format';

// Radar rectangulaire à coins arrondis, centré sur le canard, son avant toujours vers le haut.
// Balayage et grille qui apparaît trait par trait : d'après « Radar Effect » (21st.dev, Aceternity).
export const LARGEUR_RADAR = 376;
export const HAUTEUR_RADAR = 154;
const L = LARGEUR_RADAR;
const H = HAUTEUR_RADAR;
const CX = L / 2;
const CY = H / 2;
const ECH = 80; // px par mètre
const PAS = ECH / 2; // grille tous les 50 cm
const RAYON = 18;
const LIM = { vx: 0.15, vy: 0.2, wz: 1 }; // limites d'entraînement de la politique de marche

const lecture = (n?: number) => (typeof n === 'number' ? signe(n, 2) : '\u2007–'); // +0,15 : virgule décimale

interface Props {
  pose?: Pose; // seulement en simulation
  vitesse?: { vx: number; vy: number; wz: number };
}

export default function Radar({ pose, vitesse }: Props) {
  const trace = useRef<Pose[]>([]);

  if (pose) {
    const t = trace.current;
    const der = t[t.length - 1];
    const saut = der ? Math.hypot(pose.x - der.x, pose.y - der.y) : 0;
    if (saut > 0.5) t.length = 0; // canard remis debout ailleurs : on efface
    if (!der || saut > 0.01 || t.length === 0) {
      t.push(pose);
      if (t.length > 600) t.shift();
    }
  }

  // Trajet dans le repère du canard : avant = haut de l'écran, gauche = gauche.
  let points = '';
  if (pose && trace.current.length > 1) {
    const cs = Math.cos(pose.cap);
    const sn = Math.sin(pose.cap);
    points = trace.current
      .map((q) => {
        const dx = q.x - pose.x;
        const dy = q.y - pose.y;
        const avant = dx * cs + dy * sn;
        const cote = -dx * sn + dy * cs;
        return `${(CX - cote * ECH).toFixed(1)},${(CY - avant * ECH).toFixed(1)}`;
      })
      .join(' ');
  }

  // Consigne appliquée : flèche cyan (déplacement) et arc rose (rotation).
  const nvx = vitesse ? vitesse.vx / LIM.vx : 0;
  const nvy = vitesse ? vitesse.vy / LIM.vy : 0;
  const nwz = vitesse ? Math.max(-1, Math.min(1, vitesse.wz / LIM.wz)) : 0;
  const fleche = Math.hypot(nvx, nvy) > 0.05;
  const fx = CX - nvy * 62;
  const fy = CY - nvx * 58;
  const a = -Math.PI / 2 - (nwz * 140 * Math.PI) / 180;
  const R = 32;
  const ax = CX + R * Math.cos(a);
  const ay = CY + R * Math.sin(a);

  const verticales: number[] = [];
  for (let x = CX % PAS; x < L; x += PAS) verticales.push(x);
  const horizontales: number[] = [];
  for (let y = CY % PAS; y < H; y += PAS) horizontales.push(y);

  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: L,
        height: H,
        borderRadius: RAYON,
        background: 'radial-gradient(ellipse at 50% 50%, #0b2b40 0%, #061a2a 60%, #03101b 100%)',
      }}
    >
      <motion.div
        aria-hidden
        className="balayage absolute left-0 top-0 h-full w-16"
        style={{ background: 'linear-gradient(90deg, rgba(0,240,255,0), rgba(0,240,255,.22))' }}
        animate={{ x: [-64, L] }}
        transition={{ duration: 3.5, ease: 'linear', repeat: Infinity }}
      />
      <svg aria-hidden className="absolute inset-0" width={L} height={H} viewBox={`0 0 ${L} ${H}`}>
        <defs>
          <clipPath id="radar-zone">
            <rect width={L} height={H} rx={RAYON} />
          </clipPath>
        </defs>
        <g stroke={alpha(NEON.cyan, 0.22)} strokeWidth={1}>
          {verticales.map((x, i) => (
            <motion.line key={`v${x}`} x1={x} y1={0} x2={x} y2={H} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} />
          ))}
          {horizontales.map((y, i) => (
            <motion.line key={`h${y}`} x1={0} y1={y} x2={L} y2={y} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }} />
          ))}
        </g>
        <path d={`M${CX} 0V${H}M0 ${CY}H${L}`} stroke={alpha(NEON.cyan, 0.5)} strokeWidth={1.5} />

        <g clipPath="url(#radar-zone)">
          {points && (
            <polyline points={points} fill="none" stroke={NEON.rose} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
          )}
          {fleche && (
            <g stroke={NEON.cyan} fill={NEON.cyan}>
              <line x1={CX} y1={CY} x2={fx} y2={fy} strokeWidth={4} strokeLinecap="round" />
              <circle cx={fx} cy={fy} r={5} />
            </g>
          )}
          {Math.abs(nwz) > 0.03 && (
            <g stroke={NEON.roseClair} fill={NEON.roseClair}>
              <path d={`M${CX} ${CY - R}A${R} ${R} 0 0 ${nwz > 0 ? 0 : 1} ${ax.toFixed(1)} ${ay.toFixed(1)}`} fill="none" strokeWidth={4} strokeLinecap="round" />
              <circle cx={ax} cy={ay} r={4} />
            </g>
          )}
        </g>

        {/* le canard */}
        <polygon
          points={`${CX},${CY - 20} ${CX - 13},${CY + 13} ${CX},${CY + 6} ${CX + 13},${CY + 13}`}
          fill={NEON.jaune}
          stroke="#000"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        <g fontFamily="Rajdhani, sans-serif" fontWeight={700} fontSize={14} fill={NEON.cyanClair}>
          <text x={CX + 8} y={18}>
            AVANT
          </text>
          <path d={`M14 14v8M14 18h${PAS}M${14 + PAS} 14v8`} stroke={NEON.cyanClair} strokeWidth={2} fill="none" />
          <text x={20 + PAS} y={23}>
            50 cm
          </text>
        </g>
      </svg>

      {/* consigne appliquée, en clair */}
      <div className="absolute bottom-2 left-2.5 right-2.5 flex justify-between font-mono text-[15px] text-white">
        <span className="rounded-md px-1.5 py-0.5" style={{ background: 'rgba(0,0,0,.55)' }}>
          VX <span style={{ color: NEON.cyan }}>{lecture(vitesse?.vx)}</span>
        </span>
        <span className="rounded-md px-1.5 py-0.5" style={{ background: 'rgba(0,0,0,.55)' }}>
          VY <span style={{ color: NEON.cyan }}>{lecture(vitesse?.vy)}</span>
        </span>
        <span className="rounded-md px-1.5 py-0.5" style={{ background: 'rgba(0,0,0,.55)' }}>
          ROT <span style={{ color: NEON.roseClair }}>{lecture(vitesse?.wz)}</span>
        </span>
      </div>

      {/* cadre net par-dessus */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ borderRadius: RAYON, boxShadow: `inset 0 0 0 2px ${NEON.cyan}, inset 0 0 26px ${alpha(NEON.cyan, 0.18)}` }}
      />
    </div>
  );
}
