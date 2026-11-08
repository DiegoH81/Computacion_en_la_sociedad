import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { SelectParishPage } from '../pages/SelectParishPage';
import { PriestsPage } from '../pages/PriestsPage';
import { MarriagesPage } from '../pages/MarriagesPage';
import { PersonSacramentPage } from '../pages/PersonSacramentPage';
import { UsersPage } from '../pages/UsersPage';
import { ParishesPage } from '../pages/ParishesPage';
import { SettingsPage } from '../pages/SettingsPage'
import { SyncPage } from '../pages/SyncPage';
import { StatisticsPage } from '../pages/StatisticsPage';
import { ChangesPage } from '../pages/ChangesPage';
import type { Role } from '../../shared/sync';

import { useCanSeeStatistics } from '../lib/statisticsAccess';
import { useSessionStore } from '../store/sessionStore';

function ProtectedRoute({
  children,
  roles,
}: {
  children: React.ReactNode;
  /** Los roles que pueden entrar. Sin indicar, cualquiera con sesión. */
  roles?: Role[];
}) {
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const rol = useSessionStore((state) => state.rol);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Solo comodidad de UI: la autorización real la aplican siempre Electron y el Worker.
  if (roles && (!rol || !roles.includes(rol))) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

// Si se cambió a una parroquia ajena, la ruta de estadísticas devuelve al menú.
function StatisticsRoute() {
  const canSeeStatistics = useCanSeeStatistics();

  if (!canSeeStatistics) {
    return <Navigate to="/dashboard" replace />;
  }

  return <StatisticsPage />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/parroquias/seleccionar"
        element={
          <ProtectedRoute>
            <SelectParishPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/ministros"
        element={
          <ProtectedRoute>
            <PriestsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/matrimonios"
        element={
          <ProtectedRoute>
            <MarriagesPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/bautismos"
        element={
          <ProtectedRoute>
            <PersonSacramentPage tipo="bautismo" />
          </ProtectedRoute>
        }
      />

      <Route
        path="/confirmaciones"
        element={
          <ProtectedRoute>
            <PersonSacramentPage tipo="confirmacion" />
          </ProtectedRoute>
        }
      />

      <Route
        path="/usuarios"
        element={
          <ProtectedRoute roles={['admin_general', 'admin_parroquia']}>
            <UsersPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/parroquias"
        element={
          <ProtectedRoute roles={['admin_general']}>
            <ParishesPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/cambios"
        element={
          <ProtectedRoute roles={['admin_parroquia']}>
            <ChangesPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/configuracion"
        element={
        <ProtectedRoute>
          <SettingsPage />
        </ProtectedRoute>
        }
      />

      <Route
        path="/estadisticas"
        element={
          <ProtectedRoute>
            <StatisticsRoute />
          </ProtectedRoute>
        }
      />

      <Route
        path="/sincronizacion"
        element={
          <ProtectedRoute>
            <SyncPage />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/login" replace />} />

    </Routes>
  );
}
