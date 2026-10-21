import { useNavigate } from 'react-router-dom';
import { MainMenuLayout } from '../components/features/MainMenuLayout';
import { ProfileCard } from '../components/features/ProfileCard';
import { useSessionStore } from '../store/sessionStore';

const ROL_LABELS: Record<string, string> = {
  admin: 'Administrador',
  usuario_parroquia: 'Usuario de parroquia',
};

export function ProfilePage() {
  const navigate = useNavigate();
  const usuarioNombre = useSessionStore((state) => state.usuarioNombre);
  const rol = useSessionStore((state) => state.rol);
  const parroquiaActivaNombre = useSessionStore((state) => state.parroquiaActivaNombre);

  return (
    <MainMenuLayout
      parroquiaActivaNombre={parroquiaActivaNombre ?? ''}
      usuarioNombre={usuarioNombre ?? ''}
      onBack={() => navigate('/dashboard')}
    >
      <div className="flex justify-center">
        <ProfileCard
          parroquiaNombre={parroquiaActivaNombre ?? ''}
          rol={rol ? (ROL_LABELS[rol] ?? rol) : ''}
        />
      </div>
    </MainMenuLayout>
  );
}