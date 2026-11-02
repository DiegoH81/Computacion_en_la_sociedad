import { useState } from 'react';

interface MarginalNotesFieldProps {
  value: string;
  onChange: (value: string) => void;
}

export function MarginalNotesField({ value, onChange }: MarginalNotesFieldProps) {
  const [isOpen, setIsOpen] = useState(Boolean(value));

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="rounded-lg border border-white bg-solid-blue px-4 py-1 text-xs font-bold uppercase text-white hover:opacity-90"
      >
        {isOpen ? 'Ocultar notas marginales' : 'Añadir notas marginales'}
      </button>
      {isOpen && (
        <textarea
          aria-label="Notas marginales"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-teal-600"
        />
      )}
    </div>
  );
}
