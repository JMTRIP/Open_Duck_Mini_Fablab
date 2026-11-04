// Appui fiable au doigt sur les boutons, même avec un pouce posé sur un joystick.
//
// Le navigateur (iPhone comme Android) n'envoie pas de « click » pour un doigt qui tape
// pendant qu'un autre touche déjà l'écran : avec le pouce sur un joystick, les boutons
// ne répondaient qu'une fois sur deux ou trois. L'action part donc au relâcher du doigt
// (pointerup) sur le bouton, comme une vraie manette.
//
// Le « click » que le navigateur envoie ensuite (un seul doigt) est avalé pendant un court
// moment, pour qu'il ne retombe pas sur ce qui vient d'apparaître ou de disparaître sous le
// doigt (panneau ouvert ou fermé : sinon il rouvrait le panneau qu'on venait de fermer).
// En dehors de ce moment, un click (clavier : Entrée sur un bouton) déclenche l'action.
import { useRef, type MouseEvent, type PointerEvent } from 'react';

const MARGE = 16; // px : on peut déborder un peu du bouton avant de relâcher
const FANTOME = 700; // ms : durée pendant laquelle les « click » qui suivent un appui sont avalés
const DOUBLON = 1500; // ms : un bouton ignore son propre click s'il vient d'agir au relâcher
export const ID_HAPTIQUE = 'haptique-ios-boite'; // boîte cachée du retour haptique (lib/retours)

let avalerJusqua = 0;
let gardeInstallee = false;

function avalerClicSuivant(): void {
  avalerJusqua = performance.now() + FANTOME;
  if (gardeInstallee) return;
  gardeInstallee = true;
  document.addEventListener(
    'click',
    (ev) => {
      if (performance.now() >= avalerJusqua) return;
      // Seul le click provoqué par le code pour le retour haptique de l'iPhone passe.
      // (Safari peut donner detail = 0 au click d'un toucher : on ne s'y fie pas.)
      if (ev.target instanceof Element && ev.target.closest(`#${ID_HAPTIQUE}`)) return;
      ev.preventDefault();
      ev.stopPropagation();
    },
    true,
  );
}

interface Options {
  actif?: boolean;
  /** Le click natif fait déjà l'action au clavier (bouton d'envoi de formulaire). */
  natif?: boolean;
  /** Ne réagir qu'aux appuis commencés sur l'élément lui-même (voile derrière un dialogue). */
  direct?: boolean;
}

/**
 * Propriétés à poser sur un bouton (ou un voile) : onPointerDown, onPointerUp, onPointerCancel, onClick.
 * action peut renvoyer false si elle n'a rien pu faire : le click natif prendra alors le relais.
 */
export function useAppui<T extends HTMLElement = HTMLButtonElement>(
  action: ((el: T) => void | boolean) | undefined,
  { actif = true, natif = false, direct = false }: Options = {},
) {
  const doigt = useRef<number | null>(null);
  const fait = useRef(-Infinity);
  return {
    onPointerDown(ev: PointerEvent<T>) {
      if (!actif || !action || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
      if (direct && ev.target !== ev.currentTarget) return;
      doigt.current = ev.pointerId;
    },
    onPointerUp(ev: PointerEvent<T>) {
      if (doigt.current !== ev.pointerId) return;
      doigt.current = null;
      if (!actif || !action) return;
      const r = ev.currentTarget.getBoundingClientRect();
      if (ev.clientX < r.left - MARGE || ev.clientX > r.right + MARGE || ev.clientY < r.top - MARGE || ev.clientY > r.bottom + MARGE) return;
      if (action(ev.currentTarget) === false) return;
      fait.current = performance.now();
      avalerClicSuivant();
    },
    onPointerCancel(ev: PointerEvent<T>) {
      if (doigt.current === ev.pointerId) doigt.current = null;
    },
    onClick(ev: MouseEvent<T>) {
      if (performance.now() - fait.current < DOUBLON) {
        ev.preventDefault(); // déjà fait au relâcher du doigt
        return;
      }
      if (natif || !actif || !action) return;
      if (direct && ev.target !== ev.currentTarget) return;
      action(ev.currentTarget);
    },
  };
}

/** Pour un bouton d'envoi : soumet le formulaire au relâcher du doigt (false si le navigateur ne sait pas). */
export function soumettre(el: HTMLElement): boolean {
  const f = (el as HTMLButtonElement).form;
  if (!f || typeof f.requestSubmit !== 'function') return false;
  f.requestSubmit(el as HTMLButtonElement);
  return true;
}
