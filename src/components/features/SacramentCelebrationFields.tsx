import { DateSelect } from '../ui/DateSelect';
import { Field } from '../ui/Field';
import { FormPanel } from '../ui/FormPanel';
import { StackedFormField } from '../ui/StackedFormField';
import { MarginalNotesButton } from './MarginalNotesButton';
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
  fechaLabel: string; // ej. "Fecha de bautizo" o "Fecha de confirmación"
  values: SacramentCelebrationData;
  onChange: (values: SacramentCelebrationData) => void;
  priestOptions: PriestOption[];
  onSearchPriest: (query: string) => void;
  isSearchingPriests: boolean;
  priestParishId?: number;
  notesOpen: boolean;
  onToggleNotes: () => void;
}

export function SacramentCelebrationFields({
  title,
  fechaLabel,
  values,
  onChange,
  priestOptions,
  onSearchPriest,
  isSearchingPriests,
  priestParishId,
  notesOpen,
  onToggleNotes,
}: SacramentCelebrationFieldsProps) {
  function update<K extends keyof SacramentCelebrationData>(key: K, value: SacramentCelebrationData[K]) {
    onChange({ ...values, [key]: value });
  }

  return (
    <FormPanel title={title}>
      <StackedFormField label={fechaLabel}>
        <DateSelect ariaLabel={fechaLabel} value={values.fechaCelebracion} onChange={(v) => update('fechaCelebracion', v)} />
      </StackedFormField>
      <StackedFormField label="Celebrante">
        <PriestSelector
          value={values.celebranteId}
          onSelect={(id) => update('celebranteId', id)}
          onSearch={onSearchPriest}
          options={priestOptions}
          isLoading={isSearchingPriests}
          parroquiaId={priestParishId}
        />
      </StackedFormField>
      <Field variant="panel" label="Padrino" value={values.padrino} onChange={(v) => update('padrino', v)} />
      <Field variant="panel" label="Madrina" value={values.madrina} onChange={(v) => update('madrina', v)} />
      <div className="mt-auto pt-3">
        <MarginalNotesButton isOpen={notesOpen} onToggle={onToggleNotes} />
      </div>
    </FormPanel>
  );
}
