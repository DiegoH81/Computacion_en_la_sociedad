import { useState } from 'react';
import { singlePersonOptions, type CorrectionDraft } from '../../lib/personCorrections';
import { FormDialog } from '../ui/FormDialog';
import { DuplicateWarning } from './DuplicateWarning';
import { MarginalNotesSection } from './MarginalNotesSection';
import { SacramentCelebrationFields } from './SacramentCelebrationFields';
import { SacramentPersonPanel } from './SacramentPersonPanel';
import { SacramentRegisterPanel, type SacramentRecordInfo } from './SacramentRegisterPanel';
import { useDuplicateCheck } from './useDuplicateCheck';
import { useMarginalNotes } from './useMarginalNotes';

export interface BaptismFormValues {
  fechaSacramento: string;
  numeroLibro: string;
  numeroFolio: string;
  numeroRegistro: string;
  dni: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  fechaNacimiento: string;
  edad: string;
  lugarNacimiento: string;
  padreNombre: string;
  madreNombre: string;
  fechaBautizo: string;
  celebranteId: number | null;
  padrino: string;
  madrina: string;
  anotaciones: string;
  correcciones: CorrectionDraft[];
}

const EMPTY_VALUES: BaptismFormValues = {
  fechaSacramento: '',
  numeroLibro: '',
  numeroFolio: '',
  numeroRegistro: '',
  dni: '',
  nombre: '',
  apellidoPaterno: '',
  apellidoMaterno: '',
  fechaNacimiento: '',
  edad: '',
  lugarNacimiento: '',
  padreNombre: '',
  madreNombre: '',
  fechaBautizo: '',
  celebranteId: null,
  padrino: '',
  madrina: '',
  anotaciones: '',
  correcciones: [],
};

interface PriestOption {
  id: number;
  nombreCompleto: string;
  parroquiaNombre: string;
}

interface BaptismFormProps {
  mode: 'create' | 'edit';
  initialValues?: BaptismFormValues;
  parroquiaNombre: string;
  recordInfo?: SacramentRecordInfo;
  errorMessage?: string | null;
  onSave: (values: BaptismFormValues) => void;
  onCancel: () => void;
  isLoading: boolean;
  priestOptions: PriestOption[];
  onSearchPriest: (query: string) => void;
  isSearchingPriests: boolean;
}

export function BaptismForm({
  mode,
  initialValues,
  parroquiaNombre,
  recordInfo,
  errorMessage,
  onSave,
  onCancel,
  isLoading,
  priestOptions,
  onSearchPriest,
  isSearchingPriests,
}: BaptismFormProps) {
  const [values, setValues] = useState<BaptismFormValues>(initialValues ?? EMPTY_VALUES);
  const notes = useMarginalNotes(Boolean(initialValues?.anotaciones || recordInfo?.correcciones.length));

  const duplicates = useDuplicateCheck('bautismo', recordInfo?.sacramentoId, [{
    dni: values.dni,
    nombre: values.nombre,
    apellidoPaterno: values.apellidoPaterno,
    apellidoMaterno: values.apellidoMaterno,
    fechaNacimiento: values.fechaNacimiento,
    padreNombre: values.padreNombre,
    madreNombre: values.madreNombre,
  }]);

  function update(changes: Partial<BaptismFormValues>) {
    setValues((prev) => ({ ...prev, ...changes }));
  }

  return (
    <FormDialog
      title={mode === 'create' ? 'Agregar partida' : 'Editar partida'}
      onSave={() => onSave(values)}
      onCancel={onCancel}
      isLoading={isLoading}
      errorMessage={errorMessage}
      notice={<DuplicateWarning sacramento="bautismo" matches={duplicates.matches} total={duplicates.total} />}
    >
      <SacramentRegisterPanel values={values} onChange={update} parroquiaNombre={parroquiaNombre} recordInfo={recordInfo} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SacramentCelebrationFields
          title="Datos de bautismo"
          fechaLabel="Fecha de bautizo"
          values={{ ...values, fechaCelebracion: values.fechaBautizo }}
          onChange={({ fechaCelebracion, celebranteId, padrino, madrina, anotaciones }) =>
            update({ fechaBautizo: fechaCelebracion, celebranteId, padrino, madrina, anotaciones })
          }
          priestOptions={priestOptions}
          onSearchPriest={onSearchPriest}
          isSearchingPriests={isSearchingPriests}
          priestParishId={recordInfo?.parroquiaId}
          notesOpen={notes.isOpen}
          onToggleNotes={notes.toggle}
        />

        <SacramentPersonPanel values={values} onChange={update} />
      </div>

      {notes.isOpen && (
        <MarginalNotesSection
          sectionRef={notes.sectionRef}
          notes={values.anotaciones}
          onNotesChange={(anotaciones) => update({ anotaciones })}
          options={singlePersonOptions(values)}
          corrections={values.correcciones}
          onCorrectionsChange={(correcciones) => update({ correcciones })}
          recorded={recordInfo?.correcciones}
        />
      )}
    </FormDialog>
  );
}
