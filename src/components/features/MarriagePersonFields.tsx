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

interface MarriagePersonFieldsProps {
  label: 'Esposo' | 'Esposa';
  values: PersonMarriageData;
  onChange: (values: PersonMarriageData) => void;
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

export function MarriagePersonFields({ label, values, onChange }: MarriagePersonFieldsProps) {
  function update<K extends keyof PersonMarriageData>(key: K, value: PersonMarriageData[K]) {
    onChange({ ...values, [key]: value });
  }

  return (
    <div className="rounded-lg bg-purple-50 p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">Datos personales — {label}</h3>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label={`Nombre ${label.toLowerCase()}`} value={values.nombre} onChange={(v) => update('nombre', v)} />
        <Field label="Apellido paterno" value={values.apellidoPaterno} onChange={(v) => update('apellidoPaterno', v)} />
        <Field label="Apellido materno" value={values.apellidoMaterno} onChange={(v) => update('apellidoMaterno', v)} />

        <Field label="Lugar de nacimiento" value={values.lugarNacimiento} onChange={(v) => update('lugarNacimiento', v)} />
        <Field label="Fecha de nacimiento" type="date" value={values.fechaNacimiento} onChange={(v) => update('fechaNacimiento', v)} />

        <Field label="Parroquia de bautismo" value={values.parroquiaBautismo} onChange={(v) => update('parroquiaBautismo', v)} />
        <Field label="Fecha de bautismo" type="date" value={values.fechaBautismo} onChange={(v) => update('fechaBautismo', v)} />
      </div>

      <h4 className="mb-2 mt-4 text-sm font-semibold text-slate-700">Familiares</h4>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Nombre padre" value={values.padreNombre} onChange={(v) => update('padreNombre', v)} />
        <Field label="Apellido padre" value={values.padreApellido} onChange={(v) => update('padreApellido', v)} />
        <Field label="DNI padre" value={values.padreDni} onChange={(v) => update('padreDni', v)} />

        <Field label="Nombre madre" value={values.madreNombre} onChange={(v) => update('madreNombre', v)} />
        <Field label="Apellido madre" value={values.madreApellido} onChange={(v) => update('madreApellido', v)} />
        <Field label="DNI madre" value={values.madreDni} onChange={(v) => update('madreDni', v)} />
      </div>
    </div>
  );
}
