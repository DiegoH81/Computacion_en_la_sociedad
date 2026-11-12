import { useState } from 'react';
import type { Baptism, Minister } from '../../../shared/models';
import { emptyBaptism } from '../../lib/emptyRecords';
import { newChanges, personOptions, recordedChanges, type CorrectionDraft } from '../../lib/personCorrections';
import { pendingRequests, requestedBy, usesRequestedValues, withRequestedValues } from '../../lib/changeRequests';
import { ConfirmActionDialog } from '../ui/ConfirmActionDialog';
import { ChangeRequestNotice } from './ChangeRequestNotice';
import { FormDialog } from '../ui/FormDialog';
import { DuplicateWarning } from './DuplicateWarning';
import { MarginalNotesSection } from './MarginalNotesSection';
import { SacramentCelebrationFields } from './SacramentCelebrationFields';
import { SacramentPersonPanel } from './SacramentPersonPanel';
import { SacramentRegisterPanel } from './SacramentRegisterPanel';
import { useDuplicateCheck } from './useDuplicateCheck';
import { RequiredNote } from '../ui/RequiredMark';
import { useMarginalNotes } from './useMarginalNotes';

export type PersonSacramentType = 'bautismo' | 'confirmacion';

const LABELS: Record<PersonSacramentType, { celebracion: string; fecha: string; sacramento: string }> = {
  bautismo: { celebracion: 'Datos de bautismo', fecha: 'Fecha de bautizo', sacramento: 'bautismo' },
  confirmacion: { celebracion: 'Datos de confirmación', fecha: 'Fecha de confirmación', sacramento: 'confirmación' },
};

interface PersonSacramentFormProps {
  tipo: PersonSacramentType;
  /** La partida que se edita, tal como llegó de Electron. Sin ella, se crea una nueva. */
  initialRecord?: Baptism;
  parroquiaNombre: string;
  errorMessage?: string | null;
  /** thenPrint: el usuario eligió "Guardar e imprimir". */
  onSave: (record: Baptism, thenPrint: boolean) => void;
  onCancel: () => void;
  isLoading: boolean;
  priestOptions: Minister[];
  onSearchPriest: (query: string) => void;
  isSearchingPriests: boolean;
  /** Un usuario (ayudante) que edita: no modifica la partida, pide los cambios. */
  onlyCorrections?: boolean;
}

