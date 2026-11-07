import { useId } from 'react';
import { FormInput } from './FormInput';
import { RequiredMark } from './RequiredMark';

interface FieldProps {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  type?: string;
  /** panel y panelTitle: para los bloques claros de los formularios de partidas. */
  variant?: 'default' | 'panel' | 'panelTitle';
  /** Muestra el asterisco de campo obligatorio. */
  required?: boolean;
}

export function Field({ label, value, onChange, type = 'text', variant = 'default', required = false }: FieldProps) {
  const id = useId();

  if (variant !== 'default') {
    return (
      <div>
        {/* El asterisco va fuera del label: así el nombre del campo sigue siendo solo el rótulo. */}
        <div className="mb-1 flex text-xs font-bold text-slate-800">
          <label htmlFor={id} className={variant === 'panelTitle' ? 'uppercase' : ''}>
            {label}
          </label>
          {required && <RequiredMark />}
        </div>
        <FormInput
          id={id}
          type={type}
          value={value}
          aria-required={required || undefined}
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
