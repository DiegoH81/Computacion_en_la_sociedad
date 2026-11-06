import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Parish } from '../../shared/models';
import { MainMenuLayout } from '../components/features/MainMenuLayout';
import { ManagementPanel, ActiveStatus } from '../components/features/ManagementPanel';
import { ParishFormModal } from '../components/features/ParishFormModal';
import { useSessionStore } from '../store/sessionStore';
import { loadAllParishes, saveParish, toggleParishActive, type ParishFields } from '../controllers/ParishController';

/** Gestión de parroquias (solo admin): alta, edición y habilitar o deshabilitar. No se borran. */
export function ParishesPage() {
  const navigate = useNavigate();
  const usuarioNombre = useSessionStore((state) => state.usuarioNombre);
  const parroquiaActivaNombre = useSessionStore((state) => state.parroquiaActivaNombre);

  const [parishes, setParishes] = useState<Parish[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Se incrementa tras guardar o cambiar el estado para volver a pedir la lista.
  const [reloadCounter, setReloadCounter] = useState(0);

  const [modalState, setModalState] = useState<
    { mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; parish: Parish }
  >({ mode: 'closed' });
  const [isSaving, setIsSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setErrorMessage(null);

      const result = await loadAllParishes();
      if (cancelled) return;

      setIsLoading(false);
      if (!result.success) {
        setErrorMessage(result.errorMessage ?? 'No se pudieron cargar las parroquias.');
        return;
      }
      setParishes(result.parishes ?? []);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [reloadCounter]);

  function openModal(state: { mode: 'create' } | { mode: 'edit'; parish: Parish }) {
    setModalError(null);
    setModalState(state);
  }

  function closeModal() {
    setModalError(null);
    setModalState({ mode: 'closed' });
  }

  async function handleSave(parish: ParishFields) {
    setIsSaving(true);
    setModalError(null);

    const result = await saveParish(parish);
    setIsSaving(false);

    if (!result.success) {
      // El error se muestra dentro del modal, que sigue abierto con lo escrito.
      setModalError(result.errorMessage ?? 'No se pudo guardar.');
      return;
    }

    closeModal();
    setReloadCounter((count) => count + 1);
  }

  async function handleToggleActive(parishId: number) {
    setErrorMessage(null);

    const result = await toggleParishActive(parishId);
    if (!result.success) {
      setErrorMessage(result.errorMessage ?? 'Error al cambiar el estado.');
      return;
    }

    setReloadCounter((count) => count + 1);
  }

  return (
    <MainMenuLayout
      title="Parroquias"
      parroquiaActivaNombre={parroquiaActivaNombre ?? ''}
      usuarioNombre={usuarioNombre ?? ''}
      onBack={() => navigate('/configuracion')}
    >
      <ManagementPanel<Parish>
        title="Parroquias"
        notice="Una parroquia deshabilitada deja de aparecer al elegir parroquia, pero sus partidas, ministros y cuentas se conservan."
        errorMessage={errorMessage}
        rows={parishes}
        getRowId={(parish) => parish.id}
        getRowLabel={(parish) => `parroquia ${parish.nombre}`}
        columns={[
          { header: 'Nombre', render: (parish) => parish.nombre, isMain: true },
          { header: 'Ubicación', render: (parish) => parish.ubicacion ?? '—' },
          { header: 'Estado', render: (parish) => <ActiveStatus isActive={parish.activa === 1} feminine /> },
        ]}
        emptyText="No hay parroquias."
        isLoading={isLoading}
        onAdd={() => openModal({ mode: 'create' })}
        isSelectable={() => true}
        actions={[
          {
            label: () => 'Editar',
            color: 'bg-darker-app',
            isEnabled: () => true,
            onClick: (parish) => openModal({ mode: 'edit', parish }),
          },
          {
            label: (parish) => (parish?.activa === 0 ? 'Habilitar' : 'Deshabilitar'),
            color: 'bg-solid-red',
            isEnabled: () => true,
            onClick: (parish) => handleToggleActive(parish.id),
          },
        ]}
      />

      {modalState.mode !== 'closed' && (
        <ParishFormModal
          mode={modalState.mode}
          initialValues={modalState.mode === 'edit' ? modalState.parish : undefined}
          onSave={handleSave}
          onCancel={closeModal}
          isLoading={isSaving}
          errorMessage={modalError}
        />
      )}
    </MainMenuLayout>
  );
}
