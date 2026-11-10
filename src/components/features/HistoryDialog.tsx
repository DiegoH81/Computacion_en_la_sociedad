import { useEffect, useState } from 'react';
import type { HistoryEntry } from '../../../shared/models';
import { field_label } from '../../../shared/record_fields';
import type { HistoryEvent } from '../../../shared/sync';
import { ApiError } from '../../lib/apiClient';
import { RequestService } from '../../services/RequestService';

const EVENT_LABELS: Record<HistoryEvent, string> = {
  registrada: 'Registró la partida',
  importada: 'Importó la partida',
  editada: 'Editó la partida',
  correccion: 'Corrigió por nota marginal',
  cambio_pedido: 'Pidió un cambio',
  cambio_aprobado: 'Aprobó el cambio',
  cambio_rechazado: 'Rechazó el cambio',
  cambio_descartado: 'Descartó el cambio',
  anulada: 'Anuló la partida',
  rehabilitada: 'Rehabilitó la partida',
};

const formatDate = (iso: string) => new Date(iso).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });

interface HistoryDialogProps {
  sacramentoId: number;
  onClose: () => void;
}

/** El historial de una partida: quién hizo qué y cuándo, el más nuevo primero. Solo para administradores. */
export function HistoryDialog({ sacramentoId, onClose }: HistoryDialogProps) {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    RequestService.history(sacramentoId)
      .then((response) => {
        if (!cancelled) setEntries(response.historial);
      })
      .catch((error) => {
        if (!cancelled) setErrorMessage(error instanceof ApiError ? error.message : 'No se pudo cargar el historial.');
      });
    return () => {
      cancelled = true;
    };
  }, [sacramentoId]);

  // Una partida registrada antes de que existiera el historial no tiene su evento de inicio.
  const hasStart = entries?.some((entry) => entry.evento === 'registrada' || entry.evento === 'importada');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-label="Historial de la partida" className="flex max-h-[90vh] w-full max-w-4xl flex-col gap-3 rounded-2xl bg-app p-5 shadow-2xl">
        <header className="flex items-center justify-between gap-3 rounded-xl bg-black px-5 py-2">
          <h2 className="font-bold text-white uppercase">Historial de la partida</h2>
          <button type="button" onClick={onClose} className="rounded-md bg-solid-red px-4 py-1 text-xs font-bold text-white uppercase hover:opacity-90">
            Cerrar
          </button>
        </header>

        {errorMessage && (
          <p role="alert" className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-solid-red">
            {errorMessage}
          </p>
        )}

        {entries && (
          <div className="min-h-0 overflow-auto rounded-xl bg-white">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-table-panel text-white">
                <tr>
                  <th className="px-3 py-2 font-semibold">Fecha</th>
                  <th className="px-3 py-2 font-semibold">Quién</th>
                  <th className="px-3 py-2 font-semibold">Qué pasó</th>
                  <th className="px-3 py-2 font-semibold">Campo</th>
                  <th className="px-3 py-2 font-semibold">Antes</th>
                  <th className="px-3 py-2 font-semibold">Después</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const rows = entry.campos.length > 0 ? entry.campos : [null];
                  return rows.map((field, index) => (
                    <tr key={`${entry.id}-${index}`} className={index === 0 ? 'border-t border-slate-200 align-top' : 'align-top'}>
                      <td className="px-3 py-1.5 whitespace-nowrap text-slate-600 tabular-nums">{index === 0 ? formatDate(entry.fecha) : ''}</td>
                      <td className="px-3 py-1.5 text-slate-900">{index === 0 ? entry.usuario : ''}</td>
                      <td className="px-3 py-1.5 text-slate-900">
                        {index === 0 && (
                          <>
                            {EVENT_LABELS[entry.evento]}
                            {entry.motivo && <span className="block text-xs text-slate-600">{entry.motivo}</span>}
                          </>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-slate-700">{field ? field_label(field.parte, field.campo) : '—'}</td>
                      <td className="px-3 py-1.5 break-words text-slate-500 whitespace-pre-wrap">{field ? (field.texto_anterior ?? '(vacío)') : '—'}</td>
                      <td className="px-3 py-1.5 break-words font-semibold text-slate-900 whitespace-pre-wrap">{field ? (field.texto_nuevo ?? '(vacío)') : '—'}</td>
                    </tr>
                  ));
                })}
                {!hasStart && (
                  <tr className="border-t border-slate-200">
                    <td colSpan={6} className="px-3 py-2 text-slate-600">
                      Registrada antes de que existiera el historial.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
