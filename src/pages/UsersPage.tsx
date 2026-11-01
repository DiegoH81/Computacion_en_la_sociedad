import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainMenuLayout } from '../components/features/MainMenuLayout';
import { PersonSearchFilters } from '../components/features/PersonSearchFilters';
import { UserTable, type UserRow } from '../components/features/UserTable';
import { UserFormModal, type UserFormValues } from '../components/features/UserFormModal';
import { useSessionStore } from '../store/sessionStore';
import {
  searchUsers,
  createUser,
  updateUser,
  toggleUserActive,
  loadParishes,
} from '../controllers/UserController';
import type { Parish } from '../services/AuthService';

type SortField = 'nombre' | 'apellidoPaterno' | 'apellidoMaterno';

interface Filters {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
}

const NO_FILTERS: Filters = { nombre: '', apellidoPaterno: '', apellidoMaterno: '' };

export function UsersPage() {
  const navigate = useNavigate();
  const usuarioId = useSessionStore((state) => state.usuarioId);
  const usuarioNombre = useSessionStore((state) => state.usuarioNombre);
  const parroquiaActivaNombre = useSessionStore((state) => state.parroquiaActivaNombre);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [sortBy, setSortBy] = useState<SortField>('nombre');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  // Se incrementa tras guardar o deshabilitar para volver a pedir la lista.
  const [reloadCounter, setReloadCounter] = useState(0);

  const [parishes, setParishes] = useState<Parish[]>([]);
  const [parishesVersion, setParishesVersion] = useState(0);

  const [modalState, setModalState] = useState<
    { mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; user: UserRow }
  >({ mode: 'closed' });
  const [isSaving, setIsSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Una sola fuente de carga: cualquier cambio de filtros, página, orden o el
  // contador de recarga vuelve a pedir la lista. Así paginar u ordenar nunca
  // pierde los filtros activos.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setErrorMessage(null);

      const result = await searchUsers({
        nombre: filters.nombre || undefined,
        apellidoPaterno: filters.apellidoPaterno || undefined,
        apellidoMaterno: filters.apellidoMaterno || undefined,
        sortBy,
        sortDirection,
        page: currentPage,
      });

      // Si mientras tanto cambió algún filtro, esta respuesta ya está vieja.
      if (cancelled) return;

      setIsLoading(false);

      if (!result.success) {
        setErrorMessage(result.errorMessage ?? 'Error al buscar usuarios.');
        return;
      }

      setUsers(result.users ?? []);
      setTotalPages(result.totalPages ?? 1);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [filters, currentPage, sortBy, sortDirection, reloadCounter]);

  // Parroquias para el selector del formulario; se recargan tras crear una nueva.
  useEffect(() => {
    let cancelled = false;

    loadParishes().then((result) => {
      if (!cancelled && result.success) {
        setParishes(result.parishes ?? []);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [parishesVersion]);

  function handleSearch(newFilters: Filters) {
    setFilters(newFilters);
    setCurrentPage(1);
  }

  function handleClear() {
    setFilters(NO_FILTERS);
    setCurrentPage(1);
  }

  function openCreate() {
    setModalError(null);
    setModalState({ mode: 'create' });
  }

  function closeModal() {
    setModalError(null);
    setModalState({ mode: 'closed' });
  }

  async function handleSave(values: UserFormValues) {
    if (modalState.mode === 'closed') return;

    const wasCreating = modalState.mode === 'create';

    setIsSaving(true);
    setModalError(null);

    const result =
      modalState.mode === 'edit'
        ? await updateUser(modalState.user.id, values)
        : await createUser(values);

    setIsSaving(false);

    if (!result.success) {
      // El error se muestra dentro del modal, que sigue abierto con lo escrito.
      setModalError(result.errorMessage ?? 'No se pudo guardar.');
      return;
    }

    closeModal();
    setReloadCounter((count) => count + 1);
    if (wasCreating) {
      setParishesVersion((version) => version + 1);
    }
  }

  async function handleToggleActive(userId: number) {
    setErrorMessage(null);

    const result = await toggleUserActive(userId);

    if (!result.success) {
      setErrorMessage(result.errorMessage ?? 'Error al cambiar el estado.');
      return;
    }

    setReloadCounter((count) => count + 1);
  }

  return (
    <MainMenuLayout
      title="Usuarios"
      parroquiaActivaNombre={parroquiaActivaNombre ?? ''}
      usuarioNombre={usuarioNombre ?? ''}
      onBack={() => navigate('/dashboard')}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-800">Usuarios</h1>
          <button
            type="button"
            onClick={openCreate}
            className="rounded-md bg-emerald-900 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            + Agregar Usuario
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

        <UserTable
          users={users}
          currentUserId={usuarioId}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          onEdit={(userId) => {
            const user = users.find((u) => u.id === userId);
            if (user) {
              setModalError(null);
              setModalState({ mode: 'edit', user });
            }
          }}
          onToggleActive={handleToggleActive}
          isLoading={isLoading}
        />
      </div>

      {modalState.mode !== 'closed' && (
        <UserFormModal
          mode={modalState.mode}
          parishes={parishes}
          initialValues={
            modalState.mode === 'edit'
              ? {
                  nombre: modalState.user.nombre,
                  apellidoPaterno: modalState.user.apellidoPaterno,
                  apellidoMaterno: modalState.user.apellidoMaterno,
                  username: modalState.user.username,
                  parroquiaNombre: modalState.user.parroquiaNombre,
                }
              : undefined
          }
          onSave={handleSave}
          onCancel={closeModal}
          isLoading={isSaving}
          errorMessage={modalError}
        />
      )}
    </MainMenuLayout>
  );
}
