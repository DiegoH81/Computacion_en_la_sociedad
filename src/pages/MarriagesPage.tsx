import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainMenuLayout } from '../components/features/MainMenuLayout';
import { SacramentSearchPanel, type SortField } from '../components/features/SacramentSearchPanel';
import { MarriageForm, type MarriageFormValues } from '../components/features/MarriageForm';
import { AnnulmentModal } from '../components/features/AnnulmentModal';
import { MarriagePrintView } from '../components/features/MarriagePrintView';
import { SacramentIndexPreview } from '../components/features/SacramentIndexPreview';
import { A4Page, A4PrintPreview } from '../components/print/A4PrintPreview';
import { useSessionStore } from '../store/sessionStore';
import {
  searchMarriages,
  createMarriage,
  updateMarriage,
  annulMarriage,
  formatFechaDisplay,
  type MarriageRowUI,
} from '../controllers/MarriageController';
import { searchPriests } from '../controllers/PriestController';
import { MarriageService } from '../services/MarriageService';

interface PriestOption {
  id: number;
  nombreCompleto: string;
  parroquiaNombre: string;
}

export function MarriagesPage() {
  const navigate = useNavigate();
  const usuarioNombre = useSessionStore((state) => state.usuarioNombre);
  const rol = useSessionStore((state) => state.rol);
  const parroquiaId = useSessionStore((state) => state.parroquiaId);
  const parroquiaActivaId = useSessionStore((state) => state.parroquiaActivaId);
  const parroquiaActivaNombre = useSessionStore((state) => state.parroquiaActivaNombre);
  const token = useSessionStore((state) => state.token);

  const [marriages, setMarriages] = useState<MarriageRowUI[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState<SortField>('nombre');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const [formState, setFormState] = useState<
    { mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; marriageId: number }
  >({ mode: 'closed' });
  const [editingInitialValues, setEditingInitialValues] = useState<MarriageFormValues | undefined>();
  const [annulmentTargetId, setAnnulmentTargetId] = useState<number | null>(null);
  const [printData, setPrintData] = useState<Parameters<typeof MarriagePrintView>[0]['data'] | null>(
    null,
  );
  const [isIndexOpen, setIsIndexOpen] = useState(false);
  const [priestOptions, setPriestOptions] = useState<PriestOption[]>([]);
  const [isSearchingPriests, setIsSearchingPriests] = useState(false);

  async function loadMarriages() {
    setIsLoading(true);
    setErrorMessage(null);

    const result = await searchMarriages({ sortBy, sortDirection, page: currentPage });

    setIsLoading(false);

    if (!result.success) {
      setErrorMessage(result.errorMessage ?? 'Error al buscar partidas.');
      return;
    }

    setMarriages(result.marriages ?? []);
    setTotalPages(result.totalPages ?? 1);
  }

  useEffect(() => {
    loadMarriages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, sortBy, sortDirection]);

  const canWrite = rol === 'admin' || parroquiaActivaId === parroquiaId;

  function canManage(marriageParroquiaId: number): boolean {
    if (rol === 'admin') return true;
    return parroquiaActivaId === parroquiaId && marriageParroquiaId === parroquiaId;
  }

  function handleSearch(filters: {
    nombre: string;
    apellidoPaterno: string;
    apellidoMaterno: string;
  }) {
    setCurrentPage(1);
    searchMarriages({
      nombre: filters.nombre || undefined,
      apellidoPaterno: filters.apellidoPaterno || undefined,
      apellidoMaterno: filters.apellidoMaterno || undefined,
      sortBy,
      sortDirection,
      page: 1,
    }).then((result) => {
      if (result.success) {
        setMarriages(result.marriages ?? []);
        setTotalPages(result.totalPages ?? 1);
      } else {
        setErrorMessage(result.errorMessage ?? 'Error al buscar partidas.');
      }
    });
  }

  function handleClear() {
    setCurrentPage(1);
    loadMarriages();
  }

  async function handleSearchPriest(query: string) {
    if (!token) return;
    setIsSearchingPriests(true);
    const result = await searchPriests({
      nombre: query,
      sortBy: 'nombre',
      sortDirection: 'asc',
      page: 1,
    });
    setIsSearchingPriests(false);

    if (result.success) {
      setPriestOptions(
        (result.priests ?? []).map((p) => ({
          id: p.id,
          nombreCompleto: `${p.nombre} ${p.apellidoPaterno} ${p.apellidoMaterno}`,
          parroquiaNombre: p.parroquiaNombre,
        })),
      );
    }
  }

  async function handleOpenEdit(marriageId: number) {
    if (!token) return;
    setIsLoading(true);
    try {
      const { marriage } = await MarriageService.getById(marriageId, token);
      const m = marriage as Record<string, string | number | null>;

      setEditingInitialValues({
        fechaSacramento: String(m.fecha_sacramento ?? ''),
        numeroLibro: String(m.numero_libro ?? ''),
        numeroFolio: String(m.numero_folio ?? ''),
        numeroRegistro: String(m.numero_registro ?? ''),
        esposo: {
          nombre: String(m.esposo_nombre ?? ''),
          apellidoPaterno: String(m.esposo_apellido_paterno ?? ''),
          apellidoMaterno: String(m.esposo_apellido_materno ?? ''),
          lugarNacimiento: String(m.esposo_lugar_nacimiento ?? ''),
          fechaNacimiento: String(m.esposo_fecha_nacimiento ?? ''),
          parroquiaBautismo: String(m.esposo_parroquia_bautismo ?? ''),
          fechaBautismo: String(m.esposo_fecha_bautismo ?? ''),
          padreNombre: String(m.esposo_padre_nombre ?? ''),
          padreApellido: String(m.esposo_padre_apellido ?? ''),
          padreDni: String(m.esposo_padre_dni ?? ''),
          madreNombre: String(m.esposo_madre_nombre ?? ''),
          madreApellido: String(m.esposo_madre_apellido ?? ''),
          madreDni: String(m.esposo_madre_dni ?? ''),
        },
        esposa: {
          nombre: String(m.esposa_nombre ?? ''),
          apellidoPaterno: String(m.esposa_apellido_paterno ?? ''),
          apellidoMaterno: String(m.esposa_apellido_materno ?? ''),
          lugarNacimiento: String(m.esposa_lugar_nacimiento ?? ''),
          fechaNacimiento: String(m.esposa_fecha_nacimiento ?? ''),
          parroquiaBautismo: String(m.esposa_parroquia_bautismo ?? ''),
          fechaBautismo: String(m.esposa_fecha_bautismo ?? ''),
          padreNombre: String(m.esposa_padre_nombre ?? ''),
          padreApellido: String(m.esposa_padre_apellido ?? ''),
          padreDni: String(m.esposa_padre_dni ?? ''),
          madreNombre: String(m.esposa_madre_nombre ?? ''),
          madreApellido: String(m.esposa_madre_apellido ?? ''),
          madreDni: String(m.esposa_madre_dni ?? ''),
        },
        fechaMatrimonio: String(m.fecha_matrimonio ?? ''),
        celebranteId: m.celebrante_id ? Number(m.celebrante_id) : null,
        lugarMatrimonio: String(m.lugar_matrimonio ?? ''),
        testigo1: String(m.testigo_1 ?? ''),
        testigo2: String(m.testigo_2 ?? ''),
        testigo3: String(m.testigo_3 ?? ''),
        testigo4: String(m.testigo_4 ?? ''),
        notasMarginales: String(m.notas_marginales ?? ''),
      });

      setFormState({ mode: 'edit', marriageId });
    } catch {
      setErrorMessage('No se pudo cargar la partida para editar.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSaveForm(values: MarriageFormValues) {
    setIsLoading(true);

    const result =
      formState.mode === 'edit'
        ? await updateMarriage(formState.marriageId, values)
        : await createMarriage(values);

    setIsLoading(false);

    if (!result.success) {
      setErrorMessage(result.errorMessage ?? 'Error al guardar.');
      return;
    }

    setFormState({ mode: 'closed' });
    setEditingInitialValues(undefined);
    loadMarriages();
  }

  async function handleConfirmAnnulment(motivo: string) {
    if (annulmentTargetId === null) return;
    const result = await annulMarriage(annulmentTargetId, motivo);
    if (!result.success) {
      setErrorMessage(result.errorMessage ?? 'Error al anular.');
      return;
    }
    setAnnulmentTargetId(null);
    loadMarriages();
  }

  async function handlePrint(marriageId: number) {
    if (!token) return;
    const { marriage } = await MarriageService.getById(marriageId, token);
    const m = marriage as Record<string, string | number | null>;

    setPrintData({
      parroquiaNombre: String(m.parroquia_nombre ?? ''),
      numeroLibro: String(m.numero_libro ?? ''),
      numeroFolio: String(m.numero_folio ?? ''),
      numeroRegistro: String(m.numero_registro ?? ''),
      fechaSacramento: formatFechaDisplay(String(m.fecha_sacramento ?? '')),
      esposoNombreCompleto: `${m.esposo_nombre} ${m.esposo_apellido_paterno} ${m.esposo_apellido_materno}`,
      esposaNombreCompleto: `${m.esposa_nombre} ${m.esposa_apellido_paterno} ${m.esposa_apellido_materno}`,
      fechaMatrimonio: formatFechaDisplay(String(m.fecha_matrimonio ?? '')),
      celebranteNombreCompleto: '', // requiere JOIN adicional con sacerdotes, pendiente de refinar
      lugarMatrimonio: String(m.lugar_matrimonio ?? ''),
      testigos: [
        String(m.testigo_1 ?? ''),
        String(m.testigo_2 ?? ''),
        String(m.testigo_3 ?? ''),
        String(m.testigo_4 ?? ''),
      ],
      notasMarginales: String(m.notas_marginales ?? ''),
    });
  }

  return (
    <MainMenuLayout
      title="Matrimonio"
      parroquiaActivaNombre={parroquiaActivaNombre ?? ''}
      usuarioNombre={usuarioNombre ?? ''}
      onBack={() => navigate('/dashboard')}
    >
      <SacramentSearchPanel<MarriageRowUI>
        title="Buscar partida de matrimonio"
        errorMessage={errorMessage}
        rows={marriages}
        columns={[
          { header: 'Esposo', render: (row) => row.esposoNombreCompleto },
          { header: 'Esposa', render: (row) => row.esposaNombreCompleto },
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
        onAdd={() => {
          setEditingInitialValues(undefined);
          setFormState({ mode: 'create' });
        }}
        onEdit={handleOpenEdit}
        onPrint={handlePrint}
        onAnnul={(id) => setAnnulmentTargetId(id)}
        onPrintIndex={() => setIsIndexOpen(true)}
      />

      {formState.mode !== 'closed' && (
        <MarriageForm
          mode={formState.mode}
          initialValues={editingInitialValues}
          onSave={handleSaveForm}
          onCancel={() => {
            setFormState({ mode: 'closed' });
            setEditingInitialValues(undefined);
          }}
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

      {printData && (
        <A4PrintPreview
          title="Imprimir certificado"
          onClose={() => setPrintData(null)}
          pages={[
            <A4Page key="certificado">
              <MarriagePrintView data={printData} />
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
