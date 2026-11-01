import { useNavigate } from 'react-router-dom';
import { MainMenuLayout } from '../components/features/MainMenuLayout';
import { useSessionStore } from '../store/sessionStore';

const ROL_LABELS: Record<string, string> = {
  admin: 'Administrador',
  usuario_parroquia: 'Usuario de parroquia',
};

interface SettingsButtonProps {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}

function SettingsButton({ label, onClick, disabled = false }: SettingsButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-xl bg-dark-app px-6 py-3 text-sm font-medium text-white uppercase hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {label}
    </button>
  );
}

export function SettingsPage() {
  const navigate = useNavigate();
  const usuarioNombre = useSessionStore((state) => state.usuarioNombre);
  const rol = useSessionStore((state) => state.rol);
  const parroquiaId = useSessionStore((state) => state.parroquiaId);
  const parroquiaActivaId = useSessionStore((state) => state.parroquiaActivaId);
  const parroquiaActivaNombre = useSessionStore((state) => state.parroquiaActivaNombre);

  const canAddPriest = rol === 'admin' || parroquiaActivaId === parroquiaId;

  return (
    <MainMenuLayout
      title="Configuración"
      parroquiaActivaNombre={parroquiaActivaNombre ?? ''}
      usuarioNombre={usuarioNombre ?? ''}
      onBack={() => navigate('/dashboard')}
    >
      <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center gap-8">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-40 w-40 items-center justify-center rounded-full bg-white p-4">
            <img src="./icons/escudo.png" alt="" className="h-full w-full object-contain" />
          </div>

          <span className="rounded-xl bg-darker-app px-8 py-2 font-semibold text-white uppercase">
            {parroquiaActivaNombre}
          </span>

          <span className="text-sm font-medium text-slate-800">
            Rol: {rol ? (ROL_LABELS[rol] ?? rol) : ''}
          </span>
        </div>

        <div className="grid w-full max-w-2xl grid-cols-2 gap-6">
          <div className="flex flex-col gap-2">
            <SettingsButton label="Exportar datos" disabled />
            <SettingsButton label="Importar datos" disabled />
          </div>

          <div className="flex flex-col gap-2">
            {canAddPriest && (
              <SettingsButton label="Agregar ministro" onClick={() => navigate('/sacerdotes')} />
            )}
            {rol === 'admin' && (
              <SettingsButton label="Agregar usuario" onClick={() => navigate('/usuarios')} />
            )}
          </div>
        </div>
      </div>
    </MainMenuLayout>
  );
}
