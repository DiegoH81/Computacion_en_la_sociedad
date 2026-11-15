import type { Baptism, Marriage, Person } from '../../shared/models';
import { short_date as formatShortDate } from '../../shared/partial_date';
import { formatTimestampDate } from './dates';
import { celebrantName, fullName } from './printFields';

// Las columnas que la tabla de partidas muestra a la derecha de "Estado", fuera de la vista
// inicial: el resto de los datos de la partida, para verlos sin abrirla.

interface ExtraColumn<T> {
  header: string;
  render: (row: T) => string;
}

function birth(person: Person): string {
  return formatShortDate(person.fecha_nacimiento) || (person.fecha_aproximada ?? '');
}

function personColumns<T>(who: string, personOf: (row: T) => Person): ExtraColumn<T>[] {
  return [
    { header: `DNI${who}`, render: (row) => personOf(row).dni ?? '' },
    { header: `Fecha de nacimiento${who}`, render: (row) => birth(personOf(row)) },
    { header: `Lugar de nacimiento${who}`, render: (row) => personOf(row).lugar_nacimiento ?? '' },
    { header: `Padre${who}`, render: (row) => personOf(row).padre ?? '' },
    { header: `Madre${who}`, render: (row) => personOf(row).madre ?? '' },
  ];
}

export function baptismExtraColumns(sacramentName: string): ExtraColumn<Baptism>[] {
  return [
    ...personColumns<Baptism>('', (row) => row.persona),
    { header: `Fecha de ${sacramentName}`, render: (row) => formatShortDate(row.sacramento.fecha_evento) },
    { header: 'Celebrante', render: (row) => celebrantName(row.sacramento.ministro) },
    { header: 'Padrino', render: (row) => row.padrino_1 ?? '' },
    { header: 'Madrina', render: (row) => row.padrino_2 ?? '' },
    { header: 'Anotación marginal', render: (row) => row.sacramento.anotaciones ?? '' },
    { header: 'Fecha de registro', render: (row) => formatTimestampDate(row.sacramento.created_at) },
  ];
}

export function marriageExtraColumns(): ExtraColumn<Marriage>[] {
  return [
    ...personColumns<Marriage>(' del esposo', (row) => row.conyuge_1),
    { header: 'Bautismo del esposo', render: (row) => fullName(row.conyuge_1_bautismo_parroquia, formatShortDate(row.conyuge_1_bautismo_fecha)) },
    ...personColumns<Marriage>(' de la esposa', (row) => row.conyuge_2),
    { header: 'Bautismo de la esposa', render: (row) => fullName(row.conyuge_2_bautismo_parroquia, formatShortDate(row.conyuge_2_bautismo_fecha)) },
    { header: 'Fecha de matrimonio', render: (row) => formatShortDate(row.sacramento.fecha_evento) },
    { header: 'Lugar del matrimonio', render: (row) => row.lugar ?? '' },
    { header: 'Celebrante', render: (row) => celebrantName(row.sacramento.ministro) },
    { header: 'Testigos', render: (row) => [row.testigo_1, row.testigo_2, row.testigo_3, row.testigo_4].filter(Boolean).join(', ') },
    { header: 'Anotación marginal', render: (row) => row.sacramento.anotaciones ?? '' },
    { header: 'Fecha de registro', render: (row) => formatTimestampDate(row.sacramento.created_at) },
  ];
}
