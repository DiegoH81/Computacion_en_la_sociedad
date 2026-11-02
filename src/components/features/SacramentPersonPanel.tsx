import { BirthDateOrAge } from '../ui/BirthDateOrAge';
import { Field } from '../ui/Field';
import { FormPanel } from '../ui/FormPanel';

export interface SacramentPersonPanelData {
  dni: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  fechaNacimiento: string;
  edad: string;
  lugarNacimiento: string;
  padreNombre: string;
  madreNombre: string;
}

interface SacramentPersonPanelProps {
  values: SacramentPersonPanelData;
  onChange: (values: Partial<SacramentPersonPanelData>) => void;
}

export function SacramentPersonPanel({ values, onChange }: SacramentPersonPanelProps) {
  return (
    <FormPanel title="Datos personales">
      <Field variant="panel" label="DNI" value={values.dni} onChange={(v) => onChange({ dni: v })} />
      <Field variant="panel" label="Nombres" value={values.nombre} onChange={(v) => onChange({ nombre: v })} />
      <div className="grid grid-cols-2 gap-2">
        <Field variant="panel" label="Apellido paterno" value={values.apellidoPaterno} onChange={(v) => onChange({ apellidoPaterno: v })} />
        <Field variant="panel" label="Apellido materno" value={values.apellidoMaterno} onChange={(v) => onChange({ apellidoMaterno: v })} />
      </div>
      <BirthDateOrAge
        label="Fecha de nacimiento"
        fecha={values.fechaNacimiento}
        edad={values.edad}
        onChange={({ fecha, edad }) => onChange({ fechaNacimiento: fecha, edad })}
      />
      <Field variant="panel" label="Lugar de nacimiento" value={values.lugarNacimiento} onChange={(v) => onChange({ lugarNacimiento: v })} />
      <Field variant="panel" label="Padre" value={values.padreNombre} onChange={(v) => onChange({ padreNombre: v })} />
      <Field variant="panel" label="Madre" value={values.madreNombre} onChange={(v) => onChange({ madreNombre: v })} />
    </FormPanel>
  );
}
