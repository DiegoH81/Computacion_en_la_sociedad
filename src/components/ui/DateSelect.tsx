import { useState } from 'react';
import { FORM_CONTROL_CLASS } from './FormInput';

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'];
const FIRST_YEAR = 1800;

interface DateSelectProps {
  /** YYYY-MM-DD, o vacío mientras la fecha no esté completa. */
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}

function daysInMonth(month: string, year: string): number {
  if (!month) return 31;
  // Sin año se admite el 29 de febrero: 2000 fue bisiesto.
  return new Date(Number(year || 2000), Number(month), 0).getDate();
}

export function DateSelect({ value, onChange, ariaLabel }: DateSelectProps) {
  const [initialYear = '', initialMonth = '', initialDay = ''] = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split('-') : [];
  const [day, setDay] = useState(initialDay);
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);

  function change(next: { day?: string; month?: string; year?: string }) {
    const newMonth = next.month ?? month;
    const newYear = next.year ?? year;
    let newDay = next.day ?? day;
    if (Number(newDay) > daysInMonth(newMonth, newYear)) newDay = '';

    setDay(newDay);
    setMonth(newMonth);
    setYear(newYear);
    onChange(newDay && newMonth && newYear ? `${newYear}-${newMonth}-${newDay}` : '');
  }

  const isIncomplete = Boolean(day || month || year) && !(day && month && year);
  const select = `min-w-0 flex-1 px-1 py-1.5 ${FORM_CONTROL_CLASS} ${isIncomplete ? 'border-solid-red' : ''}`;
  const pad = (number: number) => String(number).padStart(2, '0');
  const currentYear = new Date().getFullYear();

  return (
    <div className="flex w-full gap-1" title={isIncomplete ? 'Fecha incompleta: no se guardará' : undefined}>
      <select aria-label={`${ariaLabel}: día`} value={day} onChange={(e) => change({ day: e.target.value })} className={select}>
        <option value="">Día</option>
        {Array.from({ length: daysInMonth(month, year) }, (_, index) => (
          <option key={index} value={pad(index + 1)}>
            {index + 1}
          </option>
        ))}
      </select>
      <select aria-label={`${ariaLabel}: mes`} value={month} onChange={(e) => change({ month: e.target.value })} className={select}>
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
