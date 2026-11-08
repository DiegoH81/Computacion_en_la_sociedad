import type { Baptism, Marriage, Minister, Person } from '../../shared/models';
import { formatLongDate } from './dates';

/** Texto para imprimir: lo que no se llenó queda vacío. */
export const printText = (value: unknown): string => (value === null || value === undefined ? '' : String(value));

export function fullName(...parts: unknown[]): string {
  return parts.map(printText).filter(Boolean).join(' ');
}

/** La partida física puede traer la fecha de nacimiento o solo una fecha aproximada (texto libre). */
export function birthValue(fecha: string | null, fechaAproximada: string | null): string {
  const date = formatLongDate(printText(fecha));
  if (date) return date;
  return fechaAproximada ?? '';
}

/** "Pbro. Manuel Torres Rios", o vacío si la partida no tiene celebrante. */
export function celebrantName(ministro: Minister | null | undefined): string {
  if (!ministro) return '';
  return fullName(ministro.titulo, ministro.nombre, ministro.apellido_paterno, ministro.apellido_materno);
}

// ---------------------------------------------------------------------------
// Los datos para imprimir sobre el formato (ver printLayouts.ts): uno por cada lugar del formato.
// ---------------------------------------------------------------------------

const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'];

/** La fecha del párroco ("__ de ______ de 20__") con la fecha en que se imprime. */
export function printDateParts(today: Date = new Date()): Record<'dia' | 'mes' | 'anio', string> {
  return {
    dia: String(today.getDate()),
    mes: MONTH_NAMES[today.getMonth()],
    anio: String(today.getFullYear()).slice(2),
  };
}

/** Bautismo o confirmación. */
export function baptismPrintValues(record: Baptism, today?: Date): Record<string, string> {
  const { sacramento: partida, persona } = record;
  return {
    parroquia: printText(partida.parroquia?.nombre),
    libro: printText(partida.libro),
    folio: printText(partida.folio),
    numero: printText(partida.numero),
    anotaciones: printText(partida.anotaciones),
    nombres: printText(persona.nombres),
    apellidos: fullName(persona.apellido_paterno, persona.apellido_materno),
    padre: printText(persona.padre),
    madre: printText(persona.madre),
    lugar_nacimiento: printText(persona.lugar_nacimiento),
    fecha_nacimiento: birthValue(persona.fecha_nacimiento, persona.fecha_aproximada),
    fecha_sacramento: formatLongDate(printText(partida.fecha_evento)),
    celebrante: celebrantName(partida.ministro),
    padrino: printText(record.padrino_1),
    madrina: printText(record.padrino_2),
    ...printDateParts(today),
  };
}

export function marriagePrintValues(record: Marriage, today?: Date): Record<string, string> {
  const partida = record.sacramento;
  const spouse = (prefix: 'esposo' | 'esposa', person: Person, baptismParish: string | null, baptismDate: string | null) => ({
    [`${prefix}_apellidos`]: fullName(person.apellido_paterno, person.apellido_materno),
    [`${prefix}_nombres`]: printText(person.nombres),
    [`${prefix}_lugar_nacimiento`]: printText(person.lugar_nacimiento),
    [`${prefix}_fecha_nacimiento`]: birthValue(person.fecha_nacimiento, person.fecha_aproximada),
    [`${prefix}_dni`]: printText(person.dni),
    [`${prefix}_parroquia_bautismo`]: printText(baptismParish),
    [`${prefix}_fecha_bautismo`]: formatLongDate(printText(baptismDate)),
    [`${prefix}_padre`]: printText(person.padre),
    [`${prefix}_madre`]: printText(person.madre),
  });

  return {
    parroquia: printText(partida.parroquia?.nombre),
    libro: printText(partida.libro),
    folio: printText(partida.folio),
    numero: printText(partida.numero),
    ...spouse('esposo', record.conyuge_1, record.conyuge_1_bautismo_parroquia, record.conyuge_1_bautismo_fecha),
    ...spouse('esposa', record.conyuge_2, record.conyuge_2_bautismo_parroquia, record.conyuge_2_bautismo_fecha),
    fecha_matrimonio: formatLongDate(printText(partida.fecha_evento)),
    celebrante: celebrantName(partida.ministro),
    lugar: printText(record.lugar),
    // Los cuatro testigos van juntos en "Testigos"; "Padrinos" queda vacío.
    testigos: [record.testigo_1, record.testigo_2, record.testigo_3, record.testigo_4].filter(Boolean).join(', '),
    anotaciones: printText(partida.anotaciones),
    ...printDateParts(today),
  };
}
