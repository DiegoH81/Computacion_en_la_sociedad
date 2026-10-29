import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoginForm } from '../components/features/LoginForm';
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
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-slate-50">
      <h1 className="text-3xl font-bold text-slate-800">LOGIN</h1>

      <div className="flex w-full max-w-md flex-col items-center gap-6 rounded-lg bg-teal-700 p-10">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white text-4xl">
          IMG
        </div>

        <LoginForm
          onSubmit={handleSubmit}
          isLoading={isLoading}
          errorMessage={errorMessage}
        />
      </div>
    </div>
  );
}