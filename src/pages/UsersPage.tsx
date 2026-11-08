import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainMenuLayout } from '../components/features/MainMenuLayout';
import { ManagementPanel, RowBadge, ActiveStatus } from '../components/features/ManagementPanel';
import type { NameColumn, SearchFilters, User } from '../../shared/models';
import { cannot_make_principal, type Actor } from '../../shared/users';
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
import { ROLE_LABELS } from '../lib/permissions';

type Filters = Pick<SearchFilters, NameColumn>;

export function UsersPage() {
  const navigate = useNavigate();
  const usuarioId = useSessionStore((state) => state.usuarioId);
  const usuarioNombre = useSessionStore((state) => state.usuarioNombre);
  const rol = useSessionStore((state) => state.rol);
  const parroquiaId = useSessionStore((state) => state.parroquiaId);
  const parroquiaActivaNombre = useSessionStore((state) => state.parroquiaActivaNombre);
  // El administrador de una parroquia solo gestiona los usuarios de la suya.
  const isGeneralAdmin = rol === 'admin_general';

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

  // Si esta cuenta es la principal (general, o de su parroquia). Se vuelve a preguntar tras cada cambio.
  const [isPrincipal, setIsPrincipal] = useState(false);
  const actor: Actor = { id: usuarioId ?? 0, rol: rol ?? 'usuario', parroquia_id: parroquiaId ?? null, principal: isPrincipal };
  // El admin al que se le pasaría la marca, mientras se pide confirmar.
  const [newPrincipal, setNewPrincipal] = useState<User | null>(null);

  const [parishes, setParishes] = useState<Parish[]>([]);

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
  }, []);

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
    const result = await makePrincipal(newPrincipal.username);
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
          // Esta pantalla solo la ven los administradores, y Electron revisa el rol en cada operación:
          // mostrarlo no le da a nadie un permiso que no tenga.
          { header: 'Tipo', render: (user) => ROLE_LABELS[user.rol] },
          // Un administrador general no es de ninguna parroquia.
          { header: 'Parroquia', render: (user) => (user.rol === 'admin_general' ? '—' : (user.parroquia_nombre ?? '—')) },
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
          parishFilter: isGeneralAdmin
            ? {
                parishes,
                value: parishFilter,
                onChange: (parishId) => {
                  setParishFilter(parishId);
                  setCurrentPage(1);
                },
              }
            : undefined,
        }}
        onAdd={openCreate}
        // Electron y el Worker repiten esta regla (shared/users.ts): aquí solo se evita marcar lo que rechazarían.
        // A otro administrador general solo lo modifica el principal; en una parroquia, a los usuarios los
        // modifica cualquier administrador de ella, y a los administradores, solo su principal.
        isSelectable={(user) => {
          if (user.id === usuarioId) return true;
          if (isGeneralAdmin) return user.rol !== 'admin_general' || isPrincipal;
          if (user.parroquia_id !== parroquiaId) return false;
          return user.rol === 'usuario' || (user.rol === 'admin_parroquia' && isPrincipal);
        }}
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
            // Nadie se deshabilita a sí mismo, ni al principal (primero se pasa la marca): siempre queda quien administre.
            isEnabled: (user) => user.id !== usuarioId && !(user.principal === 1 && user.activo === 1),
            onClick: (user) => handleToggleActive(user.id as number),
          },
          ...(isPrincipal || isGeneralAdmin
            ? [
                {
                  label: () => 'Hacer principal',
                  color: 'bg-amber-600',
                  isEnabled: (user: User) => user.activo === 1 && cannot_make_principal(actor, { id: user.id, rol: user.rol, parroquia_id: user.parroquia_id, principal: user.principal === 1 }) === null,
                  onClick: setNewPrincipal,
                },
              ]
            : []),
        ]}
      />

      {newPrincipal && (
        <ConfirmActionDialog
          title={`¿Hacer principal a ${newPrincipal.username}?`}
          description={
            newPrincipal.rol === 'admin_general'
              ? 'Esa cuenta pasa a ser la única que crea y modifica administradores generales. Usted queda como administrador general común y no puede recuperar la marca por su cuenta. Necesita internet.'
              : 'Esa cuenta pasa a ser el administrador principal de su parroquia: la única que crea, modifica y deshabilita a los demás administradores de ella. El principal actual queda como administrador común. Necesita internet.'
          }
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
          actorRole={rol ?? 'usuario'}
          actorParishName={parishes.find((parish) => parish.id === parroquiaId)?.nombre ?? ''}
          canCreateGeneralAdmin={isGeneralAdmin && isPrincipal}
          canCreateParishAdmin={!isGeneralAdmin && isPrincipal}
          onSave={handleSave}
          onCancel={closeModal}
          isLoading={isSaving}
          errorMessage={modalError}
        />
      )}
    </MainMenuLayout>
  );
}
