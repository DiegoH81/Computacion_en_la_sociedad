import { useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LogoutButton } from './LogoutButton';
import {
  BaptismIcon,
  ConfirmationIcon,
  CrestIcon,
  MarriageIcon,
  ParishIcon,
  StatisticsIcon,
} from '../ui/MenuIcons';

const ICON_STYLES = 'h-10 w-10 shrink-0';

const OPTIONS: { label: string; path: string; icon: ReactNode }[] = [
  {
    label: 'Menú principal',
    path: '/dashboard',
    icon: <ParishIcon className={ICON_STYLES} />,
  },
  {
    label: 'Cambiar parroquia',
    path: '/parroquias/seleccionar',
    icon: <ParishIcon className={ICON_STYLES} />,
  },
  {
    label: 'Partida de bautismo',
    path: '/bautismos',
    icon: <BaptismIcon className={ICON_STYLES} />,
  },
  {
    label: 'Partida de confirmación',
    path: '/confirmaciones',
    icon: <ConfirmationIcon className={ICON_STYLES} />,
  },
  {
    label: 'Partida de matrimonio',
    path: '/matrimonios',
    icon: <MarriageIcon className={ICON_STYLES} />,
  },
  {
    label: 'Estadísticas',
    path: '/estadisticas',
    icon: <StatisticsIcon className={ICON_STYLES} />,
  },
];

export function AppSidebar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  function handleSelect(path: string) {
    setIsOpen(false);
    navigate(path);
  }

  return (
    <div className="print:hidden">
      {isOpen && (
        <div
          aria-hidden="true"
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-40 bg-black/30"
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-40 h-screen w-80 bg-darker-app text-white shadow-xl transition-transform duration-200 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <nav
          aria-label="Menú lateral"
          inert={!isOpen}
          className="flex h-full flex-col items-center px-4 py-8"
        >
          <div className="mb-6 flex h-32 w-32 shrink-0 items-center justify-center rounded-full bg-white p-3 text-icon-button">
            <CrestIcon className="h-full w-full" />
          </div>

          <ul className="min-h-0 w-full flex-1 divide-y divide-white/70 overflow-y-auto">
            {OPTIONS.map(({ label, path, icon }) => {
              const isCurrent = pathname === path;

              return (
                <li key={path} className="py-2">
                  <button
                    type="button"
                    onClick={() => handleSelect(path)}
                    aria-current={isCurrent ? 'page' : undefined}
                    className={`flex w-full items-center gap-4 rounded-lg p-3 text-left text-lg leading-tight font-semibold hover:bg-icon-button ${
                      isCurrent ? 'bg-icon-button' : ''
                    }`}
                  >
                    {icon}
                    {label}
                  </button>
                </li>
              );
            })}
          </ul>

          <LogoutButton
            className="mt-2 flex w-full shrink-0 items-center gap-4 rounded-lg border-t border-white/70 p-3 text-left text-lg leading-tight font-semibold hover:bg-icon-button"
            iconClassName="h-10 w-10 shrink-0"
          />
        </nav>

        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          aria-expanded={isOpen}
          aria-label={isOpen ? 'Cerrar menú lateral' : 'Abrir menú lateral'}
          title={isOpen ? 'Cerrar menú' : 'Abrir menú'}
          className="absolute top-1/2 left-full flex h-28 w-6 -translate-y-1/2 items-center justify-center rounded-r-2xl bg-darker-app text-black shadow-md hover:bg-icon-button-light"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={`h-6 w-6 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          >
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </aside>
    </div>
  );
}
