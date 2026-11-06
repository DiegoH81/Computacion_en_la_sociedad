import { useState } from 'react';
import type { Baptism, Minister } from '../../../shared/models';
import { emptyBaptism } from '../../lib/emptyRecords';
import { newChanges, personOptions, recordedChanges, type CorrectionDraft } from '../../lib/personCorrections';
import { FormDialog } from '../ui/FormDialog';
import { DuplicateWarning } from './DuplicateWarning';
import { MarginalNotesSection } from './MarginalNotesSection';
import { SacramentCelebrationFields } from './SacramentCelebrationFields';
import { SacramentPersonPanel } from './SacramentPersonPanel';
import { SacramentRegisterPanel } from './SacramentRegisterPanel';
import { useDuplicateCheck } from './useDuplicateCheck';
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
  onSave: (record: Baptism) => void;
  onCancel: () => void;
  isLoading: boolean;
  priestOptions: Minister[];
  onSearchPriest: (query: string) => void;
  isSearchingPriests: boolean;
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
}: PersonSacramentFormProps) {
  const [record, setRecord] = useState<Baptism>(initialRecord ?? emptyBaptism(tipo));
  const [drafts, setDrafts] = useState<CorrectionDraft[]>([]);
  const labels = LABELS[tipo];
  const recorded = recordedChanges(record.persona);
  const notes = useMarginalNotes(Boolean(record.sacramento.anotaciones || recorded.length));

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

  function handleSave() {
    // Las correcciones nuevas se agregan a las ya registradas (que Electron no vuelve a guardar).
    onSave({ ...record, persona: { ...persona, cambios: [...persona.cambios, ...newChanges(drafts)] } });
  }

  return (
    <FormDialog
      title={initialRecord ? 'Editar partida' : 'Agregar partida'}
      onSave={handleSave}
      onCancel={onCancel}
      isLoading={isLoading}
      errorMessage={errorMessage}
      notice={<DuplicateWarning sacramento={labels.sacramento} matches={duplicates.matches} total={duplicates.total} />}
    >
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
          priestParishId={record.sacramento.parroquia_id}
          notesOpen={notes.isOpen}
          onToggleNotes={notes.toggle}
        />
        <SacramentPersonPanel
          persona={persona}
          onChange={(changes) => setRecord((prev) => ({ ...prev, persona: { ...prev.persona, ...changes } }))}
        />
      </div>

      {notes.isOpen && (
        <MarginalNotesSection
          sectionRef={notes.sectionRef}
          notes={record.sacramento.anotaciones ?? ''}
          onNotesChange={(anotaciones) => setRecord((prev) => ({ ...prev, sacramento: { ...prev.sacramento, anotaciones } }))}
          options={personOptions(persona)}
          corrections={drafts}
          onCorrectionsChange={setDrafts}
          recorded={recorded}
        />
      )}
    </FormDialog>
  );
}
