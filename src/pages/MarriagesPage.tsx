import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Marriage, Minister, NameColumn, Person, SearchFilters } from '../../shared/models';
import { MainMenuLayout } from '../components/features/MainMenuLayout';
import { SacramentSearchPanel } from '../components/features/SacramentSearchPanel';
import { MarriageForm } from '../components/features/MarriageForm';
import { AnnulmentModal } from '../components/features/AnnulmentModal';
import { MarriagePrintView } from '../components/features/MarriagePrintView';
import { SacramentIndexPreview } from '../components/features/SacramentIndexPreview';
import { A4Page, A4PrintPreview } from '../components/print/A4PrintPreview';
import { useSessionStore } from '../store/sessionStore';
import { annulSacrament, saveSacrament, searchSacraments } from '../controllers/SacramentController';
import { searchPriests } from '../controllers/PriestController';
import { SacramentService } from '../services/SacramentService';
import { ParishService } from '../services/ParishService';

const personName = (person: Person) => `${person.nombres} ${person.apellido_paterno} ${person.apellido_materno}`;

/** La página de matrimonios: buscar, crear, editar, imprimir y anular partidas. */
export function MarriagesPage() {
  const navigate = useNavigate();
  const usuarioNombre = useSessionStore((state) => state.usuarioNombre);
  const rol = useSessionStore((state) => state.rol);
  const parroquiaId = useSessionStore((state) => state.parroquiaId);
  const parroquiaActivaId = useSessionStore((state) => state.parroquiaActivaId);
  const parroquiaActivaNombre = useSessionStore((state) => state.parroquiaActivaNombre);
  const token = useSessionStore((state) => state.token);

  const [records, setRecords] = useState<Marriage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState<NameColumn>('nombres');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filters, setFilters] = useState<Pick<SearchFilters, NameColumn>>({});
  // Se incrementa tras guardar o anular para volver a pedir la lista.
  const [reloadCounter, setReloadCounter] = useState(0);

  const [formState, setFormState] = useState<{ mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; record: Marriage }>({ mode: 'closed' });
  const [formError, setFormError] = useState<string | null>(null);
  const [annulmentTargetId, setAnnulmentTargetId] = useState<number | null>(null);
  const [printing, setPrinting] = useState<{ record: Marriage; logo: string | null } | null>(null);
  const [isIndexOpen, setIsIndexOpen] = useState(false);
  const [priestOptions, setPriestOptions] = useState<Minister[]>([]);
  const [isSearchingPriests, setIsSearchingPriests] = useState(false);

  // Una sola fuente de carga: cualquier cambio de filtros, página, orden o el contador de recarga
  // vuelve a pedir la lista. Así paginar u ordenar no pierde los filtros activos.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setErrorMessage(null);

      const result = await searchSacraments<Marriage>('matrimonio', { ...filters, orden: sortBy, direccion: sortDirection, pagina: currentPage });

      // Si mientras tanto cambió algún filtro, esta respuesta ya está vieja.
      if (cancelled) return;

      setIsLoading(false);

      if (!result.success || !result.page) {
        setErrorMessage(result.errorMessage ?? 'Error al buscar partidas.');
        return;
      }

      setRecords(result.page.resultados);
      setTotalPages(result.page.total_paginas);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [filters, currentPage, sortBy, sortDirection, parroquiaActivaId, reloadCounter]);

  const canWrite = rol === 'admin' || parroquiaActivaId === parroquiaId;

  function canManage(recordParroquiaId: number): boolean {
    if (rol === 'admin') return true;
    return parroquiaActivaId === parroquiaId && recordParroquiaId === parroquiaId;
  }

  function handleSearch(newFilters: Pick<SearchFilters, NameColumn>) {
    setFilters(newFilters);
    setCurrentPage(1);
  }

  function handleClear() {
    setFilters({});
    setCurrentPage(1);
  }

  async function handleSearchPriest(query: string) {
    if (!token) return;
    setIsSearchingPriests(true);
    // El celebrante es de la parroquia de la partida: la que se edita o la que se está viendo.
    const parroquia_id = formState.mode === 'edit' ? formState.record.sacramento.parroquia_id : (parroquiaActivaId ?? undefined);
    const result = await searchPriests({ nombres: query, orden: 'nombres', direccion: 'asc', pagina: 1, parroquia_id });
    setIsSearchingPriests(false);

    if (result.success) setPriestOptions(result.priests ?? []);
  }

  async function handleOpenEdit(id: number) {
    if (!token) return;
    setIsLoading(true);
    try {
      const record = await SacramentService.get<Marriage>(id);
      setPriestOptions(record.sacramento.ministro ? [record.sacramento.ministro] : []);
      setFormState({ mode: 'edit', record });
    } catch {
      setErrorMessage('No se pudo cargar la partida para editar.');
    } finally {
      setIsLoading(false);
    }
  }

  function closeForm() {
    setFormState({ mode: 'closed' });
    setFormError(null);
  }

  async function handleSaveForm(record: Marriage) {
    setIsLoading(true);
    setFormError(null);

    const result = await saveSacrament(record);

    setIsLoading(false);

    if (!result.success) {
      setFormError(result.errorMessage ?? 'Error al guardar.');
      return;
    }

    closeForm();
    setReloadCounter((count) => count + 1);
  }

  async function handleConfirmAnnulment(motivo: string) {
    if (annulmentTargetId === null) return;
    const result = await annulSacrament(annulmentTargetId, motivo);
    if (!result.success) {
      setErrorMessage(result.errorMessage ?? 'Error al anular.');
      return;
    }
    setAnnulmentTargetId(null);
    setReloadCounter((count) => count + 1);
  }

  async function handlePrint(id: number) {
    if (!token) return;
    const record = await SacramentService.get<Marriage>(id);
    const { logo } = await ParishService.getLogo(record.sacramento.parroquia_id as number);
    setPrinting({ record, logo });
  }

  return (
    <MainMenuLayout
      title="Matrimonio"
      parroquiaActivaNombre={parroquiaActivaNombre ?? ''}
      usuarioNombre={usuarioNombre ?? ''}
      onBack={() => navigate('/dashboard')}
    >
      <SacramentSearchPanel<Marriage>
        title="Buscar partida de matrimonio"
        errorMessage={errorMessage}
        rows={records}
        columns={[
          { header: 'Esposo', render: (record) => personName(record.conyuge_1) },
          { header: 'Esposa', render: (record) => personName(record.conyuge_2) },
        ]}
        isLoading={isLoading}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        sortBy={sortBy}
        sortDirection={sortDirection}
        onSortChange={(field, direction) => {
          setSortBy(field);
          setSortDirection(direction);
        }}
        onSearch={handleSearch}
        onClear={handleClear}
        canWrite={canWrite}
        canManage={canManage}
        onAdd={() => setFormState({ mode: 'create' })}
        onEdit={handleOpenEdit}
        onPrint={handlePrint}
        onAnnul={(id) => setAnnulmentTargetId(id)}
        onPrintIndex={() => setIsIndexOpen(true)}
      />

      {formState.mode !== 'closed' && (
        <MarriageForm
          initialRecord={formState.mode === 'edit' ? formState.record : undefined}
          parroquiaNombre={formState.mode === 'edit' ? (formState.record.sacramento.parroquia?.nombre ?? '') : (parroquiaActivaNombre ?? '')}
          errorMessage={formError}
          onSave={handleSaveForm}
          onCancel={closeForm}
          isLoading={isLoading}
          priestOptions={priestOptions}
          onSearchPriest={handleSearchPriest}
          isSearchingPriests={isSearchingPriests}
        />
      )}

      {annulmentTargetId !== null && (
        <AnnulmentModal
          onConfirm={handleConfirmAnnulment}
          onCancel={() => setAnnulmentTargetId(null)}
          isLoading={isLoading}
        />
      )}

      {printing && (
        <A4PrintPreview
          title="Imprimir constancia"
          onClose={() => setPrinting(null)}
          pages={[
            <A4Page key="certificado">
              <MarriagePrintView record={printing.record} logo={printing.logo} />
            </A4Page>,
          ]}
        />
      )}

      {isIndexOpen && (
        <SacramentIndexPreview
          tipo="matrimonio"
          sacramentName="matrimonio"
          parroquiaNombre={parroquiaActivaNombre ?? ''}
          onClose={() => setIsIndexOpen(false)}
        />
      )}
    </MainMenuLayout>
  );
}
