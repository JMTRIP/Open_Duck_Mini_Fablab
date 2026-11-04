import type { CSSProperties, ReactNode } from 'react';
import { soumettre, useAppui } from '../lib/appui';

interface Props {
  action?: () => void;
  type?: 'button' | 'submit';
  label?: string;
  role?: string;
  coche?: boolean; // aria-checked, pour un interrupteur
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/** Bouton simple qui réagit au relâcher du doigt, même pouce sur un joystick (voir lib/appui). */
export default function Touche({ action, type = 'button', label, role, coche, disabled = false, className, style, children }: Props) {
  const appui = useAppui(type === 'submit' ? soumettre : action ? () => action() : undefined, {
    actif: !disabled,
    natif: type === 'submit',
  });
  return (
    <button type={type} aria-label={label} role={role} aria-checked={coche} disabled={disabled} className={className} style={style} {...appui}>
      {children}
    </button>
  );
}
