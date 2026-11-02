import type { ReactNode } from 'react';

/** Rótulo a la izquierda y control a la derecha, para los bloques oscuros de los formularios de partidas. */
export function InlineFormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex items-center gap-3 text-sm text-white">
      <span className="shrink-0">{label}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </label>
  );
}
