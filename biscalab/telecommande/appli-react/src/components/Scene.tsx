import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

// La télécommande est dessinée sur une scène fixe de 932 × 430 (un téléphone en paysage),
// agrandie ou réduite d'un bloc pour tenir dans la zone sûre de l'écran (encoche, barre d'accueil).
export const LARGEUR = 932;
export const HAUTEUR = 430;

export default function Scene({ children }: { children: ReactNode }) {
  const zone = useRef<HTMLDivElement>(null);
  const [k, setK] = useState(1);

  useLayoutEffect(() => {
    const el = zone.current;
    if (!el) return;
    const maj = () => {
      // Zone sûre seulement : ce bloc est déjà placé entre les marges de l'encoche.
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setK(Math.min(r.width / LARGEUR, r.height / HAUTEUR));
    };
    maj();
    const ro = new ResizeObserver(maj);
    ro.observe(el);
    // iOS : la barre de Safari apparaît ou disparaît sans toujours redimensionner les blocs.
    window.addEventListener('resize', maj);
    window.addEventListener('orientationchange', maj);
    window.visualViewport?.addEventListener('resize', maj);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', maj);
      window.removeEventListener('orientationchange', maj);
      window.visualViewport?.removeEventListener('resize', maj);
    };
  }, []);

  return (
    // « clip » et non « hidden » : un bloc « hidden » se laisse encore faire défiler par le code
    // (scrollIntoView, champ de saisie qui prend le focus), ce qui décalait toute la scène.
    // Navigateurs sans « clip » : on remet le défilement à zéro aussitôt.
    <div
      className="fixed left-0 top-0 h-full w-full overflow-hidden"
      style={{ overflow: 'clip' }}
      onScroll={(ev) => {
        const t = ev.currentTarget;
        if (t.scrollTop || t.scrollLeft) {
          t.scrollTop = 0;
          t.scrollLeft = 0;
        }
      }}
    >
      <div
        ref={zone}
        className="absolute"
        style={{
          top: 'env(safe-area-inset-top, 0px)',
          right: 'env(safe-area-inset-right, 0px)',
          bottom: 'env(safe-area-inset-bottom, 0px)',
          left: 'env(safe-area-inset-left, 0px)',
        }}
      >
        {/* Centrage par position absolue : il reste juste même quand la scène est plus grande que l'écran. */}
        <div
          className="scene absolute"
          style={{
            left: '50%',
            top: '50%',
            width: LARGEUR,
            height: HAUTEUR,
            transform: `translate(-50%, -50%) scale(${k})`,
            WebkitTransform: `translate(-50%, -50%) scale(${k})`,
            transformOrigin: '50% 50%',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
