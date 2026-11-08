import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackupDialog, type BackupMode } from '../components/features/BackupDialog';
import { LegacyImportDialog } from '../components/features/LegacyImportDialog';
import { MainMenuLayout } from '../components/features/MainMenuLayout';
import { ParishLogoSettings } from '../components/features/ParishLogoSettings';
import { handleLogout } from '../controllers/AuthController';
import { ApiError } from '../lib/apiClient';
import { ROLE_LABELS, usePermissions } from '../lib/permissions';
import { ImportService } from '../services/ImportService';
import { useSessionStore } from '../store/sessionStore';

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
  const parroquiaActivaId = useSessionStore((state) => state.parroquiaActivaId);
  const parroquiaActivaNombre = useSessionStore((state) => state.parroquiaActivaNombre);
  const permissions = usePermissions();

  const [isImporting, setIsImporting] = useState(false);
  const [backupMode, setBackupMode] = useState<BackupMode | null>(null);
  const [packageMessage, setPackageMessage] = useState<{ text: string; isError: boolean } | null>(null);

  async function handleExportPackage() {
    setPackageMessage(null);
    try {
      const result = await ImportService.exportPackage();
      if (result.cancelado) return;
      setPackageMessage({
        text: `Paquete inicial guardado: ${result.parroquias} parroquias, ${result.usuarios} usuarios y ${result.partidas} partidas.`,
        isError: false,
      });
    } catch (error) {
      setPackageMessage({ text: error instanceof ApiError ? error.message : 'No se pudo generar el paquete inicial.', isError: true });
    }
  }

  // Restaurar cierra la sesión en Electron: las cuentas pueden ser otras, hay que volver a entrar.
  async function handleRestored() {
    await handleLogout();
    navigate('/login', { replace: true });
  }

  return (
    <MainMenuLayout
      title="Configuración"
      parroquiaActivaNombre={parroquiaActivaNombre ?? ''}
      usuarioNombre={usuarioNombre ?? ''}
      onBack={() => navigate('/dashboard')}
    >
      <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center gap-8">
        <div className="flex flex-col items-center gap-3">
          <ParishLogoSettings parroquiaId={parroquiaActivaId} canEdit={permissions.canAdminister} />

          <span className="rounded-xl bg-darker-app px-8 py-2 font-semibold text-white uppercase">
            {parroquiaActivaNombre}
          </span>

          <span className="text-sm font-medium text-slate-800">
            Rol: {rol ? ROLE_LABELS[rol] : ''}
          </span>
        </div>

        {packageMessage && (
          <p role={packageMessage.isError ? 'alert' : 'status'} className={`rounded-lg bg-white px-4 py-2 text-sm font-medium ${packageMessage.isError ? 'text-solid-red' : 'text-dark-app'}`}>
            {packageMessage.text}
          </p>
        )}

        <div className="grid w-full max-w-2xl grid-cols-2 gap-6">
          <div className="flex flex-col gap-2">
            {permissions.canAdminister && (
              <SettingsButton label="Importar Excel del sistema anterior" onClick={() => setIsImporting(true)} />
            )}
            {permissions.canManageUsers && (
              <>
                <SettingsButton label="Exportar respaldo" onClick={() => setBackupMode('export')} />
                <SettingsButton label="Restaurar respaldo" onClick={() => setBackupMode('restore')} />
              </>
            )}
            {rol === 'admin_general' && (
              <SettingsButton label="Generar paquete inicial" onClick={handleExportPackage} />
            )}
          </div>

          <div className="flex flex-col gap-2">
            {permissions.canWrite && (
              <SettingsButton label="Agregar ministro" onClick={() => navigate('/ministros')} />
            )}
            {permissions.canManageUsers && (
              <SettingsButton label="Agregar usuario" onClick={() => navigate('/usuarios')} />
            )}
            {permissions.canManageParishes && (
              <SettingsButton label="Parroquias" onClick={() => navigate('/parroquias')} />
            )}
            {permissions.canAdminister && (
              <SettingsButton label="Cambios por aprobar" onClick={() => navigate('/cambios')} />
            )}
          </div>
        </div>
      </div>

      {isImporting && <LegacyImportDialog parroquiaNombre={parroquiaActivaNombre ?? ''} onClose={() => setIsImporting(false)} />}
      {backupMode && <BackupDialog mode={backupMode} onClose={() => setBackupMode(null)} onRestored={handleRestored} />}
    </MainMenuLayout>
  );
}
