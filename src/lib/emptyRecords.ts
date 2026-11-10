import type { Baptism, Marriage, Minister, Person, Sacrament } from '../../shared/models';
import type { SacramentType } from '../../shared/sync';
import { todayIsoDate } from './dates';


export function emptyPerson(): Person {
  return {
    dni: null,
    nombres: '',
    apellido_paterno: '',
    apellido_materno: '',
    fecha_nacimiento: null,
    fecha_aproximada: null,
    lugar_nacimiento: null,
    padre: null,
    madre: null,
    cambios: [],
  };
}

export function emptySacrament(tipo: SacramentType): Sacrament {
  return {
    tipo,
    ministro_id: null,
    libro: '',
    folio: '',
    numero: '',
    fecha_emision: todayIsoDate(),
    fecha_evento: null,
    anotaciones: null,
  };
}

export function emptyBaptism(tipo: 'bautismo' | 'confirmacion'): Baptism {
  return { sacramento: emptySacrament(tipo), persona: emptyPerson(), padrino_1: null, padrino_2: null };
}

export function emptyMarriage(): Marriage {
  return {
    sacramento: emptySacrament('matrimonio'),
    conyuge_1: emptyPerson(),
    conyuge_2: emptyPerson(),
    lugar: null,
    testigo_1: null,
    testigo_2: null,
    testigo_3: null,
    testigo_4: null,
    conyuge_1_bautismo_parroquia: null,
    conyuge_1_bautismo_fecha: null,
    conyuge_2_bautismo_parroquia: null,
    conyuge_2_bautismo_fecha: null,
  };
}

export function emptyMinister(): Minister {
  return { titulo: null, nombre: '', apellido_paterno: '', apellido_materno: '' };
}
