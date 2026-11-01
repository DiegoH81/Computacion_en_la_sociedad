import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainMenuLayout } from '../components/features/MainMenuLayout';
import { PersonSearchFilters } from '../components/features/PersonSearchFilters';
import { BaptismTable } from '../components/features/BaptismTable';
import { BaptismForm, type BaptismFormValues } from '../components/features/BaptismForm';
import { AnnulmentModal } from '../components/features/AnnulmentModal';
import { BaptismPrintView } from '../components/features/BaptismPrintView';
import { useSessionStore } from '../store/sessionStore';
import {
  searchBaptisms,
  createBaptism,
  updateBaptism,
  annulBaptism,
  formatFechaDisplay,
  type BaptismRowUI,
} from '../controllers/BaptismController';
import { searchPriests } from '../controllers/PriestController';
import { BaptismService } from '../services/BaptismService';

type SortField = 'nombre' | 'apellidoPaterno' | 'apellidoMaterno';

interface PriestOption {
  id: number;
  nombreCompleto: string;
  parroquiaNombre: string;
}

export function BaptismsPage() {
  const navigate = useNavigate();
  const usuarioNombre = useSessionStore((state) => state.usuarioNombre);
  const rol = useSessionStore((state) => state.rol);
  const parroquiaId = useSessionStore((state) => state.parroquiaId);
  const parroquiaActivaId = useSessionStore((state) => state.parroquiaActivaId);
  const parroquiaActivaNombre = useSessionStore((state) => state.parroquiaActivaNombre);
  const token = useSessionStore((state) => state.token);

  const [baptisms, setBaptisms] = useState<BaptismRowUI[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState<SortField>('nombre');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const [formState, setFormState] = useState<
    { mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; baptismId: number }
  >({ mode: 'closed' });
  const [editingInitialValues, setEditingInitialValues] = useState<BaptismFormValues | undefined>();
  const [annulmentTargetId, setAnnulmentTargetId] = useState<number | null>(null);
  const [printData, setPrintData] = useState<Parameters<typeof BaptismPrintView>[0]['data'] | null>(
    null,
  );
  const [priestOptions, setPriestOptions] = useState<PriestOption[]>([]);
  const [isSearchingPriests, setIsSearchingPriests] = useState(false);

  async function loadBaptisms() {
    setIsLoading(true);
    setErrorMessage(null);

    const result = await searchBaptisms({ sortBy, sortDirection, page: currentPage });

    setIsLoading(false);

    if (!result.success) {
      setErrorMessage(result.errorMessage ?? 'Error al buscar partidas.');
      return;
    }

    setBaptisms(result.baptisms ?? []);
    setTotalPages(result.totalPages ?? 1);
  }

  useEffect(() => {
    loadBaptisms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, sortBy, sortDirection]);

  function canManage(baptismParroquiaId: number): boolean {
    if (rol === 'admin') return true;
    return parroquiaActivaId === parroquiaId && baptismParroquiaId === parroquiaId;
  }

  function handleSearch(filters: {
    nombre: string;
    apellidoPaterno: string;
    apellidoMaterno: string;
  }) {
    setCurrentPage(1);
    searchBaptisms({
      nombre: filters.nombre || undefined,
      apellidoPaterno: filters.apellidoPaterno || undefined,
      apellidoMaterno: filters.apellidoMaterno || undefined,
      sortBy,
      sortDirection,
      page: 1,
    }).then((result) => {
      if (result.success) {
        setBaptisms(result.baptisms ?? []);
        setTotalPages(result.totalPages ?? 1);
      } else {
        setErrorMessage(result.errorMessage ?? 'Error al buscar partidas.');
      }
    });
  }

  function handleClear() {
    setCurrentPage(1);
    loadBaptisms();
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

  async function handleOpenEdit(baptismId: number) {
    if (!token) return;
    setIsLoading(true);
    try {
      const { baptism } = await BaptismService.getById(baptismId, token);
      const b = baptism as Record<string, string | number | null>;

      setEditingInitialValues({
        fechaSacramento: String(b.fecha_sacramento ?? ''),
        numeroLibro: String(b.numero_libro ?? ''),
        numeroFolio: String(b.numero_folio ?? ''),
        numeroRegistro: String(b.numero_registro ?? ''),
        nombre: String(b.nombre ?? ''),
        apellidoPaterno: String(b.apellido_paterno ?? ''),
        apellidoMaterno: String(b.apellido_materno ?? ''),
        fechaNacimiento: String(b.fecha_nacimiento ?? ''),
        lugarNacimiento: String(b.lugar_nacimiento ?? ''),
        padreNombre: String(b.padre_nombre ?? ''),
        madreNombre: String(b.madre_nombre ?? ''),
        fechaBautizo: String(b.fecha_bautizo ?? ''),
        celebranteId: b.celebrante_id ? Number(b.celebrante_id) : null,
        padrino: String(b.padrino ?? ''),
        madrina: String(b.madrina ?? ''),
        anotaciones: String(b.anotaciones ?? ''),
      });

      setFormState({ mode: 'edit', baptismId });
    } catch {
      setErrorMessage('No se pudo cargar la partida para editar.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSaveForm(values: BaptismFormValues) {
    setIsLoading(true);

    const result =
      formState.mode === 'edit'
        ? await updateBaptism(formState.baptismId, values)
        : await createBaptism(values);

    setIsLoading(false);

    if (!result.success) {
      setErrorMessage(result.errorMessage ?? 'Error al guardar.');
      return;
    }

    setFormState({ mode: 'closed' });
    setEditingInitialValues(undefined);
    loadBaptisms();
  }

  async function handleConfirmAnnulment(motivo: string) {
    if (annulmentTargetId === null) return;
    const result = await annulBaptism(annulmentTargetId, motivo);
    if (!result.success) {
      setErrorMessage(result.errorMessage ?? 'Error al anular.');
      return;
    }
    setAnnulmentTargetId(null);
    loadBaptisms();
  }

  async function handlePrint(baptismId: number) {
    if (!token) return;
    const { baptism } = await BaptismService.getById(baptismId, token);
    const b = baptism as Record<string, string | number | null>;

    setPrintData({
      parroquiaNombre: String(b.parroquia_nombre ?? ''),
      numeroLibro: String(b.numero_libro ?? ''),
      numeroFolio: String(b.numero_folio ?? ''),
      numeroRegistro: String(b.numero_registro ?? ''),
      fechaSacramento: formatFechaDisplay(String(b.fecha_sacramento ?? '')),
      nombreCompleto: `${b.nombre} ${b.apellido_paterno} ${b.apellido_materno}`,
      fechaNacimiento: formatFechaDisplay(String(b.fecha_nacimiento ?? '')),
      lugarNacimiento: String(b.lugar_nacimiento ?? ''),
      padreNombre: String(b.padre_nombre ?? ''),
      madreNombre: String(b.madre_nombre ?? ''),
      fechaBautizo: formatFechaDisplay(String(b.fecha_bautizo ?? '')),
      // Resuelto desde el inicio (a diferencia de Matrimonio): el Worker ya
      // hace el JOIN con sacerdotes en getBaptismById.
      celebranteNombreCompleto: String(b.celebrante_nombre ?? ''),
      padrino: String(b.padrino ?? ''),
      madrina: String(b.madrina ?? ''),
      anotaciones: String(b.anotaciones ?? ''),
    });
  }

  return (
    <MainMenuLayout
      title="Bautismos"
      parroquiaActivaNombre={parroquiaActivaNombre ?? ''}
      usuarioNombre={usuarioNombre ?? ''}
      onBack={() => navigate('/dashboard')}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-800">Buscar partida Bautismo</h1>
          <button
            type="button"
            onClick={() => {
              setEditingInitialValues(undefined);
              setFormState({ mode: 'create' });
            }}
            className="rounded-md bg-emerald-900 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            + Agregar partida
          </button>
        </div>

        {errorMessage && (
          <p role="alert" className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">
            {errorMessage}
          </p>
        )}

        <PersonSearchFilters
          onSearch={handleSearch}
          onClear={handleClear}
          sortBy={sortBy}
          sortDirection={sortDirection}
          onSortChange={(field, direction) => {
            setSortBy(field as SortField);
            setSortDirection(direction);
          }}
          isLoading={isLoading}
        />

        <BaptismTable
          baptisms={baptisms}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          onEdit={handleOpenEdit}
          onPrint={handlePrint}
          onAnnul={(id) => setAnnulmentTargetId(id)}
          onPrintAllResults={() => console.log('print all placeholder')}
          canManage={canManage}
          isLoading={isLoading}
        />
      </div>

      {formState.mode !== 'closed' && (
        <BaptismForm
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
        <div className="fixed inset-0 z-50 overflow-y-auto bg-white">
          <div className="flex justify-end p-4 print:hidden">
            <button
              type="button"
              onClick={() => setPrintData(null)}
              className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600"
            >
              Volver
            </button>
          </div>
          <BaptismPrintView data={printData} />
        </div>
      )}
    </MainMenuLayout>
  );
}
