import { useState } from 'react';
import { FormDialog } from '../ui/FormDialog';
import { SacramentCelebrationFields, type SacramentCelebrationData } from './SacramentCelebrationFields';
import { SacramentPersonPanel, type SacramentPersonPanelData } from './SacramentPersonPanel';
import { SacramentRegisterPanel, type SacramentRecordInfo } from './SacramentRegisterPanel';

export interface ConfirmationFormValues {
  fechaSacramento: string;
  numeroLibro: string;
  numeroFolio: string;
  numeroRegistro: string;
  persona: SacramentPersonPanelData;
  celebracion: SacramentCelebrationData;
}

const EMPTY_PERSON: SacramentPersonPanelData = {
  dni: '',
  nombre: '',
  apellidoPaterno: '',
  apellidoMaterno: '',
  fechaNacimiento: '',
  edad: '',
  lugarNacimiento: '',
  padreNombre: '',
  madreNombre: '',
};

const EMPTY_CELEBRACION: SacramentCelebrationData = {
  fechaCelebracion: '',
  celebranteId: null,
  padrino: '',
  madrina: '',
  anotaciones: '',
};

const EMPTY_VALUES: ConfirmationFormValues = {
  fechaSacramento: '',
  numeroLibro: '',
  numeroFolio: '',
  numeroRegistro: '',
  persona: EMPTY_PERSON,
  celebracion: EMPTY_CELEBRACION,
};

interface PriestOption {
  id: number;
  nombreCompleto: string;
  parroquiaNombre: string;
}

interface ConfirmationFormProps {
  mode: 'create' | 'edit';
  initialValues?: ConfirmationFormValues;
  parroquiaNombre: string;
  recordInfo?: SacramentRecordInfo;
  errorMessage?: string | null;
  onSave: (values: ConfirmationFormValues) => void;
  onCancel: () => void;
  isLoading: boolean;
  priestOptions: PriestOption[];
  onSearchPriest: (query: string) => void;
  isSearchingPriests: boolean;
}

export function ConfirmationForm({
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
}: ConfirmationFormProps) {
  const [values, setValues] = useState<ConfirmationFormValues>(initialValues ?? EMPTY_VALUES);

  return (
    <FormDialog
      title={mode === 'create' ? 'Agregar partida' : 'Editar partida'}
      onSave={() => onSave(values)}
      onCancel={onCancel}
      isLoading={isLoading}
      errorMessage={errorMessage}
    >
      <SacramentRegisterPanel
        values={values}
        onChange={(changes) => setValues((prev) => ({ ...prev, ...changes }))}
        parroquiaNombre={parroquiaNombre}
        recordInfo={recordInfo}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SacramentCelebrationFields
          title="Datos de confirmación"
          fechaLabel="Fecha de confirmación"
          values={values.celebracion}
          onChange={(celebracion) => setValues((prev) => ({ ...prev, celebracion }))}
          priestOptions={priestOptions}
          onSearchPriest={onSearchPriest}
          isSearchingPriests={isSearchingPriests}
        />
        <SacramentPersonPanel
          values={values.persona}
          onChange={(changes) => setValues((prev) => ({ ...prev, persona: { ...prev.persona, ...changes } }))}
        />
      </div>
    </FormDialog>
  );
}
