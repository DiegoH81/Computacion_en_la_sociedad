import type { ReactNode } from 'react';

/** Bloque claro de los formularios de partidas. */
export function FormPanel({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl bg-lighter-green p-4">
      {title && <h3 className="font-bold uppercase text-slate-900">{title}</h3>}
      {children}
    </section>
  );
}
