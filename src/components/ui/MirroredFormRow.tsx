import type { ReactNode } from 'react';

interface MirroredFormRowProps {
  label: string;
  left: ReactNode;
  right: ReactNode;
}

/** Fila con un mismo dato para dos personas: el rótulo al centro y un control a cada lado. */
export function MirroredFormRow({ label, left, right }: MirroredFormRowProps) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_11rem_minmax(0,1fr)] items-start gap-3">
      <div className="min-w-0">{left}</div>
      <div className="rounded-md bg-table-panel px-2 py-1.5 text-center text-sm font-semibold text-white">{label}</div>
      <div className="min-w-0">{right}</div>
    </div>
  );
}

interface MirroredColumnTitlesProps {
  left: string;
  right: string;
}

export function MirroredColumnTitles({ left, right }: MirroredColumnTitlesProps) {
  const title = 'justify-self-center rounded-md px-8 py-1 text-sm font-bold uppercase text-slate-900';
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_11rem_minmax(0,1fr)] gap-3">
      <span className={`${title} bg-blue-200`}>{left}</span>
      <span />
      <span className={`${title} bg-purple-300`}>{right}</span>
    </div>
  );
}
