import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Baptism, Minister, NameColumn, SearchFilters } from '../../shared/models';
import { MainMenuLayout } from '../components/features/MainMenuLayout';
import { SacramentSearchPanel } from '../components/features/SacramentSearchPanel';
import { PersonSacramentForm, type PersonSacramentType } from '../components/features/PersonSacramentForm';
import { AnnulmentModal } from '../components/features/AnnulmentModal';
import { HistoryDialog } from '../components/features/HistoryDialog';
import { SinglePersonPrintView } from '../components/features/SinglePersonPrintView';
import { SacramentIndexPreview } from '../components/features/SacramentIndexPreview';
import { CertificatePrintPreview } from '../components/print/CertificatePrintPreview';
import { useSessionStore } from '../store/sessionStore';
import { usePermissions } from '../lib/permissions';
import { annulSacrament, saveSacrament, searchSacraments } from '../controllers/SacramentController';
import { searchPriests } from '../controllers/PriestController';
import { SacramentService } from '../services/SacramentService';
import { ParishService } from '../services/ParishService';
import { baptismPrintValues } from '../lib/printFields';

const TITLES: Record<PersonSacramentType, { page: string; search: string; index: string }> = {
  bautismo: { page: 'Bautismo', search: 'Buscar partida de bautismo', index: 'bautismo' },
  confirmacion: { page: 'Confirmación', search: 'Buscar partida de confirmación', index: 'confirmación' },
};

/** La página de bautismos o de confirmaciones: buscar, crear, editar, imprimir y anular partidas. */
export function PersonSacramentPage({ tipo }: { tipo: PersonSacramentType }) {
  const navigate = useNavigate();
  const usuarioNombre = useSessionStore((state) => state.usuarioNombre);
  const parroquiaId = useSessionStore((state) => state.parroquiaId);
  const parroquiaActivaId = useSessionStore((state) => state.parroquiaActivaId);
  const parroquiaActivaNombre = useSessionStore((state) => state.parroquiaActivaNombre);
  const token = useSessionStore((state) => state.token);
  const titles = TITLES[tipo];

  const [records, setRecords] = useState<Baptism[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState<NameColumn>('nombres');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filters, setFilters] = useState<Pick<SearchFilters, NameColumn>>({});
  // Se incrementa tras guardar o anular para volver a pedir la lista.
  const [reloadCounter, setReloadCounter] = useState(0);

  const [formState, setFormState] = useState<{ mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; record: Baptism }>({ mode: 'closed' });
  const [formError, setFormError] = useState<string | null>(null);
  const [annulmentTargetId, setAnnulmentTargetId] = useState<number | null>(null);
  const [historyTargetId, setHistoryTargetId] = useState<number | null>(null);
  const [printing, setPrinting] = useState<{ record: Baptism; logo: string | null } | null>(null);
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

      const result = await searchSacraments<Baptism>(tipo, { ...filters, orden: sortBy, direccion: sortDirection, pagina: currentPage });

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
  }, [tipo, filters, currentPage, sortBy, sortDirection, parroquiaActivaId, reloadCounter]);

  const permissions = usePermissions();
  const canWrite = permissions.canWrite;

  function canManage(recordParroquiaId: number): boolean {
    return canWrite && recordParroquiaId === parroquiaId;
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
      const record = await SacramentService.get<Baptism>(id);
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

  async function handleSaveForm(record: Baptism) {
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
    const record = await SacramentService.get<Baptism>(id);
    const { logo } = await ParishService.getLogo(record.sacramento.parroquia_id as number);
    setPrinting({ record, logo });
  }

  return (
    <MainMenuLayout
      title={titles.page}
      parroquiaActivaNombre={parroquiaActivaNombre ?? ''}
      usuarioNombre={usuarioNombre ?? ''}
      onBack={() => navigate('/dashboard')}
    >
      <SacramentSearchPanel<Baptism>
        title={titles.search}
        errorMessage={errorMessage}
        rows={records}
        columns={[
          { header: 'Nombres', render: (record) => record.persona.nombres },
          { header: 'Apellido paterno', render: (record) => record.persona.apellido_paterno },
          { header: 'Apellido materno', render: (record) => record.persona.apellido_materno },
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
        canAnnul={permissions.canAdminister}
        editLabel={permissions.onlyRequestsCorrections ? 'Pedir cambio' : 'Editar'}
        onHistory={permissions.canAdminister ? (id) => setHistoryTargetId(id) : undefined}
        onAdd={() => setFormState({ mode: 'create' })}
        onEdit={handleOpenEdit}
        onPrint={handlePrint}
        onAnnul={(id) => setAnnulmentTargetId(id)}
        onPrintIndex={() => setIsIndexOpen(true)}
      />

      {formState.mode !== 'closed' && (
        <PersonSacramentForm
          tipo={tipo}
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

      {annulmentTargetId !== null && (
        <AnnulmentModal
          onConfirm={handleConfirmAnnulment}
          onCancel={() => setAnnulmentTargetId(null)}
          isLoading={isLoading}
        />
      )}

      {printing && (
        <CertificatePrintPreview
          kind={tipo}
          values={baptismPrintValues(printing.record)}
          fullCertificate={<SinglePersonPrintView record={printing.record} logo={printing.logo} />}
          onClose={() => setPrinting(null)}
        />
      )}

      {isIndexOpen && (
        <SacramentIndexPreview
          tipo={tipo}
          sacramentName={titles.index}
          parroquiaNombre={parroquiaActivaNombre ?? ''}
          onClose={() => setIsIndexOpen(false)}
        />
      )}
    </MainMenuLayout>
  );
}
