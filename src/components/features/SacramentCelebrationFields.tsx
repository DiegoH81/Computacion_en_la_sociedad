import { Field } from '../ui/Field';
import { PriestSelector } from './PriestSelector';

export interface SacramentCelebrationData {
  fechaCelebracion: string;
  celebranteId: number | null;
  padrino: string;
  madrina: string;
  anotaciones: string;
}

interface PriestOption {
  id: number;
  nombreCompleto: string;
  parroquiaNombre: string;
}

interface SacramentCelebrationFieldsProps {
  title: string; // ej. "Datos de bautismo" o "Datos de confirmación"
  fechaLabel: string; // ej. "Fecha del bautizo" o "Fecha de confirmación"
  values: SacramentCelebrationData;
  onChange: (values: SacramentCelebrationData) => void;
  priestOptions: PriestOption[];
  onSearchPriest: (query: string) => void;
  isSearchingPriests: boolean;
}

export function SacramentCelebrationFields({
  title,
  fechaLabel,
  values,
  onChange,
  priestOptions,
  onSearchPriest,
  isSearchingPriests,
}: SacramentCelebrationFieldsProps) {
  function update<K extends keyof SacramentCelebrationData>(
    key: K,
    value: SacramentCelebrationData[K],
  ) {
    onChange({ ...values, [key]: value });
  }

  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold text-slate-700">{title}</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field
          label={fechaLabel}
          type="date"
          value={values.fechaCelebracion}
          onChange={(v) => update('fechaCelebracion', v)}
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
  );
}
