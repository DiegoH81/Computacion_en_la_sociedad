import { useState } from 'react';
import { ApiError } from '../../lib/apiClient';
import { BackupService } from '../../services/BackupService';
import { PasswordInput } from '../ui/PasswordInput';

const PASSWORD_MIN_LENGTH = 8;

function count(total: number, singular: string, plural: string): string {
  return `${total} ${total === 1 ? singular : plural}`;
}

const BUTTON = 'rounded-md px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50';
const INPUT = 'w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-dark-app';

/** export: guardar un respaldo. restore: reemplazar los datos de esta PC (con sesión). restoreOnEmptyPc: lo mismo desde el login. */
export type BackupMode = 'export' | 'restore' | 'restoreOnEmptyPc';

interface BackupDialogProps {
  mode: BackupMode;
  onClose: () => void;
  /** Después de restaurar: hay que volver a iniciar sesión. */
  onRestored: () => void;
}

const TEXTS: Record<BackupMode, { title: string; intro: string; action: string }> = {
  export: {
    title: 'Exportar respaldo',
    intro:
      'Se guarda en un archivo todo lo que tiene esta PC, también lo que todavía no se subió al servidor. ' +
      'Elija una contraseña: sin ella el archivo no se puede abrir. Anótela en un lugar seguro, porque no se puede recuperar.',
    action: 'Elegir dónde guardar',
  },
  restore: {
    title: 'Restaurar respaldo',
    intro:
      'Los datos de esta PC se reemplazan por los del respaldo y hay que volver a iniciar sesión. ' +
      'Lo que esta PC tenga sin subir y no esté en el respaldo se pierde (la base anterior se guarda aparte por un mes).',
    action: 'Elegir el respaldo',
  },
  restoreOnEmptyPc: {
    title: 'Restaurar respaldo',
    intro: 'Escriba la contraseña del respaldo y elija el archivo. Después podrá entrar con las cuentas que tenía la PC respaldada.',
    action: 'Elegir el respaldo',
  },
};

/** Pide la contraseña del respaldo y, al aceptar, abre el diálogo de Windows para elegir el archivo. */
export function BackupDialog({ mode, onClose, onRestored }: BackupDialogProps) {
  const texts = TEXTS[mode];
  const isExport = mode === 'export';

  const [password, setPassword] = useState('');
  const [repeated, setRepeated] = useState('');
  const [isWorking, setIsWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);
  const [isRestored, setIsRestored] = useState(false);

  function passwordError(): string | null {
    if (!password) return 'Escriba la contraseña del respaldo.';
    if (!isExport) return null;
    if (password.length < PASSWORD_MIN_LENGTH) return `La contraseña del respaldo debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`;
    if (password !== repeated) return 'Las contraseñas no coinciden.';
    return null;
  }

  async function handleAction() {
    const error = passwordError();
    if (error) {
      setErrorMessage(error);
      return;
    }

    setIsWorking(true);
    setErrorMessage(null);
    try {
      const request = isExport ? BackupService.exportBackup : mode === 'restore' ? BackupService.restoreBackup : BackupService.restoreOnEmptyPc;
      const result = await request(password);
      if (result.cancelado) return;

      const records = count(result.partidas, 'partida', 'partidas');
      const pending = result.pendientes > 0 ? ` Incluye ${count(result.pendientes, 'cambio pendiente', 'cambios pendientes')} de subir al servidor.` : '';
      if (isExport) {
        setDoneMessage(`Respaldo guardado: ${records}.${pending}`);
      } else {
        setIsRestored(true);
        setDoneMessage(`Respaldo restaurado: ${records}.${pending} Ya puede iniciar sesión.`);
      }
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Ocurrió un error inesperado.');
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div role="dialog" aria-modal="true" aria-label={texts.title} className="flex w-full max-w-lg flex-col gap-4 rounded-lg bg-white p-6 text-left shadow-lg">
        <h2 className="text-lg font-semibold text-slate-800">{texts.title}</h2>

        {!doneMessage && (
          <>
            <p className={`text-sm ${mode === 'restore' ? 'rounded-md bg-amber-100 px-3 py-2 text-amber-900' : 'text-slate-600'}`}>{texts.intro}</p>

            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Contraseña del respaldo
              <PasswordInput value={password} onChange={(event) => setPassword(event.target.value)} inputClassName={INPUT} disabled={isWorking} />
            </label>

            {isExport && (
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Repetir contraseña
                <PasswordInput value={repeated} onChange={(event) => setRepeated(event.target.value)} inputClassName={INPUT} disabled={isWorking} />
              </label>
            )}
          </>
        )}

        {errorMessage && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-solid-red">
            {errorMessage}
          </p>
        )}

        {doneMessage && (
          <p role="status" className="rounded-md bg-lighter-green px-3 py-2 text-sm font-medium text-dark-app">
            {doneMessage}
          </p>
        )}

        <div className="flex justify-end gap-2">
          {isRestored ? (
            <button type="button" onClick={onRestored} className={`${BUTTON} bg-darker-app`}>
              Ir al inicio de sesión
            </button>
          ) : (
            <>
              <button type="button" onClick={onClose} disabled={isWorking} className="rounded-md bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300">
                {doneMessage ? 'Cerrar' : 'Cancelar'}
              </button>
              {!doneMessage && (
                <button type="button" onClick={handleAction} disabled={isWorking} className={`${BUTTON} ${mode === 'restore' ? 'bg-solid-red' : 'bg-darker-app'}`}>
                  {isWorking ? 'Espere...' : texts.action}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
