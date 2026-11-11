import type { Person } from '../../../shared/models';

export function duplicateQuery(para: string, person: Person) {
  return {
    para,
    dni: person.dni,
    nombres: person.nombres,
    apellido_paterno: person.apellido_paterno,
    apellido_materno: person.apellido_materno,
    fecha_nacimiento: person.fecha_nacimiento,
    padre: person.padre,
    madre: person.madre,
  };
}

