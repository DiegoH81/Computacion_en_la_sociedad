import { useState } from 'react';
import type { Marriage, Minister, Person } from '../../../shared/models';
import { emptyMarriage } from '../../lib/emptyRecords';
import { newChanges, personOptions, recordedChanges, type CorrectionDraft } from '../../lib/personCorrections';
import { pendingRequests, requestedBy, usesRequestedValues, withRequestedValues } from '../../lib/changeRequests';
import { ConfirmActionDialog } from '../ui/ConfirmActionDialog';
import { ChangeRequestNotice } from './ChangeRequestNotice';
import { DateSelect } from '../ui/DateSelect';
import { FormDialog } from '../ui/FormDialog';
import { FormInput } from '../ui/FormInput';
import { FormSectionTitle } from '../ui/FormSectionTitle';
import { InlineFormField } from '../ui/InlineFormField';
import { DuplicateWarning } from './DuplicateWarning';
import { MarginalNotesButton } from './MarginalNotesButton';
import { MarginalNotesSection } from './MarginalNotesSection';
import { MarriageFamilyFields, MarriagePersonFields } from './MarriagePersonFields';
import { PriestSelector } from './PriestSelector';
import { SacramentRegisterPanel } from './SacramentRegisterPanel';
import { useDuplicateCheck } from './useDuplicateCheck';
import { RequiredNote } from '../ui/RequiredMark';
import { useMarginalNotes } from './useMarginalNotes';

const TESTIGOS = [
  { key: 'testigo_1', label: 'Testigo 1:' },
  { key: 'testigo_2', label: 'Testigo 2:' },
  { key: 'testigo_3', label: 'Testigo 3:' },
  { key: 'testigo_4', label: 'Testigo 4:' },
] as const;

interface MarriageFormProps {
  /** La partida que se edita, tal como llegó de Electron. Sin ella, se crea una nueva. */
  initialRecord?: Marriage;
  parroquiaNombre: string;
  errorMessage?: string | null;
  onSave: (record: Marriage) => void;
  onCancel: () => void;
  isLoading: boolean;
  priestOptions: Minister[];
  onSearchPriest: (query: string) => void;
  isSearchingPriests: boolean;
  /** Un usuario (ayudante) que edita: no modifica la partida, pide los cambios. */
  onlyCorrections?: boolean;
}

function duplicateQuery(para: string, person: Person) {
  return {
    para,
    dni: person.dni,
    nombres: person.nombres,
    apellido_paterno: person.apellido_paterno,
    apellido_materno: person.apellido_materno,
    fecha_nacimiento: person.fecha_nacimiento,
    padre: person.padre,
    madre: person.madre,
  };
}

