import { useState } from 'react';
import { MarriagePersonFields } from './MarriagePersonFields';
import { PriestSelector } from './PriestSelector';

interface PersonMarriageData {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  lugarNacimiento: string;
  fechaNacimiento: string;
  parroquiaBautismo: string;
  fechaBautismo: string;
  padreNombre: string;
  padreApellido: string;
  padreDni: string;
  madreNombre: string;
  madreApellido: string;
  madreDni: string;
}

const EMPTY_PERSON: PersonMarriageData = {
  nombre: '',
  apellidoPaterno: '',
  apellidoMaterno: '',
  lugarNacimiento: '',
  fechaNacimiento: '',
  parroquiaBautismo: '',
  fechaBautismo: '',
  padreNombre: '',
  padreApellido: '',
  padreDni: '',
  madreNombre: '',
  madreApellido: '',
  madreDni: '',
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

interface PriestOption {
  id: number;
  nombreCompleto: string;
  parroquiaNombre: string;
}

interface MarriageFormProps {
  mode: 'create' | 'edit';
  initialValues?: MarriageFormValues;
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

  function handleSubmit() {
    onSave(values);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-lg bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-800">
            {mode === 'create' ? 'Agregar partida' : 'Editar partida'}
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
          <section className="mb-6">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">
              Datos de registro en el libro
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Fecha del sacramento
                </label>
                <input
                  type="date"
                  value={values.fechaSacramento}
                  onChange={(e) => update('fechaSacramento', e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    N° de libro
                  </label>
                  <input
                    type="text"
                    value={values.numeroLibro}
                    onChange={(e) => update('numeroLibro', e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    N° de folio
                  </label>
                  <input
                    type="text"
                    value={values.numeroFolio}
                    onChange={(e) => update('numeroFolio', e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    N° de registro
                  </label>
                  <input
                    type="text"
                    value={values.numeroRegistro}
                    onChange={(e) => update('numeroRegistro', e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="mb-6">
            <MarriagePersonFields
              label="Esposo"
              values={values.esposo}
              onChange={(v) => update('esposo', v)}
            />
          </section>

          <section className="mb-6">
            <MarriagePersonFields
              label="Esposa"
              values={values.esposa}
              onChange={(v) => update('esposa', v)}
            />
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold text-slate-700">
              Datos de la celebración del Matrimonio
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Fecha de matrimonio
                </label>
                <input
                  type="date"
                  value={values.fechaMatrimonio}
                  onChange={(e) => update('fechaMatrimonio', e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Celebrante
                </label>
                <PriestSelector
                  value={values.celebranteId}
                  onSelect={(id) => update('celebranteId', id)}
                  onSearch={onSearchPriest}
                  options={priestOptions}
                  isLoading={isSearchingPriests}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Lugar de matrimonio
                </label>
                <input
                  type="text"
                  value={values.lugarMatrimonio}
                  onChange={(e) => update('lugarMatrimonio', e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Testigo 1</label>
                <input
                  type="text"
                  value={values.testigo1}
                  onChange={(e) => update('testigo1', e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Testigo 2</label>
                <input
                  type="text"
                  value={values.testigo2}
                  onChange={(e) => update('testigo2', e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Testigo 3</label>
                <input
                  type="text"
                  value={values.testigo3}
                  onChange={(e) => update('testigo3', e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Testigo 4</label>
                <input
                  type="text"
                  value={values.testigo4}
                  onChange={(e) => update('testigo4', e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Notas marginales
                </label>
                <textarea
                  value={values.notasMarginales}
                  onChange={(e) => update('notasMarginales', e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
                />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
