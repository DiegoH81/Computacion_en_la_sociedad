import { useState, type FormEvent } from 'react';

interface LoginFormProps {
  onSubmit: (username: string, password: string) => void;
  isLoading: boolean;
  errorMessage: string | null;
}

export function LoginForm({ onSubmit, isLoading, errorMessage }: LoginFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(username, password);
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-xs flex-col gap-3">
      <input
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Nombre de usuario"
        autoComplete="username"
        required
        className="rounded-md border border-white/40 bg-white/10 px-4 py-2 text-sm text-white placeholder-white/70 outline-none focus:border-white"
      />

      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Contraseña"
        autoComplete="current-password"
        required
        className="rounded-md border border-white/40 bg-white/10 px-4 py-2 text-sm text-white placeholder-white/70 outline-none focus:border-white"
      />

      {errorMessage && (
        <p role="alert" className="text-sm font-medium text-red-200">
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="mt-2 rounded-md bg-white px-4 py-2 text-sm font-semibold text-teal-800 transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isLoading ? 'Ingresando...' : 'Iniciar sesión'}
      </button>
    </form>
  );
}