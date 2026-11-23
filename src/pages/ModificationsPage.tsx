import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Modification, ModificationKind, ModificationPage } from '../../shared/models';
import { HistoryDialog } from '../components/features/HistoryDialog';
import { MainMenuLayout } from '../components/features/MainMenuLayout';
import { PageNav } from '../components/ui/SearchPanelParts';
import { PANEL_CELL, PANEL_HEADER_CELL, PANEL_TABLE_BOX } from '../components/ui/panelStyles';
import { ApiError } from '../lib/apiClient';
import { ModificationService } from '../services/ModificationService';
import { useSessionStore } from '../store/sessionStore';

const KIND_LABELS: Record<ModificationKind, string> = {
  partidas: 'Partidas',
  ministros: 'Ministros',
  cuentas: 'Cuentas',
  pc: 'Respaldos y Excel (esta PC)',
};

/** Un punto de color por tipo, para distinguirlos de un vistazo. */
const KIND_DOTS: Record<ModificationKind, string> = {
  partidas: 'bg-darker-app',
  ministros: 'bg-solid-purple',
  cuentas: 'bg-solid-blue',
  pc: 'bg-solid-green',
};

const INPUT = 'rounded-lg bg-white px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-darker-app';
const LABEL = 'flex flex-col gap-1 text-xs font-bold text-black uppercase';

interface Filters {
  desde: string;
  hasta: string;
  usuario: string;
  tipo: ModificationKind | '';
}

const EMPTY_FILTERS: Filters = { desde: '', hasta: '', usuario: '', tipo: '' };

const formatDate = (iso: string) => new Date(iso).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });

/** Todo lo que se cambió en la parroquia, en una sola lista: para el párroco principal y el administrador general. */
export function ModificationsPage() {
  const navigate = useNavigate();
  const usuarioNombre = useSessionStore((state) => state.usuarioNombre);
  const parroquiaActivaId = useSessionStore((state) => state.parroquiaActivaId);
  const parroquiaActivaNombre = useSessionStore((state) => state.parroquiaActivaNombre);

  // Lo que se escribe en los filtros, y lo que se buscó al pulsar "Buscar".
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [currentPage, setCurrentPage] = useState(1);
  const [page, setPage] = useState<ModificationPage | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [historyId, setHistoryId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    ModificationService.list({
      desde: filters.desde || undefined,
      hasta: filters.hasta || undefined,
      usuario: filters.usuario || undefined,
      tipo: filters.tipo || undefined,
      pagina: currentPage,
      parroquia_id: parroquiaActivaId ?? undefined,
    })
      .then((result) => {
        if (cancelled) return;
        setPage(result);
        setErrorMessage(null);
      })
      .catch((error) => {
        if (!cancelled) setErrorMessage(error instanceof ApiError ? error.message : 'No se pudieron cargar las modificaciones.');
      });
    return () => {
      cancelled = true;
    };
  }, [filters, currentPage, parroquiaActivaId]);

  function search() {
    setFilters(draft);
    setCurrentPage(1);
  }

  function clear() {
    setDraft(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
    setCurrentPage(1);
  }

  function subjectCell(item: Modification) {
    if (item.sacramento_id === null) return item.sobre;
    // Una partida: abre su historial completo, con los datos que cambiaron.
    return (
      <button type="button" onClick={() => setHistoryId(item.sacramento_id)} className="text-left font-semibold text-solid-blue underline hover:opacity-80">
        {item.sobre}
      </button>
    );
  }

  return (
    <MainMenuLayout
      title="Modificaciones"
      parroquiaActivaNombre={parroquiaActivaNombre ?? ''}
      usuarioNombre={usuarioNombre ?? ''}
      onBack={() => navigate('/configuracion')}
    >
      <div className="flex flex-col gap-4">
        <h1 className="rounded-xl bg-black px-4 py-2 text-xl font-bold text-white uppercase">Modificaciones</h1>

        <form
          aria-label="Filtros de modificaciones"
          onSubmit={(event) => {
            event.preventDefault();
            search();
          }}
          className="flex flex-wrap items-end gap-3 rounded-2xl bg-lighter-green p-4"
        >
          <label className={LABEL}>
            Desde
            <input type="date" value={draft.desde} onChange={(e) => setDraft({ ...draft, desde: e.target.value })} className={INPUT} />
          </label>
          <label className={LABEL}>
            Hasta
            <input type="date" value={draft.hasta} onChange={(e) => setDraft({ ...draft, hasta: e.target.value })} className={INPUT} />
          </label>
          <label className={LABEL}>
            Usuario
            <select value={draft.usuario} onChange={(e) => setDraft({ ...draft, usuario: e.target.value })} className={INPUT}>
              <option value="">Todos</option>
              {(page?.usuarios ?? []).map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className={LABEL}>
            Tipo
            <select value={draft.tipo} onChange={(e) => setDraft({ ...draft, tipo: e.target.value as Filters['tipo'] })} className={INPUT}>
              <option value="">Todo</option>
              {(Object.keys(KIND_LABELS) as ModificationKind[]).map((kind) => (
                <option key={kind} value={kind}>
                  {KIND_LABELS[kind]}
                </option>
              ))}
            </select>
          </label>
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={clear} className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-black uppercase hover:bg-slate-100">
              Limpiar filtros
            </button>
            <button type="submit" className="rounded-lg bg-solid-blue px-4 py-2 text-sm font-bold text-white uppercase hover:opacity-90">
              Buscar
            </button>
          </div>
        </form>

        {errorMessage && (
          <p role="alert" className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-solid-red">
            {errorMessage}
          </p>
        )}

        <div className="flex flex-col gap-3 rounded-2xl bg-table-panel p-4">
          <div className={`${PANEL_TABLE_BOX} max-h-[60vh]`}>
            {page === null ? (
              <p className="p-4 text-slate-700">Cargando...</p>
            ) : page.resultados.length === 0 ? (
              <p className="p-4 text-slate-700">No hay modificaciones con esos filtros.</p>
            ) : (
              <table className="w-full border-separate border-spacing-0 text-left">
                <thead>
                  <tr>
                    <th className={`${PANEL_HEADER_CELL} w-36`}>Fecha</th>
                    <th className={PANEL_HEADER_CELL}>Usuario</th>
                    <th className={PANEL_HEADER_CELL}>Qué pasó</th>
                    <th className={PANEL_HEADER_CELL}>Sobre qué</th>
                    <th className={PANEL_HEADER_CELL}>Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {page.resultados.map((item, index) => (
                    <tr key={`${item.fecha}-${index}`} className="text-black">
                      <td className={`${PANEL_CELL} whitespace-nowrap tabular-nums`}>{formatDate(item.fecha)}</td>
                      <td className={PANEL_CELL}>{item.usuario}</td>
                      <td className={PANEL_CELL}>
                        <span className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${KIND_DOTS[item.tipo]}`} aria-hidden="true" />
                        {item.accion}
                      </td>
                      <td className={`${PANEL_CELL} break-words`}>{subjectCell(item)}</td>
                      <td className={`${PANEL_CELL} break-words text-slate-700`}>{item.detalle ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {page && <PageNav currentPage={currentPage} totalPages={page.total_paginas} onPageChange={setCurrentPage} />}
        </div>
      </div>

      {historyId !== null && <HistoryDialog sacramentoId={historyId} onClose={() => setHistoryId(null)} />}
    </MainMenuLayout>
  );
}
