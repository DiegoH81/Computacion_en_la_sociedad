import type { ReactNode } from 'react';
import { RequiredMark } from './RequiredMark';

interface StackedFormFieldProps {
  label: string;
  /**
   * Para un control hecho de varios, como la fecha en tres listas. Un <label> apunta solo al
   * primer control de adentro (el día, que puede estar deshabilitado): un grupo nombra a todos.
   */
  isGroup?: boolean;
  required?: boolean;
  children: ReactNode;
}

/** Rótulo sobre un control, como el buscador de celebrante o la fecha en tres listas. */
export function StackedFormField({ label, isGroup = false, required = false, children }: StackedFormFieldProps) {
  const text = (
    <span className="mb-1 block text-xs font-bold text-slate-800">
      {label}
      {required && <RequiredMark />}
    </span>
  );

  if (isGroup) {
    return (
      <div role="group" aria-label={label} className="block">
        {text}
        {children}
      </div>
    );
  }

  return (
    <label className="block">
      {text}
      {children}
    </label>
  );
}
