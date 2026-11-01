
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface MainMenuLayoutProps {
  title: string;
  parroquiaActivaNombre: string;
  usuarioNombre: string;
  onBack?: () => void;
  children: ReactNode;
}

export function MainMenuLayout({
  title,
  parroquiaActivaNombre,
  usuarioNombre,
  onBack,
  children,
}: MainMenuLayoutProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-app">
      <header className="grid grid-cols-3 items-center bg-slate-200 px-4 py-3">
        <div className="flex items-center">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Volver
              <img src="./icons/volver.png" alt="" className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="text-center">
          <p className="font-semibold text-slate-800">{title}</p>
          <p className="text-xs text-slate-600">{parroquiaActivaNombre}</p>
        </div>

        <div className="flex items-center justify-end gap-2 text-sm font-medium text-slate-700">
          {usuarioNombre}
          <img src="./icons/usuario.png" alt="" className="h-5 w-5" />
          <button
            type="button"
            onClick={() => navigate('/configuracion')}
            aria-label="Configuración"
            title="Configuración"
            className="flex items-center hover:opacity-70"
          >
          <img src="./icons/configuracion.png" alt="" className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="w-full px-6 py-8">
        <div className="mx-auto w-full max-w-5xl">
          {children}
        </div>
      </main>
    </div>
  );
}
