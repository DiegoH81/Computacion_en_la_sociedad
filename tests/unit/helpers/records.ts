// Arma los models de shared/models.ts para las pruebas: cada función completa con valores vacíos lo que
// no se indica, así cada prueba escribe solo los datos que le importan.

import type { Baptism, Marriage, Minister, Person, PersonChange, Sacrament } from '../../../shared/models';
import type { SacramentType } from '../../../shared/sync';

export interface BaptismValues {
  sacramento?: Partial<Sacrament>;
  persona?: Partial<Person>;
  padrino_1?: string | null;
  padrino_2?: string | null;
}

export type MarriageValues = Partial<Omit<Marriage, 'sacramento' | 'conyuge_1' | 'conyuge_2'>> & {
  sacramento?: Partial<Sacrament>;
  conyuge_1?: Partial<Person>;
  conyuge_2?: Partial<Person>;
};

export function person(values: Partial<Person> = {}): Person {
  return {
    dni: null,
    nombres: '',
    apellido_paterno: '',
    apellido_materno: '',
    fecha_nacimiento: null,
    edad: null,
    lugar_nacimiento: null,
    padre: null,
    madre: null,
    cambios: [],
    ...values,
  };
}

export function sacrament(tipo: SacramentType, values: Partial<Sacrament> = {}): Sacrament {
  return {
    tipo,
    ministro_id: null,
    libro: '',
    folio: '',
    numero: '',
    fecha_emision: '',
    fecha_evento: null,
    anotaciones: null,
    ...values,
  };
}

export function baptism(tipo: 'bautismo' | 'confirmacion', values: BaptismValues = {}): Baptism {
  return {
    sacramento: sacrament(tipo, values.sacramento),
    persona: person(values.persona),
    padrino_1: values.padrino_1 ?? null,
    padrino_2: values.padrino_2 ?? null,
  };
}

export function marriage(values: MarriageValues = {}): Marriage {
  return {
    lugar: null,
    testigo_1: null,
    testigo_2: null,
    testigo_3: null,
    testigo_4: null,
    conyuge_1_bautismo_parroquia: null,
    conyuge_1_bautismo_fecha: null,
    conyuge_2_bautismo_parroquia: null,
    conyuge_2_bautismo_fecha: null,
    ...values,
    sacramento: sacrament('matrimonio', values.sacramento),
    conyuge_1: person(values.conyuge_1),
    conyuge_2: person(values.conyuge_2),
  };
}

// Una corrección nueva de una nota marginal.
export function change(campo_cambio: PersonChange['campo_cambio'], valor_nuevo: string | null): PersonChange {
  return { campo_cambio, valor_nuevo };
}

export function minister(values: Partial<Minister> = {}): Minister {
  return { titulo: null, nombre: '', apellido_paterno: '', apellido_materno: '', ...values };
}
