// Nombres à la française : virgule décimale, vrai signe moins.

/** 0,15 · −1,2 · 8,31 */
export function nombre(n: number, decimales = 0): string {
  const t = Math.abs(n).toFixed(decimales);
  const negatif = n < 0 && Number(t) !== 0; // pas de « −0,00 »
  return `${negatif ? '−' : ''}${t.replace('.', ',')}`;
}

/** Signe toujours écrit, pour que les colonnes restent alignées : +0,15 · −0,15 · espace pour zéro. */
export function signe(n: number, decimales = 2): string {
  const t = Math.abs(n).toFixed(decimales);
  const s = Number(t) === 0 ? ' ' : n > 0 ? '+' : '−'; // espace de la largeur d'un chiffre
  return `${s}${t.replace('.', ',')}`;
}
