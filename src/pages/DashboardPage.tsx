// src/pages/DashboardPage.tsx

import { useNavigate } from 'react-router-dom';
import { MainMenuLayout } from '../components/features/MainMenuLayout';
import { MenuActionButton } from '../components/ui/MenuActionButton';
import { useSessionStore } from '../store/sessionStore';

export function DashboardPage() {
  const navigate = useNavigate();
  const usuarioNombre = useSessionStore((state) => state.usuarioNombre);
  const rol = useSessionStore((state) => state.rol);
  const parroquiaId = useSessionStore((state) => state.parroquiaId);
  const parroquiaActivaId = useSessionStore((state) => state.parroquiaActivaId);
  const parroquiaActivaNombre = useSessionStore((state) => state.parroquiaActivaNombre);

  
  const isViewingOwnParish =
    rol === 'admin' || parroquiaActivaId === parroquiaId;

  const isViewingAnotherParish = !isViewingOwnParish;

  return (
    <MainMenuLayout
      title="Menú principal"
      parroquiaActivaNombre={parroquiaActivaNombre ?? ''}
      usuarioNombre={usuarioNombre ?? ''}
      onBack={isViewingAnotherParish ? () => navigate('/dashboard') : undefined}
    >
      <p className="mb-4 w-fit rounded-2xl bg-white px-8 py-6 text-xl text-slate-600 shadow-sm">
        ¿Qué gestión desea realizar el día de hoy?
      </p>

      <div className="grid grid-cols-3 gap-4 sm:grid-cols-5 w-full">
        <MenuActionButton icon="IMG" label="Estadísticas" onClick={() => {}} disabled />
        <MenuActionButton
          icon="IMG"
          label="Partida de bautismo"
          onClick={() => navigate('/bautismos')}
        />
        <MenuActionButton
          icon="IMG"
          label="Partida de confirmación"
          onClick={() => navigate('/confirmaciones')}
        />
        <MenuActionButton
          icon="IMG"
          label="Partida de matrimonio"
          onClick={() => navigate('/matrimonios')}
        />
        <MenuActionButton icon="IMG" label="Exportar datos" onClick={() => {}} disabled />
        <MenuActionButton
          icon="IMG"
          label="Cambiar parroquia"
          onClick={() => navigate('/parroquias/seleccionar')}
        />

        {isViewingOwnParish && (
          <MenuActionButton
            icon="IMG"
            label="Agregar sacerdote"
            onClick={() => navigate('/sacerdotes')}
            variant="admin"
          />
        )}

        {/* Gestión de usuarios: solo admin (mockup: "Agregar usuario solo para superusuario"). */}
        {rol === 'admin' && (
          <MenuActionButton
            icon="IMG"
            label="Agregar usuario"
            onClick={() => navigate('/usuarios')}
            variant="admin"
          />
        )}
      </div>
    </MainMenuLayout>
  );
}