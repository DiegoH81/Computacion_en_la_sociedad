import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainMenuLayout } from '../components/features/MainMenuLayout';
import {
  SacramentSearchPanel,
  type SacramentRowBase,
  type SortField,
} from '../components/features/SacramentSearchPanel';
import {
  ConfirmationForm,
  type ConfirmationFormValues,
} from '../components/features/ConfirmationForm';
import { AnnulmentModal } from '../components/features/AnnulmentModal';
import { SacramentPrintView } from '../components/features/SacramentPrintView';
import { SacramentIndexPreview } from '../components/features/SacramentIndexPreview';
import { A4Page, A4PrintPreview } from '../components/print/A4PrintPreview';
import { useSessionStore } from '../store/sessionStore';
import {
  searchConfirmations,
  createConfirmation,
  updateConfirmation,
  annulConfirmation,
  formatFechaDisplay,
} from '../controllers/ConfirmationController';
import { searchPriests } from '../controllers/PriestController';
import { ConfirmationService } from '../services/ConfirmationService';

interface ConfirmationRow extends SacramentRowBase {
  nombreCompleto: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
}

interface PriestOption {
  id: number;
  nombreCompleto: string;
  parroquiaNombre: string;
}

export function ConfirmationsPage() {
  const navigate = useNavigate();
  const usuarioNombre = useSessionStore((state) => state.usuarioNombre);
  const rol = useSessionStore((state) => state.rol);
  const parroquiaId = useSessionStore((state) => state.parroquiaId);
  const parroquiaActivaId = useSessionStore((state) => state.parroquiaActivaId);
  const parroquiaActivaNombre = useSessionStore((state) => state.parroquiaActivaNombre);
  const token = useSessionStore((state) => state.token);

  const [confirmations, setConfirmations] = useState<ConfirmationRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState<SortField>('nombre');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const [formState, setFormState] = useState<
    { mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; confirmationId: number }
  >({ mode: 'closed' });
  const [editingInitialValues, setEditingInitialValues] = useState<
    ConfirmationFormValues | undefined
  >();
  const [annulmentTargetId, setAnnulmentTargetId] = useState<number | null>(null);
  const [printData, setPrintData] = useState<Parameters<typeof SacramentPrintView>[0] | null>(
    null,
  );
  const [isIndexOpen, setIsIndexOpen] = useState(false);
  const [priestOptions, setPriestOptions] = useState<PriestOption[]>([]);
  const [isSearchingPriests, setIsSearchingPriests] = useState(false);

  async function loadConfirmations() {
    setIsLoading(true);
    setErrorMessage(null);

    const result = await searchConfirmations({ sortBy, sortDirection, page: currentPage });

    setIsLoading(false);

    if (!result.success) {
      setErrorMessage(result.errorMessage ?? 'Error al buscar partidas.');
      return;
    }

    setConfirmations(result.confirmations ?? []);
    setTotalPages(result.totalPages ?? 1);
  }

  useEffect(() => {
    loadConfirmations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, sortBy, sortDirection]);

  const canWrite = rol === 'admin' || parroquiaActivaId === parroquiaId;

  function canManage(confirmationParroquiaId: number): boolean {
    if (rol === 'admin') return true;
    return parroquiaActivaId === parroquiaId && confirmationParroquiaId === parroquiaId;
  }

  function handleSearch(filters: {
    nombre: string;
    apellidoPaterno: string;
    apellidoMaterno: string;
  }) {
    setCurrentPage(1);
    searchConfirmations({
      nombre: filters.nombre || undefined,
      apellidoPaterno: filters.apellidoPaterno || undefined,
      apellidoMaterno: filters.apellidoMaterno || undefined,
      sortBy,
      sortDirection,
      page: 1,
    }).then((result) => {
      if (result.success) {
        setConfirmations(result.confirmations ?? []);
        setTotalPages(result.totalPages ?? 1);
      } else {
        setErrorMessage(result.errorMessage ?? 'Error al buscar partidas.');
      }
    });
  }

  function handleClear() {
    setCurrentPage(1);
    loadConfirmations();
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

  async function handleOpenEdit(confirmationId: number) {
    if (!token) return;
    setIsLoading(true);
    try {
      const { confirmation } = await ConfirmationService.getById(confirmationId, token);
      const c = confirmation as Record<string, string | number | null>;

      setEditingInitialValues({
        fechaSacramento: String(c.fecha_sacramento ?? ''),
        numeroLibro: String(c.numero_libro ?? ''),
        numeroFolio: String(c.numero_folio ?? ''),
        numeroRegistro: String(c.numero_registro ?? ''),
        persona: {
          nombre: String(c.nombre ?? ''),
          apellidoPaterno: String(c.apellido_paterno ?? ''),
          apellidoMaterno: String(c.apellido_materno ?? ''),
          fechaNacimiento: String(c.fecha_nacimiento ?? ''),
          lugarNacimiento: String(c.lugar_nacimiento ?? ''),
          padreNombre: String(c.padre_nombre ?? ''),
          madreNombre: String(c.madre_nombre ?? ''),
        },
        celebracion: {
          fechaCelebracion: String(c.fecha_confirmacion ?? ''),
          celebranteId: c.celebrante_id ? Number(c.celebrante_id) : null,
          padrino: String(c.padrino ?? ''),
          madrina: String(c.madrina ?? ''),
          anotaciones: String(c.anotaciones ?? ''),
        },
      });

      setFormState({ mode: 'edit', confirmationId });
    } catch {
      setErrorMessage('No se pudo cargar la partida para editar.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSaveForm(values: ConfirmationFormValues) {
    setIsLoading(true);

    const result =
      formState.mode === 'edit'
        ? await updateConfirmation(formState.confirmationId, values)
        : await createConfirmation(values);

    setIsLoading(false);

    if (!result.success) {
      setErrorMessage(result.errorMessage ?? 'Error al guardar.');
      return;
    }

    setFormState({ mode: 'closed' });
    setEditingInitialValues(undefined);
    loadConfirmations();
  }

  async function handleConfirmAnnulment(motivo: string) {
    if (annulmentTargetId === null) return;
    const result = await annulConfirmation(annulmentTargetId, motivo);
    if (!result.success) {
      setErrorMessage(result.errorMessage ?? 'Error al anular.');
      return;
    }
    setAnnulmentTargetId(null);
    loadConfirmations();
  }

  async function handlePrint(confirmationId: number) {
    if (!token) return;
    const { confirmation } = await ConfirmationService.getById(confirmationId, token);
    const c = confirmation as Record<string, string | number | null>;

    setPrintData({
      certificateTitle: 'CERTIFICADO DE PARTIDA DE CONFIRMACIÓN',
      parroquiaNombre: String(c.parroquia_nombre ?? ''),
      numeroLibro: String(c.numero_libro ?? ''),
      numeroFolio: String(c.numero_folio ?? ''),
      numeroRegistro: String(c.numero_registro ?? ''),
      fechaSacramento: formatFechaDisplay(String(c.fecha_sacramento ?? '')),
      sections: [
        {
          title: 'DATOS DEL CONFIRMADO',
          lines: [
            `Nombres: ${c.nombre} ${c.apellido_paterno} ${c.apellido_materno}`,
            `Fecha de nacimiento: ${formatFechaDisplay(String(c.fecha_nacimiento ?? ''))} | Lugar: ${c.lugar_nacimiento ?? ''}`,
            `Padre: ${c.padre_nombre ?? ''}`,
            `Madre: ${c.madre_nombre ?? ''}`,
          ],
        },
        {
          title: 'DATOS DE LA CELEBRACIÓN',
          lines: [
            `Fecha de confirmación: ${formatFechaDisplay(String(c.fecha_confirmacion ?? ''))} | Celebrante: ${c.celebrante_nombre ?? ''}`,
            `Padrino: ${c.padrino ?? ''}`,
            `Madrina: ${c.madrina ?? ''}`,
          ],
        },
      ],
    });
  }

  return (
    <MainMenuLayout
      title="Confirmación"
      parroquiaActivaNombre={parroquiaActivaNombre ?? ''}
      usuarioNombre={usuarioNombre ?? ''}
      onBack={() => navigate('/dashboard')}
    >
      <SacramentSearchPanel<ConfirmationRow>
        title="Buscar partida de confirmación"
        errorMessage={errorMessage}
        rows={confirmations}
        columns={[
          { header: 'Nombres', render: (row) => row.nombreCompleto },
          { header: 'Apellido paterno', render: (row) => row.apellidoPaterno },
          { header: 'Apellido materno', render: (row) => row.apellidoMaterno },
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
        <ConfirmationForm
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
              <SacramentPrintView {...printData} />
            </A4Page>,
          ]}
        />
      )}

      {isIndexOpen && (
        <SacramentIndexPreview
          tipo="confirmacion"
          sacramentName="confirmación"
          parroquiaNombre={parroquiaActivaNombre ?? ''}
          onClose={() => setIsIndexOpen(false)}
        />
      )}
    </MainMenuLayout>
  );
}
