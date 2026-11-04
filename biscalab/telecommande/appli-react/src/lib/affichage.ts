// Mode « plein soleil » : fond noir uni, décor retiré, contraste et luminosité poussés.
// Il s'applique par une classe sur <html> (voir index.css), sans toucher aux composants.
import { useSyncExternalStore } from 'react';
import { ecrire, lire } from './stockage';

let soleil = lire<boolean>('soleil', false) === true;
const abonnes = new Set<() => void>();

function appliquer(): void {
  document.documentElement.classList.toggle('soleil', soleil);
}
appliquer();

export function reglerSoleil(oui: boolean): void {
  soleil = oui;
  ecrire('soleil', oui);
  appliquer();
  for (const f of abonnes) f();
}

export function useSoleil(): boolean {
  return useSyncExternalStore(
    (f) => {
      abonnes.add(f);
      return () => {
        abonnes.delete(f);
      };
    },
    () => soleil,
  );
}
