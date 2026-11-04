// Fond plein écran : lueurs, grille de points, courbes de niveau, lignes de balayage.
export default function Decor() {
  return (
    <div aria-hidden className="decor pointer-events-none fixed inset-0">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 932 430" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="dc-fond" cx="0.5" cy="0.42" r="0.75">
            <stop offset="0" stopColor="#0b2236" />
            <stop offset="0.55" stopColor="#071226" />
            <stop offset="1" stopColor="#03050c" />
          </radialGradient>
          <radialGradient id="dc-rose" cx="0.5" cy="1" r="0.55">
            <stop offset="0" stopColor="#ff2a6d" stopOpacity="0.3" />
            <stop offset="1" stopColor="#ff2a6d" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="dc-cyan" cx="0.5" cy="0.41" r="0.32">
            <stop offset="0" stopColor="#00f0ff" stopOpacity="0.2" />
            <stop offset="1" stopColor="#00f0ff" stopOpacity="0" />
          </radialGradient>
          <pattern id="dc-points" width="14" height="14" patternUnits="userSpaceOnUse">
            <circle cx="7" cy="7" r="0.9" fill="#00f0ff" opacity="0.16" />
          </pattern>
        </defs>
        <rect width="932" height="430" fill="url(#dc-fond)" />
        <rect width="932" height="430" fill="url(#dc-points)" />
        <g fill="none" stroke="#00f0ff" strokeWidth="1" opacity="0.06">
          <path d="M40 300c40-70 130-90 190-60s70 110 10 140-170 10-200-80z" />
          <path d="M70 300c30-45 100-60 140-38s46 76 6 96-120 6-146-58z" />
          <path d="M100 300c20-26 64-34 88-20s26 44 2 56-74 2-90-36z" />
          <path d="M640 70c60-40 200-30 250 30s10 120-90 110-210-60-160-140z" />
          <path d="M680 82c44-26 150-18 184 22s6 82-64 74-150-42-120-96z" />
          <path d="M720 96c28-14 96-10 116 14s2 48-40 42-96-26-76-56z" />
          <path d="M380 410c50-40 150-46 200-14" />
          <path d="M330 430c70-60 220-70 300-20" />
        </g>
        <rect width="932" height="430" fill="url(#dc-cyan)" />
        <rect width="932" height="430" fill="url(#dc-rose)" />
      </svg>
      <div className="lignes-balayage absolute inset-0" />
      <div className="vignette absolute inset-0" />
    </div>
  );
}
