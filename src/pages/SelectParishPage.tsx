import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ParishSelector } from '../components/features/ParishSelector';
import { useSessionStore } from '../store/sessionStore';
import { AuthService, type Parish } from '../services/AuthService';
import { ApiError } from '../lib/apiClient';

// Elegir la parroquia que se ve. Si es una de las suyas, también pasa a ser la parroquia de trabajo
// (donde registra y edita, con el rol que tiene en ella). Las demás solo se consultan.
export function SelectParishPage() {
  const navigate = useNavigate();
  const [parishes, setParishes] = useState<Parish[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const token = useSessionStore((state) => state.token);
  const rol = useSessionStore((state) => state.rol);
  const parroquiaActivaId = useSessionStore((state) => state.parroquiaActivaId);
  const misParroquias = useSessionStore((state) => state.misParroquias);
  const setParroquiaActiva = useSessionStore((state) => state.setParroquiaActiva);
  const setParroquiaTrabajo = useSessionStore((state) => state.setParroquiaTrabajo);

  useEffect(() => {
    if (!token) return;

    AuthService.getParishes()
      .then((response) => setParishes(response.parroquias))
      .catch((error) => {
        setErrorMessage(
          error instanceof ApiError ? error.message : 'No se pudieron cargar las parroquias.',
        );
      })
      .finally(() => setIsLoading(false));
  }, [token]);

  async function handleSelect(parishId: number) {
    const parish = parishes.find((p) => p.id === parishId);
    if (!parish) return;

    if (rol !== 'admin_general' && misParroquias.some((own) => own.id === parishId)) {
      try {
        const working = await AuthService.selectParish(parishId);
        setParroquiaTrabajo(working.parroquia_id, working.rol);
      } catch (error) {
        setErrorMessage(error instanceof ApiError ? error.message : 'No se pudo cambiar de parroquia.');
        return;
      }
    }

    setParroquiaActiva(parish.id, parish.nombre);
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
          ownParishIds={misParroquias.map((parish) => parish.id)}
          onSelect={handleSelect}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}