export function MarriageForm({
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
}: MarriageFormProps) {
  // Una partida nueva trae como lugar del matrimonio la parroquia actual (se puede cambiar).
  const [record, setRecord] = useState<Marriage>(initialRecord ?? { ...emptyMarriage(), lugar: parroquiaNombre || null });
  const [drafts, setDrafts] = useState<CorrectionDraft[]>([]);
  const recorded = [...recordedChanges(record.conyuge_1, 'conyuge_1'), ...recordedChanges(record.conyuge_2, 'conyuge_2')];
  const isEditing = initialRecord !== undefined;
  const pending = isEditing ? pendingRequests(record) : [];
  // Un usuario con un pedido esperando no puede pedir otro: el formulario queda solo para ver.
  const lockFields = onlyCorrections && pending.length > 0;
  const [isConfirmingDiscard, setIsConfirmingDiscard] = useState(false);
  const notes = useMarginalNotes(Boolean(record.sacramento.anotaciones || recorded.length || (isEditing && onlyCorrections)));

  const duplicates = useDuplicateCheck('matrimonio', record.sacramento.id, [
    duplicateQuery('Esposo', record.conyuge_1),
    duplicateQuery('Esposa', record.conyuge_2),
  ]);

  const sacramento = record.sacramento;
  const updateSacrament = (changes: Partial<Marriage['sacramento']>) =>
    setRecord((prev) => ({ ...prev, sacramento: { ...prev.sacramento, ...changes } }));

  // Las correcciones nuevas de cada cónyuge se agregan a las ya registradas (que Electron no vuelve a guardar).
  const toSave = (): Marriage => ({
    ...record,
    conyuge_1: { ...record.conyuge_1, cambios: [...record.conyuge_1.cambios, ...newChanges(drafts, 'conyuge_1')] },
    conyuge_2: { ...record.conyuge_2, cambios: [...record.conyuge_2.cambios, ...newChanges(drafts, 'conyuge_2')] },
  });

  function handleSave() {
    // El administrador que guarda sin usar lo que pidió un usuario lo descarta: se le pregunta antes.
    if (!onlyCorrections && pending.length > 0 && !usesRequestedValues(toSave(), drafts, pending)) {
      setIsConfirmingDiscard(true);
      return;
    }
    onSave(toSave());
  }

  function applyRequestedValues() {
    const result = withRequestedValues(record, pending);
    setRecord(result.record as Marriage);
    setDrafts((prev) => [...prev, ...result.drafts]);
    if (result.drafts.length > 0 && !notes.isOpen) notes.toggle();
  }

  return (
    <FormDialog
      title={!isEditing ? 'Agregar partida' : onlyCorrections ? 'Pedir cambio' : 'Editar partida'}
      onSave={handleSave}
      onCancel={onCancel}
      isLoading={isLoading}
      errorMessage={errorMessage}
      saveLabel={isEditing && onlyCorrections ? 'Pedir cambio' : undefined}
      canSave={!lockFields}
      notice={
        <>
          {isEditing && <ChangeRequestNotice record={record} onlyRequests={onlyCorrections} onUseValues={applyRequestedValues} />}
          <DuplicateWarning sacramento="matrimonio" matches={duplicates.matches} total={duplicates.total} />
        </>
      }
    >
      {!lockFields && <RequiredNote />}
      <fieldset disabled={lockFields} className="contents">
      <FormSectionTitle>Datos de registro en el libro</FormSectionTitle>
      <SacramentRegisterPanel sacramento={sacramento} onChange={updateSacrament} parroquiaNombre={parroquiaNombre} />

      <FormSectionTitle>Datos personales de los cónyuges</FormSectionTitle>
      <MarriagePersonFields marriage={record} onChange={setRecord} />

      <FormSectionTitle>Familiares</FormSectionTitle>
      <MarriageFamilyFields marriage={record} onChange={setRecord} />

      <div className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-xl bg-table-panel p-4 sm:grid-cols-2">
        <InlineFormField label="Fecha de matrimonio:" isGroup>
          <DateSelect
            ariaLabel="Fecha de matrimonio"
            value={sacramento.fecha_evento ?? ''}
            onChange={(v) => updateSacrament({ fecha_evento: v })}
          />
        </InlineFormField>
        <InlineFormField label="Lugar de matrimonio:">
          <FormInput value={record.lugar ?? ''} onChange={(e) => setRecord((prev) => ({ ...prev, lugar: e.target.value }))} />
        </InlineFormField>
        <div className="sm:col-span-2">
          <InlineFormField label="Celebrante:" required>
            <PriestSelector
              value={sacramento.ministro_id}
              onSelect={(id) => updateSacrament({ ministro_id: id })}
              onSearch={onSearchPriest}
              options={priestOptions}
              isLoading={isSearchingPriests}
            />
          </InlineFormField>
        </div>
        {TESTIGOS.map(({ key, label }) => (
          <InlineFormField key={key} label={label}>
            <FormInput value={record[key] ?? ''} onChange={(e) => setRecord((prev) => ({ ...prev, [key]: e.target.value }))} />
          </InlineFormField>
        ))}

        <div className="sm:col-span-2">
          <MarginalNotesButton isOpen={notes.isOpen} onToggle={notes.toggle} />
        </div>
      </div>
      </fieldset>

      {notes.isOpen && (
        <MarginalNotesSection
          sectionRef={notes.sectionRef}
          notes={sacramento.anotaciones ?? ''}
          onNotesChange={(anotaciones) => updateSacrament({ anotaciones })}
          options={[...personOptions(record.conyuge_1, 'conyuge_1'), ...personOptions(record.conyuge_2, 'conyuge_2')]}
          corrections={drafts}
          onCorrectionsChange={setDrafts}
          recorded={recorded}
          correctionsLocked={lockFields}
        />
      )}

      {isConfirmingDiscard && (
        <ConfirmActionDialog
          title="Descartar el cambio pedido"
          description={`Hay un cambio pendiente de ${requestedBy(pending)}. Si guarda sin usar esos valores, el pedido se descarta.`}
          confirmLabel="Guardar y descartar"
          onConfirm={() => {
            setIsConfirmingDiscard(false);
            onSave(toSave());
          }}
          onDismiss={() => setIsConfirmingDiscard(false)}
        />
      )}
    </FormDialog>
  );
}
