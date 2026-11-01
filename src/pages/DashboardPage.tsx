// src/pages/DashboardPage.tsx

import { useNavigate } from 'react-router-dom';
import { MenuActionButton } from '../components/ui/MenuActionButton';
import {
  BaptismIcon,
  ConfirmationIcon,
  MarriageIcon,
  ParishIcon,
  SettingsIcon,
  UserIcon,
} from '../components/ui/MenuIcons';
import { useSessionStore } from '../store/sessionStore';

const ICON_STYLES = 'h-24 w-24';

export function DashboardPage() {
  const navigate = useNavigate();
  const usuarioNombre = useSessionStore((state) => state.usuarioNombre);
  const parroquiaActivaNombre = useSessionStore((state) => state.parroquiaActivaNombre);

  return (
    <div className="relative min-h-screen overflow-hidden bg-app">
      {/*Linea decorativa*/}
      <svg
        viewBox="0 0 487 347"
        preserveAspectRatio="none"
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full fill-darker-app"
      >
        <path d="M155 0C170 40 230 55 300 55C370 55 420 75 418 120C416 165 365 190 365 235C365 275 420 290 487 282L487 0Z" />
      </svg>

      <div className="relative">
        <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-8 py-4">
          <div className="flex items-center gap-4">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white p-2 shadow-md">
              <img src="./icons/escudo.png" alt="" className="h-full w-full object-contain" />
            </div>
            <span className="text-xl font-semibold text-slate-950">{parroquiaActivaNombre}</span>
          </div>

          <div className="flex items-center gap-6 text-slate-950">
            <button
              type="button"
              onClick={() => navigate('/configuracion')}
              aria-label="Configuración"
              title="Configuración"
              className="hover:opacity-70"
            >
              <SettingsIcon className="h-12 w-12" />
            </button>

            <div className="flex items-center gap-3 font-medium">
              <UserIcon className="h-12 w-12" />
              {usuarioNombre}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl px-8 pb-6">
          <p className="mb-6 w-fit rounded-2xl bg-white px-6 py-3 text-xl font-bold text-black uppercase shadow-sm">
            ¿Qué gestión desea realizar el día de hoy?
          </p>

          <div className="grid w-full grid-cols-4 gap-6">
            <MenuActionButton
              icon={<ParishIcon className={ICON_STYLES} />}
              label="Cambiar parroquia"
              onClick={() => navigate('/parroquias/seleccionar')}
            />
            <MenuActionButton
              icon={<BaptismIcon className={ICON_STYLES} />}
              label="Índice y partida de bautismo"
              onClick={() => navigate('/bautismos')}
            />
            <MenuActionButton
              icon={<ConfirmationIcon className={ICON_STYLES} />}
              label="Índice y partida de confirmación"
              onClick={() => navigate('/confirmaciones')}
            />
            <MenuActionButton
              icon={<MarriageIcon className={ICON_STYLES} />}
              label="Índice y partida de matrimonio"
              onClick={() => navigate('/matrimonios')}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
