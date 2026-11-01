import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainMenuLayout } from '../components/features/MainMenuLayout';
import { PersonSearchFilters } from '../components/features/PersonSearchFilters';
import { PriestTable } from '../components/features/PriestTable';
import { PriestFormModal } from '../components/features/PriestFormModal';
import { useSessionStore } from '../store/sessionStore';
import {
  searchPriests,
  createPriest,
  updatePriest,
  togglePriestActive,
  type PriestRowUI,
} from '../controllers/PriestController';

type SortField = 'nombre' | 'apellidoPaterno' | 'apellidoMaterno';

interface Filters {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
}

export function PriestsPage() {
  const navigate = useNavigate();
  const usuarioNombre = useSessionStore((state) => state.usuarioNombre);
  const rol = useSessionStore((state) => state.rol);
  const parroquiaId = useSessionStore((state) => state.parroquiaId);
  const parroquiaActivaId = useSessionStore((state) => state.parroquiaActivaId);
  const parroquiaActivaNombre = useSessionStore((state) => state.parroquiaActivaNombre);

  const [priests, setPriests] = useState<PriestRowUI[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState<Filters>({
    nombre: '',
    apellidoPaterno: '',
    apellidoMaterno: '',
  });
  const [sortBy, setSortBy] = useState<SortField>('nombre');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [modalState, setModalState] = useState<
    | { mode: 'closed' }
    | { mode: 'create' }
    | { mode: 'edit'; priest: PriestRowUI }
  >({ mode: 'closed' });

  async function loadPriests() {
    setIsLoading(true);
    setErrorMessage(null);

    const result = await searchPriests({
      nombre: filters.nombre || undefined,
      apellidoPaterno: filters.apellidoPaterno || undefined,
      apellidoMaterno: filters.apellidoMaterno || undefined,
      sortBy,
      sortDirection,
      page: currentPage,
    });

    setIsLoading(false);

    if (!result.success) {
      setErrorMessage(result.errorMessage ?? 'Error al buscar sacerdotes.');
      return;
    }

    setPriests(result.priests ?? []);
    setTotalPages(result.totalPages ?? 1);
  }

  useEffect(() => {
    loadPriests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, sortBy, sortDirection]);

  function canManage(priestParroquiaId: number): boolean {
    if (rol === 'admin') return true;
    return parroquiaActivaId === parroquiaId && priestParroquiaId === parroquiaId;
  }

  const canAddPriest = rol === 'admin' || parroquiaActivaId === parroquiaId;

  function handleSearch(newFilters: Filters) {
    setFilters(newFilters);
    setCurrentPage(1);
    // loadPriests se dispara manualmente aquí porque newFilters aún no
    // está reflejado en el estado `filters` al momento de esta llamada.
    searchPriests({
      nombre: newFilters.nombre || undefined,
      apellidoPaterno: newFilters.apellidoPaterno || undefined,
      apellidoMaterno: newFilters.apellidoMaterno || undefined,
      sortBy,
      sortDirection,
      page: 1,
    }).then((result) => {
      if (result.success) {
        setPriests(result.priests ?? []);
        setTotalPages(result.totalPages ?? 1);
      } else {
        setErrorMessage(result.errorMessage ?? 'Error al buscar sacerdotes.');
      }
    });
  }

  function handleClear() {
    setFilters({ nombre: '', apellidoPaterno: '', apellidoMaterno: '' });
    setCurrentPage(1);
    loadPriests();
  }

  async function handleSave(values: {
    nombre: string;
    apellidoPaterno: string;
    apellidoMaterno: string;
  }) {
    setIsLoading(true);

    const result =
      modalState.mode === 'edit'
        ? await updatePriest(modalState.priest.id, values)
        : await createPriest(values);

    setIsLoading(false);

    if (!result.success) {
      setErrorMessage(result.errorMessage ?? 'Error al guardar.');
      return;
    }

    setModalState({ mode: 'closed' });
    loadPriests();
  }

  async function handleToggleActive(priestId: number) {
    const result = await togglePriestActive(priestId);
    if (!result.success) {
      setErrorMessage(result.errorMessage ?? 'Error al cambiar el estado.');
      return;
    }
    loadPriests();
  }

  return (
    <MainMenuLayout
      title="Sacerdotes"
      parroquiaActivaNombre={parroquiaActivaNombre ?? ''}
      usuarioNombre={usuarioNombre ?? ''}
      onBack={() => navigate('/dashboard')}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-800">Sacerdotes</h1>
          {canAddPriest && (
            <button
              type="button"
              onClick={() => setModalState({ mode: 'create' })}
              className="rounded-md bg-emerald-900 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              + Agregar Sacerdote
            </button>
          )}
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

        <PriestTable
          priests={priests}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          onEdit={(priestId) => {
            const priest = priests.find((p) => p.id === priestId);
            if (priest) setModalState({ mode: 'edit', priest });
          }}
          onToggleActive={handleToggleActive}
          canManage={canManage}
          isLoading={isLoading}
        />
      </div>

      {modalState.mode !== 'closed' && (
        <PriestFormModal
          mode={modalState.mode}
          initialValues={
            modalState.mode === 'edit'
              ? {
                  nombre: modalState.priest.nombre,
                  apellidoPaterno: modalState.priest.apellidoPaterno,
                  apellidoMaterno: modalState.priest.apellidoMaterno,
                }
              : undefined
          }
          onSave={handleSave}
          onCancel={() => setModalState({ mode: 'closed' })}
          isLoading={isLoading}
        />
      )}
    </MainMenuLayout>
  );
}
