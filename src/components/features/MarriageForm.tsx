import { useState } from 'react';
import { DateSelect } from '../ui/DateSelect';
import { FormDialog } from '../ui/FormDialog';
import { FormInput } from '../ui/FormInput';
import { FormSectionTitle } from '../ui/FormSectionTitle';
import { InlineFormField } from '../ui/InlineFormField';
import { MarginalNotesField } from './MarginalNotesField';
import { SacramentRegisterPanel, type SacramentRecordInfo } from './SacramentRegisterPanel';
import { MarriageFamilyFields, MarriagePersonFields, type PersonMarriageData } from './MarriagePersonFields';
import { PriestSelector } from './PriestSelector';

const EMPTY_PERSON: PersonMarriageData = {
  dni: '',
  nombre: '',
  apellidoPaterno: '',
  apellidoMaterno: '',
  lugarNacimiento: '',
  fechaNacimiento: '',
  edad: '',
  parroquiaBautismo: '',
  fechaBautismo: '',
  padreNombre: '',
  madreNombre: '',
};

export interface MarriageFormValues {
  fechaSacramento: string;
  numeroLibro: string;
  numeroFolio: string;
  numeroRegistro: string;
  esposo: PersonMarriageData;
  esposa: PersonMarriageData;
  fechaMatrimonio: string;
  celebranteId: number | null;
  lugarMatrimonio: string;
  testigo1: string;
  testigo2: string;
  testigo3: string;
  testigo4: string;
  notasMarginales: string;
}

const EMPTY_VALUES: MarriageFormValues = {
  fechaSacramento: '',
  numeroLibro: '',
  numeroFolio: '',
  numeroRegistro: '',
  esposo: EMPTY_PERSON,
  esposa: EMPTY_PERSON,
  fechaMatrimonio: '',
  celebranteId: null,
  lugarMatrimonio: '',
  testigo1: '',
  testigo2: '',
  testigo3: '',
  testigo4: '',
  notasMarginales: '',
};

const TESTIGOS = [
  { key: 'testigo1', label: 'Testigo 1:' },
  { key: 'testigo2', label: 'Testigo 2:' },
  { key: 'testigo3', label: 'Testigo 3:' },
  { key: 'testigo4', label: 'Testigo 4:' },
] as const;

interface PriestOption {
  id: number;
  nombreCompleto: string;
  parroquiaNombre: string;
}

interface MarriageFormProps {
  mode: 'create' | 'edit';
  initialValues?: MarriageFormValues;
  parroquiaNombre: string;
  recordInfo?: SacramentRecordInfo;
  errorMessage?: string | null;
  onSave: (values: MarriageFormValues) => void;
  onCancel: () => void;
  isLoading: boolean;
  priestOptions: PriestOption[];
  onSearchPriest: (query: string) => void;
  isSearchingPriests: boolean;
}

export function MarriageForm({
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
}: MarriageFormProps) {
  const [values, setValues] = useState<MarriageFormValues>(initialValues ?? EMPTY_VALUES);

  function update<K extends keyof MarriageFormValues>(key: K, value: MarriageFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  const spouses = {
    esposo: values.esposo,
    esposa: values.esposa,
    onChangeEsposo: (person: PersonMarriageData) => update('esposo', person),
    onChangeEsposa: (person: PersonMarriageData) => update('esposa', person),
  };

  return (
    <FormDialog
      title={mode === 'create' ? 'Agregar partida' : 'Editar partida'}
      onSave={() => onSave(values)}
      onCancel={onCancel}
      isLoading={isLoading}
      errorMessage={errorMessage}
    >
      <FormSectionTitle>Datos de registro en el libro</FormSectionTitle>
      <SacramentRegisterPanel
        values={values}
        onChange={(changes) => setValues((prev) => ({ ...prev, ...changes }))}
        parroquiaNombre={parroquiaNombre}
        recordInfo={recordInfo}
      />

      <FormSectionTitle>Datos personales de los cónyuges</FormSectionTitle>
      <MarriagePersonFields {...spouses} />

      <FormSectionTitle>Familiares</FormSectionTitle>
      <MarriageFamilyFields {...spouses} />

      <div className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-xl bg-table-panel p-4 sm:grid-cols-2">
        <InlineFormField label="Fecha de matrimonio:">
          <DateSelect
            ariaLabel="Fecha de matrimonio"
            value={values.fechaMatrimonio}
            onChange={(v) => update('fechaMatrimonio', v)}
          />
        </InlineFormField>
        <InlineFormField label="Lugar de matrimonio:">
          <FormInput value={values.lugarMatrimonio} onChange={(e) => update('lugarMatrimonio', e.target.value)} />
        </InlineFormField>
        <div className="sm:col-span-2">
          <InlineFormField label="Celebrante:">
            <PriestSelector
              value={values.celebranteId}
              onSelect={(id) => update('celebranteId', id)}
              onSearch={onSearchPriest}
              options={priestOptions}
              isLoading={isSearchingPriests}
            />
          </InlineFormField>
        </div>
        {TESTIGOS.map(({ key, label }) => (
          <InlineFormField key={key} label={label}>
            <FormInput value={values[key]} onChange={(e) => update(key, e.target.value)} />
          </InlineFormField>
        ))}

        <div className="sm:col-span-2">
          <MarginalNotesField value={values.notasMarginales} onChange={(v) => update('notasMarginales', v)} />
        </div>
      </div>
    </FormDialog>
  );
}
