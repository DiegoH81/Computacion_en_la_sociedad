import { useState } from 'react';
import { PARTIAL_DATE_PATTERN } from '../../lib/dates';
import { FORM_CONTROL_CLASS } from './FormInput';

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'];
const FIRST_YEAR = 1800;

interface DateSelectProps {
  /** "AAAA", "AAAA-MM" o "AAAA-MM-DD"; vacío si no hay fecha. */
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}

function daysInMonth(month: string, year: string): number {
  return new Date(Number(year), Number(month), 0).getDate();
}

/**
 * Fecha en tres listas. El libro no siempre trae el día, o ni el mes: se puede guardar solo el
 * año, o el año y el mes. Por eso el mes se habilita después del año y el día después del mes:
 * así no se arma una fecha sin sentido, como un día sin mes.
 */
export function DateSelect({ value, onChange, ariaLabel }: DateSelectProps) {
  const [, initialYear = '', initialMonth = '', initialDay = ''] = PARTIAL_DATE_PATTERN.exec(value) ?? [];
  const [day, setDay] = useState(initialDay);
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);

  function change(next: { day?: string; month?: string; year?: string }) {
    const newYear = next.year ?? year;
    // Sin año no hay mes, y sin mes no hay día.
    const newMonth = newYear ? (next.month ?? month) : '';
    let newDay = newMonth ? (next.day ?? day) : '';
    if (newDay && Number(newDay) > daysInMonth(newMonth, newYear)) newDay = '';

    setDay(newDay);
    setMonth(newMonth);
    setYear(newYear);
    onChange([newYear, newMonth, newDay].filter(Boolean).join('-'));
  }

  const select = `min-w-0 flex-1 px-1 py-1.5 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 ${FORM_CONTROL_CLASS}`;
  const pad = (number: number) => String(number).padStart(2, '0');
  const currentYear = new Date().getFullYear();

  return (
    <div className="flex w-full gap-1">
      <select
        aria-label={`${ariaLabel}: día`}
        value={day}
        onChange={(e) => change({ day: e.target.value })}
        disabled={!month}
        title={month ? undefined : 'Elija primero el mes'}
        className={select}
      >
        <option value="">Día</option>
        {month &&
          Array.from({ length: daysInMonth(month, year) }, (_, index) => (
            <option key={index} value={pad(index + 1)}>
              {index + 1}
            </option>
          ))}
      </select>
      <select
        aria-label={`${ariaLabel}: mes`}
        value={month}
        onChange={(e) => change({ month: e.target.value })}
        disabled={!year}
        title={year ? undefined : 'Elija primero el año'}
        className={select}
      >
        <option value="">Mes</option>
        {MONTHS.map((name, index) => (
          <option key={name} value={pad(index + 1)}>
            {name}
          </option>
        ))}
      </select>
      <select aria-label={`${ariaLabel}: año`} value={year} onChange={(e) => change({ year: e.target.value })} className={select}>
        <option value="">Año</option>
        {Array.from({ length: currentYear - FIRST_YEAR + 1 }, (_, index) => String(currentYear - index)).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