/** El formulario de una partida de bautismo o de confirmación: se guardan igual. */
export function PersonSacramentForm({
  tipo,
  initialRecord,
  parroquiaNombre,
  errorMessage,
  onSave,
  onCancel,
  isLoading,
  priestOptions,
  onSearchPriest,
  isSearchingPriests,
  onlyCorrections = false,
}: PersonSacramentFormProps) {
  const [record, setRecord] = useState<Baptism>(initialRecord ?? emptyBaptism(tipo));
  const [drafts, setDrafts] = useState<CorrectionDraft[]>([]);
  const labels = LABELS[tipo];
  const recorded = recordedChanges(record.persona);
  const isEditing = initialRecord !== undefined;
  const pending = isEditing ? pendingRequests(record) : [];
  // Un usuario con un pedido esperando no puede pedir otro: el formulario queda solo para ver.
  const lockFields = onlyCorrections && pending.length > 0;
  // Abierto cuando hay que confirmar que se descarta un pedido; recuerda si después se imprime.
  const [confirmingDiscard, setConfirmingDiscard] = useState<{ thenPrint: boolean } | null>(null);
  const notes = useMarginalNotes(Boolean(record.sacramento.anotaciones || recorded.length || (isEditing && onlyCorrections)));

  const { persona } = record;
  const duplicates = useDuplicateCheck(tipo, record.sacramento.id, [{
    para: '',
    dni: persona.dni,
    nombres: persona.nombres,
    apellido_paterno: persona.apellido_paterno,
    apellido_materno: persona.apellido_materno,
    fecha_nacimiento: persona.fecha_nacimiento,
    padre: persona.padre,
    madre: persona.madre,
  }]);

  // Las correcciones nuevas se agregan a las ya registradas (que Electron no vuelve a guardar).
  const toSave = (): Baptism => ({ ...record, persona: { ...persona, cambios: [...persona.cambios, ...newChanges(drafts)] } });

  function handleSave(thenPrint: boolean) {
    // El administrador que guarda sin usar lo que pidió un usuario lo descarta: se le pregunta antes.
    if (!onlyCorrections && pending.length > 0 && !usesRequestedValues(toSave(), drafts, pending)) {
      setConfirmingDiscard({ thenPrint });
      return;
    }
    onSave(toSave(), thenPrint);
  }

  function applyRequestedValues() {
    const result = withRequestedValues(record, pending);
    setRecord(result.record as Baptism);
    setDrafts((prev) => [...prev, ...result.drafts]);
    if (result.drafts.length > 0 && !notes.isOpen) notes.toggle();
  }

  return (
    <FormDialog
      title={!isEditing ? 'Agregar partida' : onlyCorrections ? 'Pedir cambio' : 'Editar partida'}
      onSave={() => handleSave(false)}
      // Un pedido de cambio no modifica la partida: imprimirla ahora sacaría los datos de antes.
      onSaveAndPrint={isEditing && onlyCorrections ? undefined : () => handleSave(true)}
      onCancel={onCancel}
      isLoading={isLoading}
      errorMessage={errorMessage}
      saveLabel={isEditing && onlyCorrections ? 'Pedir cambio' : undefined}
      canSave={!lockFields}
      notice={
        <>
          {isEditing && <ChangeRequestNotice record={record} onlyRequests={onlyCorrections} onUseValues={applyRequestedValues} />}
          <DuplicateWarning sacramento={labels.sacramento} matches={duplicates.matches} total={duplicates.total} />
        </>
      }
    >
      {!lockFields && <RequiredNote />}
      <fieldset disabled={lockFields} className="contents">
      <SacramentRegisterPanel
        sacramento={record.sacramento}
        onChange={(changes) => setRecord((prev) => ({ ...prev, sacramento: { ...prev.sacramento, ...changes } }))}
        parroquiaNombre={parroquiaNombre}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SacramentCelebrationFields
          title={labels.celebracion}
          fechaLabel={labels.fecha}
          record={record}
          onChange={setRecord}
          priestOptions={priestOptions}
          onSearchPriest={onSearchPriest}
          isSearchingPriests={isSearchingPriests}
          notesOpen={notes.isOpen}
          onToggleNotes={notes.toggle}
        />
        <SacramentPersonPanel
          persona={persona}
          onChange={(changes) => setRecord((prev) => ({ ...prev, persona: { ...prev.persona, ...changes } }))}
        />
      </div>
      </fieldset>

      {notes.isOpen && (
        <MarginalNotesSection
          sectionRef={notes.sectionRef}
          notes={record.sacramento.anotaciones ?? ''}
          onNotesChange={(anotaciones) => setRecord((prev) => ({ ...prev, sacramento: { ...prev.sacramento, anotaciones } }))}
          options={personOptions(persona)}
          corrections={drafts}
          onCorrectionsChange={setDrafts}
          recorded={recorded}
          correctionsLocked={lockFields}
        />
      )}

      {confirmingDiscard && (
        <ConfirmActionDialog
          title="Descartar el cambio pedido"
          description={`Hay un cambio pendiente de ${requestedBy(pending)}. Si guarda sin usar esos valores, el pedido se descarta.`}
          confirmLabel="Guardar y descartar"
          onConfirm={() => {
            setConfirmingDiscard(null);
            onSave(toSave(), confirmingDiscard.thenPrint);
          }}
          onDismiss={() => setConfirmingDiscard(null)}
        />
      )}
    </FormDialog>
  );
}
