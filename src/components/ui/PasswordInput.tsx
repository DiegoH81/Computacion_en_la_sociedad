import { useState, type InputHTMLAttributes } from 'react';

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Las clases del cuadro de texto, como las de los demás campos del formulario. */
  inputClassName: string;
}

/** Un campo de contraseña con un botón (el ojo) para ver u ocultar lo que se escribe. */
export function PasswordInput({ inputClassName, ...props }: PasswordInputProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative">
      <input {...props} type={isVisible ? 'text' : 'password'} className={`${inputClassName} pr-11`} />
      <button
        type="button"
        onClick={() => setIsVisible((visible) => !visible)}
        aria-label={isVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-pressed={isVisible}
        title={isVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-500 hover:text-dark-app focus-visible:text-dark-app"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-5 w-5">
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
          {isVisible && <path d="M4 4l16 16" />}
        </svg>
      </button>
    </div>
  );
}
