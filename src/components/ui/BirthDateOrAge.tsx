import { useState } from 'react';
import { DateSelect } from './DateSelect';
import { FormInput } from './FormInput';

interface BirthDateOrAgeProps {
  fecha: string;
  edad: string;
  onChange: (values: { fecha: string; edad: string }) => void;
  /** Rótulo sobre el control. Sin él, el rótulo lo pone quien lo usa, como en las filas en espejo. */
  label?: string;
  /** Distingue a la persona si hay dos en el formulario, ej. "del esposo". */
  personLabel?: string;
}

/** La partida física puede traer la fecha de nacimiento o solo la edad: se registra una de las dos. */
export function BirthDateOrAge({ fecha, edad, onChange, label, personLabel = '' }: BirthDateOrAgeProps) {
  const [prefersAge, setPrefersAge] = useState(Boolean(edad) && !fecha);
  const named = (text: string) => `${text} ${personLabel}`.trim();

  function togglePrefersAge(checked: boolean) {
    setPrefersAge(checked);
    onChange(checked ? { fecha: '', edad } : { fecha, edad: '' });
  }

  const toggle = (
    <label className="flex items-center justify-end gap-2 text-xs text-slate-800">
      ¿Prefiere edad?
      <input
        type="checkbox"
        aria-label={named('Prefiere edad')}
        checked={prefersAge}
        onChange={(e) => togglePrefersAge(e.target.checked)}
        className="h-4 w-4"
      />
    </label>
  );

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-slate-800">{label}</span>
          {toggle}
        </div>
      )}
      {prefersAge ? (
        <FormInput
          type="number"
          min={0}
          placeholder="Edad"
          aria-label={named('Edad')}
          value={edad}
          onChange={(e) => onChange({ fecha, edad: e.target.value })}
        />
      ) : (
        <DateSelect
          ariaLabel={named('Fecha de nacimiento')}
          value={fecha}
          onChange={(value) => onChange({ fecha: value, edad })}
        />
      )}
      {!label && toggle}
    </div>
  );
}
