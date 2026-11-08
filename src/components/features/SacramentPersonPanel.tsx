import type { Person } from '../../../shared/models';
import { BirthDateOrApproximate } from '../ui/BirthDateOrApproximate';
import { Field } from '../ui/Field';
import { FormPanel } from '../ui/FormPanel';

interface SacramentPersonPanelProps {
  persona: Person;
  onChange: (changes: Partial<Person>) => void;
}

export function SacramentPersonPanel({ persona, onChange }: SacramentPersonPanelProps) {
  return (
    <FormPanel title="Datos personales">
      <Field variant="panel" label="DNI" value={persona.dni ?? ''} onChange={(v) => onChange({ dni: v })} />
      <Field variant="panel" label="Nombres" required value={persona.nombres} onChange={(v) => onChange({ nombres: v })} />
      <div className="grid grid-cols-2 gap-2">
        <Field variant="panel" label="Apellido paterno" required value={persona.apellido_paterno} onChange={(v) => onChange({ apellido_paterno: v })} />
        <Field variant="panel" label="Apellido materno" required value={persona.apellido_materno} onChange={(v) => onChange({ apellido_materno: v })} />
      </div>
      <BirthDateOrApproximate
        label="Fecha de nacimiento"
        required
        fecha={persona.fecha_nacimiento}
        fechaAproximada={persona.fecha_aproximada}
        onChange={({ fecha, fechaAproximada }) => onChange({ fecha_nacimiento: fecha, fecha_aproximada: fechaAproximada })}
      />
      <Field variant="panel" label="Lugar de nacimiento" required value={persona.lugar_nacimiento ?? ''} onChange={(v) => onChange({ lugar_nacimiento: v })} />
      <Field variant="panel" label="Padre" required value={persona.padre ?? ''} onChange={(v) => onChange({ padre: v })} />
      <Field variant="panel" label="Madre" required value={persona.madre ?? ''} onChange={(v) => onChange({ madre: v })} />
    </FormPanel>
  );
}
