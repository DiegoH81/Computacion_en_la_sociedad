
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackIcon, SettingsIcon, UserIcon } from '../ui/MenuIcons';
import { AppSidebar } from './AppSidebar';

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
      <AppSidebar />

      <header className="grid h-16 grid-cols-[1fr_auto_1fr] items-center bg-darker-app px-4 text-lg font-semibold text-white uppercase">
        <div className="flex min-w-0 items-center gap-4 pr-4">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex shrink-0 items-center gap-2 font-semibold uppercase hover:opacity-80"
            >
              Volver
              <BackIcon className="h-12 w-12" />
            </button>
          )}
          <span className="truncate">{parroquiaActivaNombre}</span>
        </div>

        <div className="flex h-12 items-center border-x border-dark-app px-10 text-xl">
          {title}
        </div>

        <div className="flex min-w-0 items-center justify-end gap-3 pl-4">
          <span className="truncate">{usuarioNombre}</span>
          <UserIcon className="h-12 w-12 shrink-0 text-user-avatar" detailColor="#4C3A8C" />
          <button
            type="button"
            onClick={() => navigate('/configuracion')}
            aria-label="Configuración"
            title="Configuración"
            className="shrink-0 text-black hover:opacity-70"
          >
            <SettingsIcon className="h-12 w-12" />
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
