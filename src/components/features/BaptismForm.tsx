import { useState } from 'react';
import { PriestSelector } from './PriestSelector';

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
  onSave: (values: BaptismFormValues) => void;
  onCancel: () => void;
  isLoading: boolean;
  priestOptions: PriestOption[];
  onSearchPriest: (query: string) => void;
  isSearchingPriests: boolean;
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
      />
    </div>
  );
}

export function BaptismForm({
  mode,
  initialValues,
  onSave,
  onCancel,
  isLoading,
  priestOptions,
  onSearchPriest,
  isSearchingPriests,
}: BaptismFormProps) {
  const [values, setValues] = useState<BaptismFormValues>(initialValues ?? EMPTY_VALUES);

  function update<K extends keyof BaptismFormValues>(key: K, value: BaptismFormValues[K]) {
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
              <Field label="N° registro" value={values.numeroRegistro} onChange={(v) => update('numeroRegistro', v)} />
            </div>
          </section>

          <section className="mb-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Datos personales</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="DNI" value={values.dni} onChange={(v) => update('dni', v)} />
              <Field label="Nombre" value={values.nombre} onChange={(v) => update('nombre', v)} />
              <Field
                label="Apellido paterno"
                value={values.apellidoPaterno}
                onChange={(v) => update('apellidoPaterno', v)}
              />
              <Field
                label="Apellido materno"
                value={values.apellidoMaterno}
                onChange={(v) => update('apellidoMaterno', v)}
              />
              <Field
                label="Fecha de nacimiento"
                type="date"
                value={values.fechaNacimiento}
                onChange={(v) => update('fechaNacimiento', v)}
              />
              <Field label="Edad" type="number" value={values.edad} onChange={(v) => update('edad', v)} />
              <Field
                label="Lugar de nacimiento"
                value={values.lugarNacimiento}
                onChange={(v) => update('lugarNacimiento', v)}
              />
              <Field label="Padre" value={values.padreNombre} onChange={(v) => update('padreNombre', v)} />
              <Field label="Madre" value={values.madreNombre} onChange={(v) => update('madreNombre', v)} />
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Datos de bautismo</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field
                label="Fecha del bautizo"
                type="date"
                value={values.fechaBautizo}
                onChange={(v) => update('fechaBautizo', v)}
              />
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Celebrante</label>
                <PriestSelector
                  value={values.celebranteId}
                  onSelect={(id) => update('celebranteId', id)}
                  onSearch={onSearchPriest}
                  options={priestOptions}
                  isLoading={isSearchingPriests}
                />
              </div>
              <Field label="Padrino" value={values.padrino} onChange={(v) => update('padrino', v)} />
              <Field label="Madrina" value={values.madrina} onChange={(v) => update('madrina', v)} />
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-600">Anotaciones</label>
                <textarea
                  value={values.anotaciones}
                  onChange={(e) => update('anotaciones', e.target.value)}
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
