import { useState } from 'react';
import { FormDialog } from '../ui/FormDialog';
import { SacramentCelebrationFields } from './SacramentCelebrationFields';
import { SacramentPersonPanel } from './SacramentPersonPanel';
import { SacramentRegisterPanel, type SacramentRecordInfo } from './SacramentRegisterPanel';

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
        />

        <SacramentPersonPanel values={values} onChange={update} />
      </div>
    </FormDialog>
  );
}
