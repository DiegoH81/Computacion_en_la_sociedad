import type { RefObject } from 'react';
import {
  recordedLabel,
  type CorrectionDraft,
  type CorrectionOption,
  type RecordedCorrection,
} from '../../lib/personCorrections';
import { FORM_CONTROL_CLASS, FormInput } from '../ui/FormInput';
import { FormPanel } from '../ui/FormPanel';
import { StackedFormField } from '../ui/StackedFormField';

interface MarginalNotesSectionProps {
  sectionRef: RefObject<HTMLElement | null>;
  notes: string;
  onNotesChange: (notes: string) => void;
  options: CorrectionOption[];
  corrections: CorrectionDraft[];
  onCorrectionsChange: (corrections: CorrectionDraft[]) => void;
  recorded?: RecordedCorrection[];
}

export function MarginalNotesSection({
  sectionRef,
  notes,
  onNotesChange,
  options,
  corrections,
  onCorrectionsChange,
  recorded = [],
}: MarginalNotesSectionProps) {
  const usedByOthers = (id: string) => corrections.filter((row) => row.id !== id).map((row) => row.field);
  const nextFree = options.find((option) => !corrections.some((row) => row.field === option.key));

  function addRow() {
    if (!nextFree) return;
    onCorrectionsChange([...corrections, { id: crypto.randomUUID(), field: nextFree.key, valorNuevo: '' }]);
  }

  function updateRow(id: string, changes: Partial<CorrectionDraft>) {
    onCorrectionsChange(corrections.map((row) => (row.id === id ? { ...row, ...changes } : row)));
  }

  return (
    <section ref={sectionRef} aria-label="Anotaciones marginales" className="flex flex-col gap-3">
      <h3 className="rounded-xl bg-black px-5 py-2 font-bold uppercase text-white">Llenar anotaciones marginales</h3>

      <FormPanel>
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-slate-800">Anotaciones</span>
          <textarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-teal-600"
          />
        </label>
      </FormPanel>

      <div className="flex flex-col">
        <div className="self-end rounded-t-xl bg-icon-button-light px-4 py-2">
          <button
            type="button"
            onClick={addRow}
            disabled={!nextFree}
            className="rounded-lg bg-solid-blue px-4 py-1 text-xs font-bold uppercase text-white hover:opacity-90 disabled:opacity-50"
          >
            Añadir campo a modificar
          </button>
        </div>

        <div className="flex flex-col gap-3 rounded-xl rounded-tr-none bg-lighter-green p-4">
          {corrections.length === 0 && (
            <p className="text-sm text-slate-700">Si la nota corrige un dato, añada aquí el campo que cambia.</p>
          )}

          {corrections.map((row) => {
            const available = options.filter((option) => !usedByOthers(row.id).includes(option.key));
            const current = options.find((option) => option.key === row.field);

            return (
              <div key={row.id} className="grid grid-cols-1 gap-3 rounded-lg bg-app/40 p-3 sm:grid-cols-2">
                <div className="flex flex-col items-start gap-2">
                  <div className="w-full">
                    <StackedFormField label="Campo a modificar">
                      <select
                        value={row.field}
                        onChange={(e) => updateRow(row.id, { field: e.target.value })}
                        className={`w-full px-2 py-1.5 ${FORM_CONTROL_CLASS}`}
                      >
                        {available.map((option) => (
                          <option key={option.key} value={option.key}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </StackedFormField>
                  </div>
                  <button
                    type="button"
                    onClick={() => onCorrectionsChange(corrections.filter((other) => other.id !== row.id))}
                    className="rounded-md bg-solid-red px-3 py-1 text-xs font-bold text-white hover:opacity-90"
                  >
                    Quitar
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  <StackedFormField label="Campo antiguo">
                    <FormInput value={current?.currentValue ?? ''} readOnly />
                  </StackedFormField>
                  <StackedFormField label="Campo nuevo">
                    <FormInput value={row.valorNuevo} onChange={(e) => updateRow(row.id, { valorNuevo: e.target.value })} />
                  </StackedFormField>
                </div>
              </div>
            );
          })}

          {recorded.length > 0 && (
            <div>
              <h4 className="mb-1 text-xs font-bold text-slate-800">Cambios ya registrados</h4>
              <ul className="flex flex-col gap-1 text-sm text-slate-800">
                {recorded.map((change, index) => (
                  <li key={index} className="rounded bg-white px-3 py-1">
                    {recordedLabel(change)}: {change.valor_anterior ?? '(vacío)'} → {change.valor_nuevo ?? '(vacío)'}
                    <span className="ml-2 text-xs text-slate-500">
                      {new Date(change.fecha_cambio).toLocaleDateString('es-PE')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
