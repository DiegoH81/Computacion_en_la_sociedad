import { useState } from 'react';
import { Field } from '../ui/Field';
import { SacramentPersonFields, type SacramentPersonData } from './SacramentPersonFields';
import {
  SacramentCelebrationFields,
  type SacramentCelebrationData,
} from './SacramentCelebrationFields';

export interface ConfirmationFormValues {
  fechaSacramento: string;
  numeroLibro: string;
  numeroFolio: string;
  numeroRegistro: string;
  persona: SacramentPersonData;
  celebracion: SacramentCelebrationData;
}

const EMPTY_PERSON: SacramentPersonData = {
  nombre: '',
  apellidoPaterno: '',
  apellidoMaterno: '',
  fechaNacimiento: '',
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
  onSave,
  onCancel,
  isLoading,
  priestOptions,
  onSearchPriest,
  isSearchingPriests,
}: ConfirmationFormProps) {
  const [values, setValues] = useState<ConfirmationFormValues>(initialValues ?? EMPTY_VALUES);

  function update<K extends keyof ConfirmationFormValues>(
    key: K,
    value: ConfirmationFormValues[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit() {
    onSave(values);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-xl flex-col rounded-lg bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-800">
            {mode === 'create' ? 'Agregar Confirmación' : 'Editar partida'}
          </h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600"
            >
              Volver
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isLoading}
              className="rounded-md bg-emerald-900 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {isLoading ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <section className="mb-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Datos del registro</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="col-span-2 sm:col-span-1">
                <Field
                  label="Fecha del sacramento"
                  type="date"
                  value={values.fechaSacramento}
                  onChange={(v) => update('fechaSacramento', v)}
                />
              </div>
              <Field label="N° libro" value={values.numeroLibro} onChange={(v) => update('numeroLibro', v)} />
              <Field label="N° folio" value={values.numeroFolio} onChange={(v) => update('numeroFolio', v)} />
              <Field
                label="N° registro"
                value={values.numeroRegistro}
                onChange={(v) => update('numeroRegistro', v)}
              />
            </div>
          </section>

          <div className="mb-5">
            <SacramentPersonFields
              values={values.persona}
              onChange={(v) => update('persona', v)}
            />
          </div>

          <SacramentCelebrationFields
            title="Datos de Confirmación"
            fechaLabel="Fecha de confirmación"
            values={values.celebracion}
            onChange={(v) => update('celebracion', v)}
            priestOptions={priestOptions}
            onSearchPriest={onSearchPriest}
            isSearchingPriests={isSearchingPriests}
          />
        </div>
      </div>
    </div>
  );
}
