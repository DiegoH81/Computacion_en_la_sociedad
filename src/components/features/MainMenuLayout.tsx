
import type { ReactNode } from 'react';

interface MainMenuLayoutProps {
  parroquiaActivaNombre: string;
  usuarioNombre: string;
  onBack?: () => void;
  children: ReactNode;
}

export function MainMenuLayout({
  parroquiaActivaNombre,
  usuarioNombre,
  onBack,
  children,
}: MainMenuLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="flex items-center justify-between bg-slate-200 px-4 py-3">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              <span aria-hidden="true">←</span>
              Volver
            </button>
          )}

          <span className="rounded-full bg-teal-700 px-3 py-1 text-xs font-semibold text-white">
            {parroquiaActivaNombre}
          </span>
        </div>

        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <span aria-hidden="true">IMG</span>
          {usuarioNombre}
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
