import { useState } from 'react';
import { ApiError } from '../../lib/apiClient';
import { ImportService, type ImportPreview } from '../../services/ImportService';

const TYPE_LABELS = { bautismo: 'Bautismos', confirmacion: 'Confirmaciones', matrimonio: 'Matrimonios' } as const;
const TYPE_SINGULAR = { bautismo: 'Bautismo', confirmacion: 'Confirmación', matrimonio: 'Matrimonio' } as const;

const BUTTON = 'rounded-md px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50';

interface LegacyImportDialogProps {
  parroquiaNombre: string;
  onClose: () => void;
}

/**
 * Importar el Excel del sistema anterior: primero se elige el archivo y se muestra qué partidas son
 * nuevas y cuáles ya están (esas no se cargan). Recién al confirmar se guardan las nuevas.
 */
export function LegacyImportDialog({ parroquiaNombre, onClose }: LegacyImportDialogProps) {
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<{ importadas: number; omitidas: number } | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function run<T>(action: () => Promise<T>): Promise<T | null> {
    setIsWorking(true);
    setErrorMessage(null);
    try {
      return await action();
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Ocurrió un error inesperado.');
      return null;
    } finally {
      setIsWorking(false);
    }
  }

  async function chooseFile() {
    const response = await run(() => ImportService.previewLegacyExcel());
    if (response && !response.cancelado) {
      setPreview(response);
      setResult(null);
    }
  }

  async function confirm() {
    if (!preview) return;
    const response = await run(() => ImportService.confirmLegacyExcel(preview.token));
    if (response) {
      setResult(response);
      setPreview(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div role="dialog" aria-modal="true" aria-label="Importar Excel del sistema anterior" className="flex max-h-[90vh] w-full max-w-2xl flex-col gap-4 rounded-lg bg-white p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-slate-800">Importar Excel del sistema anterior</h2>

        <p className="text-sm text-slate-600">
          Las partidas se cargan en <strong>{parroquiaNombre}</strong>. Antes de guardar se revisa cuáles ya están en el
          sistema (mismo tipo, libro, folio y número): esas no se vuelven a cargar.
        </p>

        {errorMessage && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-solid-red">
            {errorMessage}
          </p>
        )}

        {result && (
          <p role="status" className="rounded-md bg-lighter-green px-3 py-2 text-sm font-medium text-dark-app">
            Se importaron {result.importadas} partidas.
            {result.omitidas > 0 && ` ${result.omitidas} ya estaban en el sistema y no se cargaron.`}
            {' '}Se subirán al servidor en la próxima sincronización.
          </p>
        )}

        {preview && (
          <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
            <p className="text-sm text-slate-800">
              <strong>{preview.archivo}</strong>: {preview.total} partidas leídas.
              {preview.codigos_parroquia.length > 0 && ` Código de parroquia en el archivo: ${preview.codigos_parroquia.join(', ')}.`}
            </p>

            <div className="rounded-md bg-lighter-green px-3 py-2 text-sm text-dark-app">
              <p className="font-semibold">Nuevas, se van a importar: {preview.nuevas}</p>
              <ul className="ml-4 list-disc">
                {(Object.keys(TYPE_LABELS) as (keyof typeof TYPE_LABELS)[]).map((type) => (
                  <li key={type}>
                    {TYPE_LABELS[type]}: {preview.por_tipo[type]}
                  </li>
                ))}
              </ul>
            </div>

            {preview.existentes.length > 0 && (
              <div role="status" className="rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-900">
                <p className="font-semibold">Ya están en el sistema, no se importan: {preview.existentes.length}</p>
                <ul className="mt-1 max-h-40 overflow-y-auto">
                  {preview.existentes.map((item) => (
                    <li key={`${item.fila}`}>
                      Fila {item.fila}: {TYPE_SINGULAR[item.tipo]}, libro {item.libro}, folio {item.folio}, n.° {item.numero} — {item.nombre}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {preview.errores.length > 0 && (
              <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-solid-red">
                <p className="font-semibold">Filas que no se pudieron leer: {preview.errores.length}</p>
                <ul className="mt-1 max-h-32 overflow-y-auto">
                  {preview.errores.map((item) => (
                    <li key={item.fila}>
                      Fila {item.fila}: {item.motivo}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={isWorking} className="rounded-md bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300">
            Cerrar
          </button>
          <button type="button" onClick={chooseFile} disabled={isWorking} className={`${BUTTON} bg-darker-app`}>
            {isWorking && !preview ? 'Leyendo...' : preview ? 'Elegir otro archivo' : 'Elegir archivo'}
          </button>
          {preview && (
            <button type="button" onClick={confirm} disabled={isWorking || preview.nuevas === 0} className={`${BUTTON} bg-solid-green`}>
              {isWorking ? 'Importando...' : `Importar ${preview.nuevas} partidas`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
