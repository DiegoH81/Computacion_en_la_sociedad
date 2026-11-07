import { useEffect, useState } from 'react';
import { ApiError } from '../../lib/apiClient';
import { ImportService } from '../../services/ImportService';

/**
 * En una PC nueva (sin usuarios), ofrece cargar el paquete inicial: así se puede entrar sin internet
 * desde el primer día. Si el instalador ya traía el paquete, la PC lo cargó sola y esto no aparece.
 */
export function InitialPackageLoader() {
  const [isNeeded, setIsNeeded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

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

  async function handleLoad() {
    setIsLoading(true);
    setMessage(null);
    try {
      const result = await ImportService.importPackage();
      if (result.cancelado) return;
      setIsNeeded(false);
      setMessage({ text: `Listo: se cargaron ${result.usuarios} usuarios y ${result.partidas} partidas. Ya puede iniciar sesión.`, isError: false });
    } catch (error) {
      setMessage({ text: error instanceof ApiError ? error.message : 'No se pudo cargar el paquete inicial.', isError: true });
    } finally {
      setIsLoading(false);
    }
  }

  if (!isNeeded && !message) return null;

  return (
    <div className="flex w-full flex-col gap-2 border-t border-slate-200 pt-3 text-center">
      {isNeeded && (
        <>
          <p className="text-sm text-slate-600">Esta PC todavía no tiene datos. Conéctese a internet e inicie sesión, o cargue el archivo de datos que le entregó el administrador.</p>
          <button
            type="button"
            onClick={handleLoad}
            disabled={isLoading}
            className="rounded-lg bg-darker-app px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {isLoading ? 'Cargando...' : 'Cargar archivo de datos'}
          </button>
        </>
      )}
      {message && (
        <p role={message.isError ? 'alert' : 'status'} className={`text-sm font-medium ${message.isError ? 'text-solid-red' : 'text-dark-app'}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
