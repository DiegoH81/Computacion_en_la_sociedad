import type { Sacrament } from '../../../shared/models';
import { Field } from '../ui/Field';
import { FormPanel } from '../ui/FormPanel';

interface SacramentRegisterPanelProps {
  sacramento: Sacrament;
  onChange: (changes: Partial<Sacrament>) => void;
  parroquiaNombre: string;
}

function formatTimestamp(iso: string | undefined): string {
  return iso ? new Date(iso).toLocaleString('es-PE') : '';
}

function RecordDate({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-end gap-2 text-xs font-semibold text-slate-800">
      <span>{label}</span>
      <span className="min-h-5 w-44 rounded bg-white px-2 py-0.5 font-normal">{value}</span>
    </div>
  );
}

/** Dónde está la partida en el libro: fecha del registro, libro, folio y número. */
export function SacramentRegisterPanel({ sacramento, onChange, parroquiaNombre }: SacramentRegisterPanelProps) {
  return (
    <FormPanel>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field variant="panelTitle" label="Parroquia" value={parroquiaNombre} />
        <Field
          variant="panelTitle"
          label="Fecha del sacramento"
          type="date"
          value={sacramento.fecha_emision ?? ''}
          onChange={(v) => onChange({ fecha_emision: v || null })}
        />
        <div className="grid grid-cols-3 gap-2">
          <Field variant="panelTitle" label="N° de libro" value={sacramento.libro} onChange={(v) => onChange({ libro: v })} />
          <Field variant="panelTitle" label="N° de folio" value={sacramento.folio} onChange={(v) => onChange({ folio: v })} />
          <Field variant="panelTitle" label="N° de registro" value={sacramento.numero} onChange={(v) => onChange({ numero: v })} />
        </div>
        <div className="flex flex-col justify-end gap-1">
          <RecordDate label="Creado en:" value={formatTimestamp(sacramento.created_at)} />
          <RecordDate label="Última modificación:" value={formatTimestamp(sacramento.updated_at)} />
        </div>
      </div>
    </FormPanel>
  );
}
