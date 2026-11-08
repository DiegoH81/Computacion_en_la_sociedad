import { useState } from 'react';
import { DateSelect } from './DateSelect';
import { FormInput } from './FormInput';
import { RequiredMark } from './RequiredMark';

interface BirthDateOrApproximateProps {
  fecha: string | null;
  fechaAproximada: string | null;
  onChange: (values: { fecha: string | null; fechaAproximada: string | null }) => void;
  /** Rótulo sobre el control. Sin él, el rótulo lo pone quien lo usa, como en las filas en espejo. */
  label?: string;
  /** Distingue a la persona si hay dos en el formulario, ej. "del esposo". */
  personLabel?: string;
  required?: boolean;
}

/**
 * La partida física puede traer la fecha de nacimiento exacta o algo aproximado, escrito a mano:
 * "22 AG 1978", "27 años al día de la boda"... Por eso la aproximada es texto libre.
 * Se registra una de las dos.
 */
export function BirthDateOrApproximate({ fecha, fechaAproximada, onChange, label, personLabel = '', required = false }: BirthDateOrApproximateProps) {
  const [prefersApproximate, setPrefersApproximate] = useState(fechaAproximada !== null && !fecha);
  const named = (text: string) => `${text} ${personLabel}`.trim();

  function togglePrefersApproximate(checked: boolean) {
    setPrefersApproximate(checked);
    onChange(checked ? { fecha: null, fechaAproximada } : { fecha, fechaAproximada: null });
  }

  const toggle = (
    <label className="flex items-center justify-end gap-2 text-xs text-slate-800">
      ¿Prefiere fecha aproximada?
      <input
        type="checkbox"
        aria-label={named('Prefiere fecha aproximada')}
        checked={prefersApproximate}
        onChange={(e) => togglePrefersApproximate(e.target.checked)}
        className="h-4 w-4"
      />
    </label>
  );

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-slate-800">
            {label}
            {required && <RequiredMark />}
          </span>
          {toggle}
        </div>
      )}
      {prefersApproximate ? (
        <FormInput
          placeholder="Ej.: 22 AG 1978 o 27 años al día de la boda"
          aria-label={named('Fecha aproximada')}
          value={fechaAproximada ?? ''}
          onChange={(e) => onChange({ fecha, fechaAproximada: e.target.value === '' ? null : e.target.value })}
        />
      ) : (
        <DateSelect
          ariaLabel={named('Fecha de nacimiento')}
          value={fecha ?? ''}
          onChange={(value) => onChange({ fecha: value || null, fechaAproximada })}
        />
      )}
      {!label && toggle}
    </div>
  );
}
