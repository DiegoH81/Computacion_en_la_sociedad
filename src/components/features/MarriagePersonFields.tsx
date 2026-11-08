import type { Marriage, Person } from '../../../shared/models';
import { BirthDateOrApproximate } from '../ui/BirthDateOrApproximate';
import { DateSelect } from '../ui/DateSelect';
import { FormInput } from '../ui/FormInput';
import { MirroredColumnTitles, MirroredFormRow } from '../ui/MirroredFormRow';

/** Los datos de texto de una persona que se escriben en una fila (esposo a la izquierda, esposa a la derecha). */
type TextField = 'dni' | 'nombres' | 'apellido_paterno' | 'apellido_materno' | 'lugar_nacimiento' | 'padre' | 'madre';

interface SpousesProps {
  marriage: Marriage;
  onChange: (marriage: Marriage) => void;
}

function updatePerson(props: SpousesProps, spouse: 'conyuge_1' | 'conyuge_2', changes: Partial<Person>) {
  props.onChange({ ...props.marriage, [spouse]: { ...props.marriage[spouse], ...changes } });
}

function TextRow(props: SpousesProps & { label: string; field: TextField; required?: boolean }) {
  const { label, field, marriage, required = false } = props;

  return (
    <MirroredFormRow
      label={label}
      required={required}
      left={
        <FormInput
          aria-label={`${label} del esposo`}
          value={marriage.conyuge_1[field] ?? ''}
          onChange={(e) => updatePerson(props, 'conyuge_1', { [field]: e.target.value })}
        />
      }
      right={
        <FormInput
          aria-label={`${label} de la esposa`}
          value={marriage.conyuge_2[field] ?? ''}
          onChange={(e) => updatePerson(props, 'conyuge_2', { [field]: e.target.value })}
        />
      }
    />
  );
}

export function MarriagePersonFields(props: SpousesProps) {
  const { marriage, onChange } = props;

  return (
    <div className="flex flex-col gap-2">
      <MirroredColumnTitles left="Esposo" right="Esposa" />
      <TextRow {...props} label="DNI" field="dni" />
      <TextRow {...props} label="Nombres" field="nombres" required />
      <TextRow {...props} label="Apellido paterno" field="apellido_paterno" required />
      <TextRow {...props} label="Apellido materno" field="apellido_materno" required />
      <TextRow {...props} label="Lugar de nacimiento" field="lugar_nacimiento" required />
      <MirroredFormRow
        label="Fecha de nacimiento"
        required
        left={
          <BirthDateOrApproximate
            personLabel="del esposo"
            fecha={marriage.conyuge_1.fecha_nacimiento}
            fechaAproximada={marriage.conyuge_1.fecha_aproximada}
            onChange={({ fecha, fechaAproximada }) => updatePerson(props, 'conyuge_1', { fecha_nacimiento: fecha, fecha_aproximada: fechaAproximada })}
          />
        }
        right={
          <BirthDateOrApproximate
            personLabel="de la esposa"
            fecha={marriage.conyuge_2.fecha_nacimiento}
            fechaAproximada={marriage.conyuge_2.fecha_aproximada}
            onChange={({ fecha, fechaAproximada }) => updatePerson(props, 'conyuge_2', { fecha_nacimiento: fecha, fecha_aproximada: fechaAproximada })}
          />
        }
      />
      <MirroredFormRow
        label="Parroquia de bautismo"
        left={
          <FormInput
            aria-label="Parroquia de bautismo del esposo"
            value={marriage.conyuge_1_bautismo_parroquia ?? ''}
            onChange={(e) => onChange({ ...marriage, conyuge_1_bautismo_parroquia: e.target.value })}
          />
        }
        right={
          <FormInput
            aria-label="Parroquia de bautismo de la esposa"
            value={marriage.conyuge_2_bautismo_parroquia ?? ''}
            onChange={(e) => onChange({ ...marriage, conyuge_2_bautismo_parroquia: e.target.value })}
          />
        }
      />
      <MirroredFormRow
        label="Fecha de bautismo"
        left={
          <DateSelect
            ariaLabel="Fecha de bautismo del esposo"
            value={marriage.conyuge_1_bautismo_fecha ?? ''}
            onChange={(value) => onChange({ ...marriage, conyuge_1_bautismo_fecha: value })}
          />
        }
        right={
          <DateSelect
            ariaLabel="Fecha de bautismo de la esposa"
            value={marriage.conyuge_2_bautismo_fecha ?? ''}
            onChange={(value) => onChange({ ...marriage, conyuge_2_bautismo_fecha: value })}
          />
        }
      />
    </div>
  );
}

export function MarriageFamilyFields(props: SpousesProps) {
  return (
    <div className="flex flex-col gap-2">
      <MirroredColumnTitles left="Esposo" right="Esposa" />
      <TextRow {...props} label="Padre" field="padre" required />
      <TextRow {...props} label="Madre" field="madre" required />
    </div>
  );
}
