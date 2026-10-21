import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { SelectParishPage } from '../pages/SelectParishPage';
import { ProfilePage } from '../pages/ProfilePage';
import { PriestsPage } from '../pages/PriestsPage';
import { MarriagesPage } from '../pages/MarriagesPage';
import { BaptismsPage } from '../pages/BaptismsPage';
import { ConfirmationsPage } from '../pages/ConfirmationsPage';
import { UsersPage } from '../pages/UsersPage';
import { useSessionStore } from '../store/sessionStore';

function ProtectedRoute({
  children,
  requireAdmin = false,
}: {
  children: React.ReactNode;
  requireAdmin?: boolean;
}) {
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const rol = useSessionStore((state) => state.rol);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Solo comodidad de UI: la autorización real la aplica siempre el Worker.
  if (requireAdmin && rol !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
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
        path="/perfil"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/sacerdotes"
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
            <BaptismsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/confirmaciones"
        element={
          <ProtectedRoute>
            <ConfirmationsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/usuarios"
        element={
          <ProtectedRoute requireAdmin>
            <UsersPage />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/login" replace />} />

    </Routes>
  );
}
