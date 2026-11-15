import { useState } from 'react';
import { date_problem, days_in_month, join_date, split_date, type DateParts } from '../../../shared/partial_date';
import { FORM_CONTROL_CLASS } from './FormInput';

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'];
const FIRST_YEAR = 1800;

interface DateSelectProps {
  /** "AAAA", "AAAA-MM" o "AAAA-MM-DD"; vacío si no hay fecha. Con "?" si está a medias (ej. "?-03-05"). */
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}

/**
 * Fecha en tres listas: día, mes y año. Las tres se pueden elegir en cualquier orden, así el Tab
 * pasa de izquierda a derecha. El libro no siempre trae el día, o ni el mes: se puede guardar solo
 * el año, o el año y el mes. Una fecha sin año, o con día y sin mes, muestra qué le falta y la
 * partida no se guarda hasta completarla.
 */
export function DateSelect({ value, onChange, ariaLabel }: DateSelectProps) {
  const [parts, setParts] = useState<DateParts>(() => split_date(value));

  function change(next: Partial<DateParts>) {
    const newParts = { ...parts, ...next };
    // Al cambiar el mes o el año, un día que ya no existe (ej. 31 de abril) se borra.
    if (newParts.day && newParts.month && Number(newParts.day) > days_in_month(newParts.month, newParts.year)) newParts.day = '';

    setParts(newParts);
    onChange(join_date(newParts));
  }

  const problem = date_problem(join_date(parts));
  const select = `min-w-0 flex-1 px-1 py-1.5 ${FORM_CONTROL_CLASS}`;
  const pad = (number: number) => String(number).padStart(2, '0');
  const currentYear = new Date().getFullYear();
  const dayCount = parts.month ? days_in_month(parts.month, parts.year) : 31;

  return (
    <div className="flex w-full flex-col gap-0.5">
      <div className="flex w-full gap-1">
        <select aria-label={`${ariaLabel}: día`} value={parts.day} onChange={(e) => change({ day: e.target.value })} className={select}>
          <option value="">Día</option>
          {Array.from({ length: dayCount }, (_, index) => (
            <option key={index} value={pad(index + 1)}>
              {index + 1}
            </option>
          ))}
        </select>
        <select aria-label={`${ariaLabel}: mes`} value={parts.month} onChange={(e) => change({ month: e.target.value })} className={select}>
          <option value="">Mes</option>
          {MONTHS.map((name, index) => (
            <option key={name} value={pad(index + 1)}>
              {name}
            </option>
          ))}
        </select>
        <select aria-label={`${ariaLabel}: año`} value={parts.year} onChange={(e) => change({ year: e.target.value })} className={select}>
          <option value="">Año</option>
          {Array.from({ length: currentYear - FIRST_YEAR + 1 }, (_, index) => String(currentYear - index)).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
      {problem && (
        <p role="alert" className="text-xs font-semibold text-solid-red">
          Fecha incompleta: {problem}.
        </p>
      )}
    </div>
  );
}
