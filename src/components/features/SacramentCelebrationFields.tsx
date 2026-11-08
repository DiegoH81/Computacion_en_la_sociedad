import type { Baptism, Minister } from '../../../shared/models';
import { DateSelect } from '../ui/DateSelect';
import { Field } from '../ui/Field';
import { FormPanel } from '../ui/FormPanel';
import { StackedFormField } from '../ui/StackedFormField';
import { MarginalNotesButton } from './MarginalNotesButton';
import { PriestSelector } from './PriestSelector';

interface SacramentCelebrationFieldsProps {
  title: string; // ej. "Datos de bautismo" o "Datos de confirmación"
  fechaLabel: string; // ej. "Fecha de bautizo" o "Fecha de confirmación"
  record: Baptism;
  onChange: (record: Baptism) => void;
  priestOptions: Minister[];
  onSearchPriest: (query: string) => void;
  isSearchingPriests: boolean;
  notesOpen: boolean;
  onToggleNotes: () => void;
}

/** La celebración de un bautismo o una confirmación: fecha, celebrante y padrinos. */
export function SacramentCelebrationFields({
  title,
  fechaLabel,
  record,
  onChange,
  priestOptions,
  onSearchPriest,
  isSearchingPriests,
  notesOpen,
  onToggleNotes,
}: SacramentCelebrationFieldsProps) {
  const sacramento = record.sacramento;

  return (
    <FormPanel title={title}>
      <StackedFormField label={fechaLabel} isGroup>
        <DateSelect
          ariaLabel={fechaLabel}
          value={sacramento.fecha_evento ?? ''}
          onChange={(v) => onChange({ ...record, sacramento: { ...sacramento, fecha_evento: v } })}
        />
      </StackedFormField>
      <StackedFormField label="Celebrante" required>
        <PriestSelector
          value={sacramento.ministro_id}
          onSelect={(id) => onChange({ ...record, sacramento: { ...sacramento, ministro_id: id } })}
          onSearch={onSearchPriest}
          options={priestOptions}
          isLoading={isSearchingPriests}
        />
      </StackedFormField>
      <Field variant="panel" label="Padrino" value={record.padrino_1 ?? ''} onChange={(v) => onChange({ ...record, padrino_1: v })} />
      <Field variant="panel" label="Madrina" value={record.padrino_2 ?? ''} onChange={(v) => onChange({ ...record, padrino_2: v })} />
      <div className="mt-auto pt-3">
        <MarginalNotesButton isOpen={notesOpen} onToggle={onToggleNotes} />
      </div>
    </FormPanel>
  );
}
