import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ParishSelector } from '../components/features/ParishSelector';
import { useSessionStore } from '../store/sessionStore';
import { AuthService, type Parish } from '../services/AuthService';
import { ApiError } from '../lib/apiClient';

export function SelectParishPage() {
  const navigate = useNavigate();
  const [parishes, setParishes] = useState<Parish[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const token = useSessionStore((state) => state.token);
  const parroquiaActivaId = useSessionStore((state) => state.parroquiaActivaId);
  const setParroquiaActiva = useSessionStore((state) => state.setParroquiaActiva);

  useEffect(() => {
    if (!token) return;

    AuthService.getParishes(token)
      .then((response) => setParishes(response.parishes))
      .catch((error) => {
        setErrorMessage(
          error instanceof ApiError ? error.message : 'No se pudieron cargar las parroquias.',
        );
      })
      .finally(() => setIsLoading(false));
  }, [token]);

  function handleSelect(parishId: number) {
    const parish = parishes.find((p) => p.id === parishId);
    if (parish) {
      setParroquiaActiva(parish.id, parish.nombre);
    }
    navigate('/dashboard');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      {errorMessage ? (
        <p role="alert" className="text-sm font-medium text-red-600">
          {errorMessage}
        </p>
      ) : (
        <ParishSelector
          parishes={parishes}
          currentParishId={parroquiaActivaId || null}
          onSelect={handleSelect}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}