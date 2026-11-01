import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoginForm } from '../components/features/LoginForm';
import { DecorativeWave } from '../components/ui/DecorativeWave';
import { CrestIcon } from '../components/ui/MenuIcons';
import { handleLogin } from '../controllers/AuthController';

export function LoginPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(username: string, password: string) {
    setIsLoading(true);
    setErrorMessage(null);

    const result = await handleLogin(username, password);

    setIsLoading(false);

    if (!result.success) {
      setErrorMessage(result.errorMessage ?? 'No se pudo iniciar sesión.');
      return;
    }

    navigate(result.redirectTo ?? '/dashboard');
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-app p-4">
      <DecorativeWave />

      <main className="relative flex w-full max-w-md flex-col items-center gap-4 rounded-3xl bg-white px-10 py-6 shadow-2xl">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white p-2 text-icon-button shadow-md ring-4 ring-lighter-green">
          <CrestIcon className="h-full w-full" />
        </div>

        <div className="text-center">
          <h1 className="text-2xl font-bold text-dark-app">Sistema de Prelatura</h1>
          <p className="text-slate-600">Ingrese sus datos para continuar</p>
        </div>

        <LoginForm
          onSubmit={handleSubmit}
          isLoading={isLoading}
          errorMessage={errorMessage}
        />
      </main>
    </div>
  );
}