import { useEffect, useState } from 'react';
import { ImportService } from '../../services/ImportService';
import { BackupDialog } from './BackupDialog';

/**
 * En el login de una PC nueva (sin usuarios), ofrece restaurar un respaldo. Lo normal es que el
 * instalador traiga el paquete inicial y la PC ya tenga datos: entonces esto no aparece.
 */
export function EmptyPcRestore() {
  const [isNeeded, setIsNeeded] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    ImportService.packageStatus()
      .then((status) => {
        if (!cancelled) setIsNeeded(status.necesita_paquete);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!isNeeded) return null;

  return (
    <div className="flex w-full flex-col gap-2 border-t border-slate-200 pt-3 text-center">
      <p className="text-sm text-slate-600">Esta PC todavía no tiene datos. Conéctese a internet e inicie sesión, o restaure un respaldo.</p>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-lg bg-darker-app px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
      >
        Restaurar respaldo
      </button>

      {isOpen && (
        <BackupDialog
          mode="restoreOnEmptyPc"
          onClose={() => setIsOpen(false)}
          onRestored={() => {
            setIsOpen(false);
            setIsNeeded(false);
          }}
        />
      )}
    </div>
  );
}
