import { Field } from '../ui/Field';
import { FormPanel } from '../ui/FormPanel';

export interface SacramentRegisterData {
  fechaSacramento: string;
  numeroLibro: string;
  numeroFolio: string;
  numeroRegistro: string;
}

export interface SacramentRecordInfo {
  parroquiaNombre: string;
  creadoEn: string;
  modificadoEn: string;
}

interface SacramentRegisterPanelProps {
  values: SacramentRegisterData;
  onChange: (values: Partial<SacramentRegisterData>) => void;
  parroquiaNombre: string;
  recordInfo?: SacramentRecordInfo;
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

export function SacramentRegisterPanel({ values, onChange, parroquiaNombre, recordInfo }: SacramentRegisterPanelProps) {
  return (
    <FormPanel>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field variant="panelTitle" label="Parroquia" value={parroquiaNombre} />
        <Field
          variant="panelTitle"
          label="Fecha del sacramento"
          type="date"
          value={values.fechaSacramento}
          onChange={(v) => onChange({ fechaSacramento: v })}
        />
        <div className="grid grid-cols-3 gap-2">
          <Field variant="panelTitle" label="N° de libro" value={values.numeroLibro} onChange={(v) => onChange({ numeroLibro: v })} />
          <Field variant="panelTitle" label="N° de folio" value={values.numeroFolio} onChange={(v) => onChange({ numeroFolio: v })} />
          <Field variant="panelTitle" label="N° de registro" value={values.numeroRegistro} onChange={(v) => onChange({ numeroRegistro: v })} />
        </div>
        <div className="flex flex-col justify-end gap-1">
          <RecordDate label="Creado en:" value={formatTimestamp(recordInfo?.creadoEn)} />
          <RecordDate label="Última modificación:" value={formatTimestamp(recordInfo?.modificadoEn)} />
        </div>
      </div>
    </FormPanel>
  );
}
