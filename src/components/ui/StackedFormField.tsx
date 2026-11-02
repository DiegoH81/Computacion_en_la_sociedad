import type { ReactNode } from 'react';

/** Rótulo sobre un control compuesto, como la fecha en tres listas o el buscador de celebrante. */
export function StackedFormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-slate-800">{label}</span>
      {children}
    </label>
  );
}
