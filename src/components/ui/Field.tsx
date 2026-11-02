import { useId } from 'react';
import { FormInput } from './FormInput';

interface FieldProps {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  type?: string;
  /** panel y panelTitle: para los bloques claros de los formularios de partidas. */
  variant?: 'default' | 'panel' | 'panelTitle';
}

export function Field({ label, value, onChange, type = 'text', variant = 'default' }: FieldProps) {
  const id = useId();

  if (variant !== 'default') {
    return (
      <div>
        <label htmlFor={id} className={`mb-1 block text-xs font-bold text-slate-800 ${variant === 'panelTitle' ? 'uppercase' : ''}`}>
          {label}
        </label>
        <FormInput
          id={id}
          type={type}
          value={value}
          readOnly={!onChange}
          onChange={onChange && ((e) => onChange(e.target.value))}
        />
      </div>
    );
  }

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-slate-600">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        readOnly={!onChange}
        onChange={onChange && ((e) => onChange(e.target.value))}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
      />
    </div>
  );
}
