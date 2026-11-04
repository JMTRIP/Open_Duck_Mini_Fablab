// Palette « radar néon », poussée pour rester lisible dehors (textes clairs, couleurs saturées).
export const NEON = {
  cyan: '#00f0ff',
  cyanClair: '#a6fbff',
  rose: '#ff2a6d',
  roseClair: '#ffa3c0',
  jaune: '#f9f002',
  vert: '#39ff9c',
  bleu: '#1fbaff',
  grisBleu: '#a9bfd9',
  texte: '#f2fdff',
  nuit: '#04070f',
} as const;

/** « #rrggbb » + opacité → « rgba(r, g, b, a) » (plus sûr que color-mix sur les vieux téléphones). */
export function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
