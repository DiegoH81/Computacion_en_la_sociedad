import type { InputHTMLAttributes } from 'react';

export const FORM_CONTROL_CLASS =
  'rounded-md border border-slate-300 bg-white text-sm text-slate-800 outline-none focus:border-teal-600';

export function FormInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`w-full px-3 py-1.5 read-only:bg-slate-100 ${FORM_CONTROL_CLASS}`} />;
}
