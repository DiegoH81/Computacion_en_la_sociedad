import { useId, useState, type FormEvent } from 'react';

interface LoginFormProps {
  onSubmit: (username: string, password: string) => void;
  isLoading: boolean;
  errorMessage: string | null;
}

const LABEL = 'mb-1 block font-semibold text-dark-app';
const INPUT =
  'w-full rounded-xl border-2 border-slate-300 bg-white px-4 py-2 text-black placeholder-slate-500 outline-none transition-colors focus:border-darker-app';

export function LoginForm({ onSubmit, isLoading, errorMessage }: LoginFormProps) {
  const fieldId = useId();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(username, password);
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
      <div>
        <label htmlFor={`${fieldId}-username`} className={LABEL}>
          Usuario
        </label>
        <input
          id={`${fieldId}-username`}
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Nombre de usuario"
          autoComplete="username"
          autoFocus
          required
          className={INPUT}
        />
      </div>

      <div>
        <label htmlFor={`${fieldId}-password`} className={LABEL}>
          Contraseña
        </label>
        <input
          id={`${fieldId}-password`}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña"
          autoComplete="current-password"
          required
          className={INPUT}
        />
      </div>

      {errorMessage && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-2 font-medium text-solid-red">
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="mt-1 rounded-xl bg-icon-button px-4 py-3 font-bold text-white shadow-md transition-colors hover:bg-dark-app disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? 'Ingresando...' : 'Iniciar sesión'}
      </button>
    </form>
  );
}
