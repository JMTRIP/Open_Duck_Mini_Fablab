// Stockage local du téléphone. Il peut être bloqué (navigation privée) : l'appli s'en passe.
// Mêmes clés que l'appli classique (« canard.id », « canard.nom »…) : on garde son identité.
const PREFIXE = 'canard.';

export function lire<T>(cle: string, defaut: T): T {
  try {
    const v = localStorage.getItem(PREFIXE + cle);
    return v === null ? defaut : (JSON.parse(v) as T);
  } catch {
    return defaut;
  }
}

export function ecrire(cle: string, valeur: unknown): void {
  try {
    localStorage.setItem(PREFIXE + cle, JSON.stringify(valeur));
  } catch {
    /* rien */
  }
}

/** Identifiant secret du téléphone (crypto.randomUUID n'existe pas hors HTTPS). */
export function nouvelId(): string {
  const octets = new Uint8Array(16);
  crypto.getRandomValues(octets);
  return Array.from(octets, (x) => x.toString(16).padStart(2, '0')).join('');
}
