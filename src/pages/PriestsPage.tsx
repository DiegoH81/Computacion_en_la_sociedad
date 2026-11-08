import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainMenuLayout } from '../components/features/MainMenuLayout';
import { ManagementPanel, ActiveStatus } from '../components/features/ManagementPanel';
import { PriestFormModal } from '../components/features/PriestFormModal';
import type { Minister, NameColumn, SearchFilters } from '../../shared/models';
import { useSessionStore } from '../store/sessionStore';
import { usePermissions } from '../lib/permissions';
import { searchPriests, createPriest, updatePriest, togglePriestActive } from '../controllers/PriestController';

type Filters = Pick<SearchFilters, NameColumn>;

export function PriestsPage() {
  const navigate = useNavigate();
  const usuarioNombre = useSessionStore((state) => state.usuarioNombre);
  const parroquiaId = useSessionStore((state) => state.parroquiaId);
  const parroquiaActivaId = useSessionStore((state) => state.parroquiaActivaId);
  const parroquiaActivaNombre = useSessionStore((state) => state.parroquiaActivaNombre);

  const [priests, setPriests] = useState<Minister[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState<Filters>({});
  const [sortBy, setSortBy] = useState<NameColumn>('nombres');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  // Se incrementa tras guardar o deshabilitar para volver a pedir la lista.
  const [reloadCounter, setReloadCounter] = useState(0);
  const [modalState, setModalState] = useState<
    | { mode: 'closed' }
    | { mode: 'create' }
    | { mode: 'edit'; priest: Minister }
  >({ mode: 'closed' });

  // Una sola fuente de carga: cualquier cambio de filtros, página, orden, parroquia activa o el
  // contador de recarga vuelve a pedir la lista. Así paginar u ordenar no pierde los filtros activos.
  // Solo se ven los ministros de la parroquia activa.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setErrorMessage(null);

      const result = await searchPriests({
        ...filters,
        parroquia_id: parroquiaActivaId ?? undefined,
        orden: sortBy,
        direccion: sortDirection,
        pagina: currentPage,
      });

      // Si mientras tanto cambió algún filtro, esta respuesta ya está vieja.
      if (cancelled) return;

      setIsLoading(false);

      if (!result.success) {
        setErrorMessage(result.errorMessage ?? 'Error al buscar ministros.');
        return;
      }

      setPriests(result.priests ?? []);
      setTotalPages(result.totalPages ?? 1);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [filters, currentPage, sortBy, sortDirection, parroquiaActivaId, reloadCounter]);

  // Un usuario (ayudante) registra ministros; editarlos o deshabilitarlos es del párroco.
  const permissions = usePermissions();

  function canManage(priestParroquiaId: number): boolean {
    return permissions.canAdminister && priestParroquiaId === parroquiaId;
  }

  const canAddPriest = permissions.canWrite;

  function handleSearch(newFilters: Filters) {
    setFilters(newFilters);
    setCurrentPage(1);
  }

  function handleClear() {
    setFilters({});
    setCurrentPage(1);
  }

  async function handleSave(minister: Minister) {
    setIsLoading(true);
    setErrorMessage(null);

    const result = modalState.mode === 'edit' ? await updatePriest(minister) : await createPriest(minister);

    setIsLoading(false);

    if (!result.success) {
      setErrorMessage(result.errorMessage ?? 'Error al guardar.');
      return;
    }

    setModalState({ mode: 'closed' });
    setReloadCounter((count) => count + 1);
  }

  async function handleToggleActive(priestId: number) {
    const result = await togglePriestActive(priestId);
    if (!result.success) {
      setErrorMessage(result.errorMessage ?? 'Error al cambiar el estado.');
      return;
    }
    setReloadCounter((count) => count + 1);
  }

  return (
    <MainMenuLayout
      title="Ministros"
      parroquiaActivaNombre={parroquiaActivaNombre ?? ''}
      usuarioNombre={usuarioNombre ?? ''}
      onBack={() => navigate('/dashboard')}
    >
      <ManagementPanel<Minister>
        title="Buscar ministro"
        errorMessage={modalState.mode === 'closed' ? errorMessage : null}
        rows={priests}
        getRowId={(priest) => priest.id as number}
        getRowLabel={(priest) => `ministro ${priest.nombre} ${priest.apellido_paterno}`}
        columns={[
          { header: 'Título', render: (priest) => priest.titulo },
          { header: 'Nombre', render: (priest) => priest.nombre, isMain: true },
          { header: 'Apellido paterno', render: (priest) => priest.apellido_paterno },
          { header: 'Apellido materno', render: (priest) => priest.apellido_materno },
          { header: 'Estado', render: (priest) => <ActiveStatus isActive={priest.activo === 1} /> },
        ]}
        emptyText="No se encontraron ministros."
        isLoading={isLoading}
        search={{
          firstLabel: 'Nombre',
          sortBy,
          sortDirection,
          onSortChange: (field, direction) => {
            setSortBy(field);
            setSortDirection(direction);
          },
          onSearch: handleSearch,
          onClear: handleClear,
          currentPage,
          totalPages,
          onPageChange: setCurrentPage,
        }}
        onAdd={canAddPriest ? () => setModalState({ mode: 'create' }) : undefined}
        isSelectable={(priest) => canManage(priest.parroquia_id as number)}
        actions={[
          {
            label: () => 'Editar',
            color: 'bg-darker-app',
            isEnabled: () => true,
            onClick: (priest) => setModalState({ mode: 'edit', priest }),
          },
          {
            label: (priest) => (priest?.activo === 0 ? 'Habilitar' : 'Deshabilitar'),
            color: 'bg-solid-red',
            isEnabled: () => true,
            onClick: (priest) => handleToggleActive(priest.id as number),
          },
        ]}
      />

      {modalState.mode !== 'closed' && (
        <PriestFormModal
          mode={modalState.mode}
          initialValues={modalState.mode === 'edit' ? modalState.priest : undefined}
          onSave={handleSave}
          onCancel={() => {
            setErrorMessage(null);
            setModalState({ mode: 'closed' });
          }}
          isLoading={isLoading}
          errorMessage={errorMessage}
        />
      )}
    </MainMenuLayout>
  );
}
