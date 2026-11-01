import { Field } from '../ui/Field';

export interface SacramentPersonData {
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

interface SacramentPersonFieldsProps {
  values: SacramentPersonData;
  onChange: (values: SacramentPersonData) => void;
}

export function SacramentPersonFields({ values, onChange }: SacramentPersonFieldsProps) {
  function update<K extends keyof SacramentPersonData>(key: K, value: SacramentPersonData[K]) {
    onChange({ ...values, [key]: value });
  }

  return (
    <section>
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
  );
}
