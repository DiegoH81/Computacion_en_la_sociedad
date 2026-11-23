// src/pages/DashboardPage.tsx

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogoutButton } from '../components/features/LogoutButton';
import { ParishLogo } from '../components/features/ParishLogo';
import { SyncStatusBadge } from '../components/features/SyncStatusBadge';
import { DecorativeWave } from '../components/ui/DecorativeWave';
import { MenuActionButton } from '../components/ui/MenuActionButton';
import {
  BaptismIcon,
  ConfirmationIcon,
  MarriageIcon,
  ParishIcon,
  SettingsIcon,
  StatisticsIcon,
  UserIcon,
} from '../components/ui/MenuIcons';
import { usePermissions } from '../lib/permissions';
import { useCanSeeStatistics } from '../lib/statisticsAccess';
import { RequestService } from '../services/RequestService';
import { useSessionStore } from '../store/sessionStore';

const ICON_STYLES = 'h-24 w-24';

export function DashboardPage() {
  const navigate = useNavigate();
  const usuarioNombre = useSessionStore((state) => state.usuarioNombre);
  const parroquiaActivaNombre = useSessionStore((state) => state.parroquiaActivaNombre);
  const canSeeStatistics = useCanSeeStatistics();
  const { canAdminister } = usePermissions();
  const [pendingChanges, setPendingChanges] = useState(0);

  useEffect(() => {
    if (!canAdminister) return;
    let cancelled = false;
    RequestService.pending()
      .then((response) => {
        if (!cancelled) setPendingChanges(response.pendientes.length);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [canAdminister]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-app">
      <DecorativeWave />

      <div className="relative">
        <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-8 py-4">
          <div className="flex items-center gap-4">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-white p-2 text-icon-button shadow-md">
              <ParishLogo className="h-full w-full" />
            </div>
            <span className="text-xl font-semibold text-slate-950">{parroquiaActivaNombre}</span>
          </div>

          <div className="flex items-center gap-6 text-slate-950">
            <SyncStatusBadge />
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

            <LogoutButton
              className="flex shrink-0 items-center gap-2 rounded-lg bg-dark-app px-3 py-2 text-sm font-semibold whitespace-nowrap text-white hover:opacity-90"
              iconClassName="h-5 w-5"
            />
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl px-8 pb-6">
          {canAdminister && pendingChanges > 0 && (
            <button
              type="button"
              onClick={() => navigate('/cambios')}
              className="mb-4 flex w-full items-center justify-between rounded-2xl bg-pending-soft px-6 py-3 text-left text-lg font-bold text-pending-ink shadow-sm hover:brightness-95"
            >
              {pendingChanges === 1 ? 'Hay 1 partida con cambios por aprobar' : `Hay ${pendingChanges} partidas con cambios por aprobar`}
              <span className="text-sm uppercase">Revisar</span>
            </button>
          )}

          <p className="mb-6 w-fit rounded-2xl bg-white px-6 py-3 text-xl font-bold text-black uppercase shadow-sm">
            ¿Qué gestión desea realizar el día de hoy?
          </p>

          <div className="grid w-full grid-cols-5 gap-4">
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
            {canSeeStatistics && (
              <MenuActionButton
                icon={<StatisticsIcon className={ICON_STYLES} />}
                label="Estadísticas"
                onClick={() => navigate('/estadisticas')}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
