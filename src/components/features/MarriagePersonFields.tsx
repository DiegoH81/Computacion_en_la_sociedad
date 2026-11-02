import { BirthDateOrAge } from '../ui/BirthDateOrAge';
import { DateSelect } from '../ui/DateSelect';
import { FormInput } from '../ui/FormInput';
import { MirroredColumnTitles, MirroredFormRow } from '../ui/MirroredFormRow';

export interface PersonMarriageData {
  dni: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  lugarNacimiento: string;
  fechaNacimiento: string;
  edad: string;
  parroquiaBautismo: string;
  fechaBautismo: string;
  padreNombre: string;
  madreNombre: string;
}

type TextKey = 'dni' | 'nombre' | 'apellidoPaterno' | 'apellidoMaterno' | 'lugarNacimiento' | 'parroquiaBautismo' | 'padreNombre' | 'madreNombre';

interface SpousesProps {
  esposo: PersonMarriageData;
  esposa: PersonMarriageData;
  onChangeEsposo: (values: PersonMarriageData) => void;
  onChangeEsposa: (values: PersonMarriageData) => void;
}

function TextRow({ label, field, esposo, esposa, onChangeEsposo, onChangeEsposa }: SpousesProps & { label: string; field: TextKey }) {
  return (
    <MirroredFormRow
      label={label}
      left={
        <FormInput
          aria-label={`${label} del esposo`}
          value={esposo[field]}
          onChange={(e) => onChangeEsposo({ ...esposo, [field]: e.target.value })}
        />
      }
      right={
        <FormInput
          aria-label={`${label} de la esposa`}
          value={esposa[field]}
          onChange={(e) => onChangeEsposa({ ...esposa, [field]: e.target.value })}
        />
      }
    />
  );
}

export function MarriagePersonFields(props: SpousesProps) {
  const { esposo, esposa, onChangeEsposo, onChangeEsposa } = props;

  return (
    <div className="flex flex-col gap-2">
      <MirroredColumnTitles left="Esposo" right="Esposa" />
      <TextRow {...props} label="DNI" field="dni" />
      <TextRow {...props} label="Nombres" field="nombre" />
      <TextRow {...props} label="Apellido paterno" field="apellidoPaterno" />
      <TextRow {...props} label="Apellido materno" field="apellidoMaterno" />
      <TextRow {...props} label="Lugar de nacimiento" field="lugarNacimiento" />
      <MirroredFormRow
        label="Fecha de nacimiento"
        left={
          <BirthDateOrAge
            personLabel="del esposo"
            fecha={esposo.fechaNacimiento}
            edad={esposo.edad}
            onChange={({ fecha, edad }) => onChangeEsposo({ ...esposo, fechaNacimiento: fecha, edad })}
          />
        }
        right={
          <BirthDateOrAge
            personLabel="de la esposa"
            fecha={esposa.fechaNacimiento}
            edad={esposa.edad}
            onChange={({ fecha, edad }) => onChangeEsposa({ ...esposa, fechaNacimiento: fecha, edad })}
          />
        }
      />
      <TextRow {...props} label="Parroquia de bautismo" field="parroquiaBautismo" />
      <MirroredFormRow
        label="Fecha de bautismo"
        left={
          <DateSelect
            ariaLabel="Fecha de bautismo del esposo"
            value={esposo.fechaBautismo}
            onChange={(value) => onChangeEsposo({ ...esposo, fechaBautismo: value })}
          />
        }
        right={
          <DateSelect
            ariaLabel="Fecha de bautismo de la esposa"
            value={esposa.fechaBautismo}
            onChange={(value) => onChangeEsposa({ ...esposa, fechaBautismo: value })}
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
      <TextRow {...props} label="Padre" field="padreNombre" />
      <TextRow {...props} label="Madre" field="madreNombre" />
    </div>
  );
}
