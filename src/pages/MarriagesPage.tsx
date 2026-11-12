import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Marriage, Minister, NameColumn, Person } from '../../shared/models';
import { MainMenuLayout } from '../components/features/MainMenuLayout';
import { SacramentSearchPanel } from '../components/features/SacramentSearchPanel';
import { MarriageForm } from '../components/features/MarriageForm';
import { AnnulmentModal } from '../components/features/AnnulmentModal';
import type { SacramentSearchValues } from '../components/features/SacramentSearchForm';
import { HistoryDialog } from '../components/features/HistoryDialog';
import { MarriagePrintView } from '../components/features/MarriagePrintView';
import { SacramentIndexPreview } from '../components/features/SacramentIndexPreview';
import { CertificatePrintPreview } from '../components/print/CertificatePrintPreview';
import { useSessionStore } from '../store/sessionStore';
import { usePermissions } from '../lib/permissions';
import { annulSacrament, restoreSacrament, saveSacrament, searchSacraments } from '../controllers/SacramentController';
import { searchPriests } from '../controllers/PriestController';
import { SacramentService } from '../services/SacramentService';
import { ParishService } from '../services/ParishService';
import { marriagePrintValues } from '../lib/printFields';

const personName = (person: Person) => `${person.nombres} ${person.apellido_paterno} ${person.apellido_materno}`;

export function MarriagesPage() {
  const navigate = useNavigate();
  const usuarioNombre = useSessionStore((state) => state.usuarioNombre);
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
  const [filters, setFilters] = useState<SacramentSearchValues>({});
  const [reloadCounter, setReloadCounter] = useState(0);

  const [formState, setFormState] = useState<{ mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; record: Marriage }>({ mode: 'closed' });
  const [formError, setFormError] = useState<string | null>(null);
  const [annulment, setAnnulment] = useState<{ id: number; mode: 'anular' | 'rehabilitar' } | null>(null);
  const [historyTargetId, setHistoryTargetId] = useState<number | null>(null);
  const [printing, setPrinting] = useState<{ record: Marriage; logo: string | null } | null>(null);
  const [isIndexOpen, setIsIndexOpen] = useState(false);
  const [priestOptions, setPriestOptions] = useState<Minister[]>([]);
  const [isSearchingPriests, setIsSearchingPriests] = useState(false);
  const lastPriestSearch = useRef(0);

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

  const permissions = usePermissions();
  const canWrite = permissions.canWrite;

  function canManage(recordParroquiaId: number): boolean {
    return canWrite && recordParroquiaId === parroquiaId;
  }

  function handleSearch(newFilters: SacramentSearchValues) {
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
    const parroquia_id = formState.mode === 'edit' ? formState.record.sacramento.parroquia_id : (parroquiaActivaId ?? undefined);
    const searchId = ++lastPriestSearch.current;
    const result = await searchPriests({ texto: query, orden: 'nombres', direccion: 'asc', pagina: 1, parroquia_id });
    if (searchId !== lastPriestSearch.current) return;
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

  // Con thenPrint, después de guardar se abre la impresión de la partida ya guardada (como el botón Imprimir).
  async function handleSaveForm(record: Marriage, thenPrint: boolean) {
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

    if (thenPrint && result.id !== undefined) await handlePrint(result.id);
  }

  async function handleConfirmAnnulment(motivo: string) {
    if (annulment === null) return;
    const result = annulment.mode === 'anular' ? await annulSacrament(annulment.id, motivo) : await restoreSacrament(annulment.id, motivo);
    if (!result.success) {
      setErrorMessage(result.errorMessage ?? (annulment.mode === 'anular' ? 'Error al anular.' : 'Error al rehabilitar.'));
      return;
    }
    setAnnulment(null);
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
        godparentLabel={'Testigo'}
        onClear={handleClear}
        canWrite={canWrite}
        canManage={canManage}
        canAnnul={permissions.canAdminister}
        editLabel={permissions.onlyRequestsCorrections ? 'Pedir cambio' : 'Editar'}
        onHistory={permissions.canAdminister ? (id) => setHistoryTargetId(id) : undefined}
        onAdd={() => setFormState({ mode: 'create' })}
        onEdit={handleOpenEdit}
        onPrint={handlePrint}
        onAnnul={(id) => setAnnulment({ id, mode: 'anular' })}
        onRestore={(id) => setAnnulment({ id, mode: 'rehabilitar' })}
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
          onlyCorrections={permissions.onlyRequestsCorrections}
        />
      )}

      {historyTargetId !== null && <HistoryDialog sacramentoId={historyTargetId} onClose={() => setHistoryTargetId(null)} />}

      {annulment !== null && (
        <AnnulmentModal
          mode={annulment.mode}
          onConfirm={handleConfirmAnnulment}
          onCancel={() => setAnnulment(null)}
          isLoading={isLoading}
        />
      )}

      {printing && (
        <CertificatePrintPreview
          kind="matrimonio"
          values={marriagePrintValues(printing.record)}
          fullCertificate={<MarriagePrintView record={printing.record} logo={printing.logo} />}
          onClose={() => setPrinting(null)}
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
