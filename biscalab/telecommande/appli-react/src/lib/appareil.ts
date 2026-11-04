// Particularités des téléphones (iPhone surtout).

/** iPhone, iPod ou iPad (les iPad récents se présentent comme des Mac tactiles). */
export const estIOS =
  /iP(hone|od|ad)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** Ouverte depuis l'écran d'accueil (sans les barres du navigateur). */
export function enModeAppli(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    nav.standalone === true ||
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    window.matchMedia?.('(display-mode: fullscreen)').matches === true
  );
}

/**
 * Empêche le zoom et le défilement de la page : sur iPhone, Safari ignore « user-scalable=no ».
 * Les zones qui défilent (panneau de réglages) portent la classe « defile ».
 */
export function bloquerGestesNavigateur(): void {
  const dansZoneQuiDefile = (cible: EventTarget | null) =>
    cible instanceof Element && cible.closest('.defile, input, textarea') !== null;
  document.addEventListener(
    'touchmove',
    (ev) => {
      if (!dansZoneQuiDefile(ev.target)) ev.preventDefault();
    },
    { passive: false },
  );
  // Gestes de pincement propres à Safari.
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(type, (ev) => ev.preventDefault(), { passive: false });
  }
  // Double appui : pas de zoom.
  document.addEventListener('dblclick', (ev) => ev.preventDefault(), { passive: false });
}
