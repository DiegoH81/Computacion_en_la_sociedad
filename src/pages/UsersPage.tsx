import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainMenuLayout } from '../components/features/MainMenuLayout';
import { ManagementPanel, RowBadge, ActiveStatus } from '../components/features/ManagementPanel';
import type { NameColumn, SearchFilters, User } from '../../shared/models';
import { UserFormModal } from '../components/features/UserFormModal';
import { ConfirmActionDialog } from '../components/ui/ConfirmActionDialog';
import { useSessionStore } from '../store/sessionStore';
import {
  searchUsers,
  createUser,
  updateUser,
  toggleUserActive,
  loadParishes,
  loadIsPrincipal,
  makePrincipal,
} from '../controllers/UserController';
import type { Parish } from '../services/AuthService';

type Filters = Pick<SearchFilters, NameColumn>;

export function UsersPage() {
  const navigate = useNavigate();
  const usuarioId = useSessionStore((state) => state.usuarioId);
  const usuarioNombre = useSessionStore((state) => state.usuarioNombre);
  const parroquiaActivaNombre = useSessionStore((state) => state.parroquiaActivaNombre);

  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState<Filters>({});
  // null es "todas las parroquias" (incluye a los administradores, que no tienen parroquia).
  const [parishFilter, setParishFilter] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<NameColumn>('nombres');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  // Se incrementa tras guardar o deshabilitar para volver a pedir la lista.
  const [reloadCounter, setReloadCounter] = useState(0);

  // Si esta cuenta es el administrador principal. Se vuelve a preguntar tras cada cambio.
  const [isPrincipal, setIsPrincipal] = useState(false);
  // El admin al que se le pasaría la marca, mientras se pide confirmar.
  const [newPrincipal, setNewPrincipal] = useState<User | null>(null);

  const [parishes, setParishes] = useState<Parish[]>([]);
  const [parishesVersion, setParishesVersion] = useState(0);

  const [modalState, setModalState] = useState<
    { mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; user: User }
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
        nombres: filters.nombres || undefined,
        apellido_paterno: filters.apellido_paterno || undefined,
        apellido_materno: filters.apellido_materno || undefined,
        parroquia_id: parishFilter ?? undefined,
        orden: sortBy,
        direccion: sortDirection,
        pagina: currentPage,
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
  }, [filters, parishFilter, currentPage, sortBy, sortDirection, reloadCounter]);

  useEffect(() => {
    let cancelled = false;

    loadIsPrincipal().then((principal) => {
      if (!cancelled) setIsPrincipal(principal);
    });

    return () => {
      cancelled = true;
    };
  }, [reloadCounter]);

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
    setFilters({});
    setParishFilter(null);
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

  async function handleSave(user: User, confirmPassword: string) {
    if (modalState.mode === 'closed') return;

    const wasCreating = modalState.mode === 'create';

    setIsSaving(true);
    setModalError(null);

    const result =
      modalState.mode === 'edit'
        ? await updateUser(user, confirmPassword)
        : await createUser(user, confirmPassword);

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

  async function handleMakePrincipal() {
    if (!newPrincipal) return;

    setErrorMessage(null);
    const result = await makePrincipal(newPrincipal.id as number);
    setNewPrincipal(null);

    if (!result.success) {
      setErrorMessage(result.errorMessage ?? 'No se pudo pasar la marca de principal.');
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
      <ManagementPanel<User>
        title="Buscar usuario"
        errorMessage={errorMessage}
        rows={users}
        getRowId={(user) => user.id as number}
        getRowLabel={(user) => `usuario ${user.username}`}
        columns={[
          {
            header: 'Usuario',
            isMain: true,
            render: (user) => (
              <>
                <span className="normal-case">{user.username}</span>
                {user.principal === 1 && <RowBadge color="bg-amber-600">Principal</RowBadge>}
              </>
            ),
          },
          { header: 'Nombre', render: (user) => user.nombre },
          { header: 'Apellido paterno', render: (user) => user.apellido_paterno },
          { header: 'Apellido materno', render: (user) => user.apellido_materno },
          // Esta pantalla solo la ve un administrador, y el Worker revisa el rol en cada petición:
          // mostrarlo no le da a nadie un permiso que no tenga.
          { header: 'Tipo', render: (user) => (user.rol === 'admin' ? 'Administrador' : 'Usuario de parroquia') },
          // Un administrador no es de ninguna parroquia.
          { header: 'Parroquia', render: (user) => (user.rol === 'admin' ? '—' : (user.parroquia_nombre ?? '—')) },
          { header: 'Estado', render: (user) => <ActiveStatus isActive={user.activo === 1} /> },
        ]}
        emptyText="No se encontraron usuarios."
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
          parishFilter: {
            parishes,
            value: parishFilter,
            onChange: (parishId) => {
              setParishFilter(parishId);
              setCurrentPage(1);
            },
          },
        }}
        onAdd={openCreate}
        // El Worker repite esta regla: aquí solo se evita marcar lo que rechazaría.
        // A otro administrador solo lo modifica el principal.
        isSelectable={(user) => user.id === usuarioId || user.rol !== 'admin' || isPrincipal}
        actions={[
          {
            label: () => 'Editar',
            color: 'bg-darker-app',
            isEnabled: () => true,
            onClick: (user) => {
              setModalError(null);
              setModalState({ mode: 'edit', user });
            },
          },
          {
            label: (user) => (user?.activo === 0 ? 'Habilitar' : 'Deshabilitar'),
            color: 'bg-solid-red',
            // Nadie se deshabilita a sí mismo: así siempre queda alguien que administre.
            isEnabled: (user) => user.id !== usuarioId,
            onClick: (user) => handleToggleActive(user.id as number),
          },
          ...(isPrincipal
            ? [
                {
                  label: () => 'Hacer principal',
                  color: 'bg-amber-600',
                  isEnabled: (user: User) => user.rol === 'admin' && user.id !== usuarioId && user.activo === 1,
                  onClick: setNewPrincipal,
                },
              ]
            : []),
        ]}
      />

      {newPrincipal && (
        <ConfirmActionDialog
          title={`¿Hacer principal a ${newPrincipal.username}?`}
          description="Esa cuenta pasa a ser la única que crea y modifica administradores. Usted queda como administrador común y no puede recuperar la marca por su cuenta."
          confirmLabel="Sí, pasar la marca"
          onConfirm={handleMakePrincipal}
          onDismiss={() => setNewPrincipal(null)}
        />
      )}

      {modalState.mode !== 'closed' && (
        <UserFormModal
          mode={modalState.mode}
          parishes={parishes}
          initialValues={modalState.mode === 'edit' ? modalState.user : undefined}
          canCreateAdmin={isPrincipal}
          onSave={handleSave}
          onCancel={closeModal}
          isLoading={isSaving}
          errorMessage={modalError}
        />
      )}
    </MainMenuLayout>
  );
}
