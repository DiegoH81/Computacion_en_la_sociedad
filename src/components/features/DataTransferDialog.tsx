import { useState, type ReactNode } from 'react';
import { ApiError } from '../../lib/apiClient';
import { BackupService } from '../../services/BackupService';

/** Lo que se elige en la ventana; el Excel se exporta aquí mismo, lo demás abre su propia ventana. */
export type DataTransferChoice = 'exportBackup' | 'restoreBackup' | 'importLegacy';

interface DataTransferDialogProps {
  onChoose: (choice: DataTransferChoice) => void;
  onClose: () => void;
}

type IconName = 'export' | 'import' | 'lock' | 'sheet' | 'restore';
type Tone = 'teal' | 'green' | 'red' | 'blue';

// Íconos de línea simples, dibujados con el color del texto.
const ICON_PATHS: Record<IconName, ReactNode> = {
  export: (
    <>
      <path d="M12 21V9" />
      <path d="M7 14l5-5 5 5" />
      <path d="M5 3h14" />
    </>
  ),
  import: (
    <>
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M5 21h14" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  sheet: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M4 9h16M4 15h16M10 3v18" />
    </>
  ),
  restore: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </>
  ),
};

// El color va solo en el ícono: un fondo suave y el trazo del color de la acción.
const TONES: Record<Tone, string> = {
  teal: 'bg-darker-app/15 text-darker-app',
  green: 'bg-solid-green/15 text-solid-green',
  red: 'bg-solid-red/10 text-solid-red',
  blue: 'bg-solid-blue/15 text-solid-blue',
};

function Icon({ name, tone, small = false }: { name: IconName; tone: Tone; small?: boolean }) {
  const box = small ? 'h-7 w-7 rounded-md' : 'h-10 w-10 rounded-lg';
  const size = small ? 'h-4 w-4' : 'h-5 w-5';
  return (
    <span className={`grid shrink-0 place-items-center ${box} ${TONES[tone]}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" className={size} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {ICON_PATHS[name]}
      </svg>
    </span>
  );
}

interface ActionButtonProps {
  /** El nombre completo de la acción (lo que lee el lector de pantalla y buscan las pruebas). */
  action: string;
  title: string;
  description: string;
  icon: IconName;
  tone: Tone;
  disabled?: boolean;
  onClick: () => void;
}

function ActionButton({ action, title, description, icon, tone, disabled = false, onClick }: ActionButtonProps) {
  return (
    <button
      type="button"
      aria-label={action}
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-3 rounded-xl border border-slate-300 bg-white p-3 text-left transition-colors hover:border-darker-app hover:bg-lighter-green disabled:cursor-wait disabled:opacity-60"
    >
      <Icon name={icon} tone={tone} />
      <span className="flex flex-col">
        <span className="text-sm font-bold text-slate-900">{title}</span>
        <span className="text-xs text-slate-600">{description}</span>
      </span>
    </button>
  );
}

function Column({ title, icon, tone, children }: { title: string; icon: IconName; tone: Tone; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-2 rounded-xl bg-white p-3">
      <h3 className="flex items-center gap-2 border-b-2 border-lighter-green pb-2 text-sm font-bold text-slate-900 uppercase">
        <Icon name={icon} tone={tone} small />
        {title}
      </h3>
      {children}
    </section>
  );
}

/** Exportar e importar datos de la parroquia: a la izquierda lo que sale de la PC, a la derecha lo que entra. */
export function DataTransferDialog({ onChoose, onClose }: DataTransferDialogProps) {
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  async function exportExcel() {
    setIsExportingExcel(true);
    setMessage(null);
    try {
      const result = await BackupService.exportExcel();
      if (result.cancelado) return;
      const records = `${result.partidas} ${result.partidas === 1 ? 'partida' : 'partidas'}`;
      setMessage({ text: `Excel guardado: ${records}. Archivo: ${result.archivo}.`, isError: false });
    } catch (error) {
      setMessage({ text: error instanceof ApiError ? error.message : 'No se pudo guardar el Excel.', isError: true });
    } finally {
      setIsExportingExcel(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div role="dialog" aria-modal="true" aria-label="Exportar e importar" className="flex max-h-[92vh] w-full max-w-2xl flex-col gap-4 rounded-2xl bg-lighter-green p-5 shadow-2xl">
        <header className="flex items-center justify-between gap-3 rounded-xl bg-black px-5 py-2">
          <h2 className="font-bold text-white uppercase">Exportar e importar</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar exportar e importar"
            className="rounded-md px-2 text-lg font-bold text-white hover:bg-white/20"
          >
            ✕
          </button>
        </header>

        <div className="grid min-h-0 grid-cols-1 gap-3 overflow-y-auto sm:grid-cols-2">
          <Column title="Exportar" icon="export" tone="teal">
            <ActionButton
              action="Exportar respaldo"
              title="Respaldo"
              description="Con contraseña. Sirve para restaurar."
              icon="lock"
              tone="teal"
              onClick={() => onChoose('exportBackup')}
            />
            <ActionButton
              action="Exportar Excel"
              title={isExportingExcel ? 'Guardando Excel...' : 'Excel'}
              description="Para consultar. No sirve para restaurar."
              icon="sheet"
              tone="green"
              disabled={isExportingExcel}
              onClick={exportExcel}
            />
          </Column>

          <Column title="Importar" icon="import" tone="blue">
            <ActionButton
              action="Restaurar respaldo"
              title="Restaurar respaldo"
              description="Reemplaza los datos de esta PC."
              icon="restore"
              tone="red"
              onClick={() => onChoose('restoreBackup')}
            />
            <ActionButton
              action="Importar Excel del sistema anterior"
              title="Excel del sistema anterior"
              description="Agrega las partidas nuevas."
              icon="import"
              tone="blue"
              onClick={() => onChoose('importLegacy')}
            />
          </Column>
        </div>

        {message && (
          <p
            role={message.isError ? 'alert' : 'status'}
            className={`rounded-lg bg-white px-4 py-2 text-sm font-medium ${message.isError ? 'text-solid-red' : 'text-dark-app'}`}
          >
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}
