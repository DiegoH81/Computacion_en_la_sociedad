import type { LocalDatabase } from '../localDb/database';
import type { SacramentType } from './common';

const SACRAMENTS: SacramentType[] = ['bautismo', 'confirmacion', 'matrimonio'];
const TREND_YEARS = 10;
const TOP_MINISTERS = 8;

// La fecha de la celebración, o la del registro si la partida no la indica.
const EVENT_DATE = 'COALESCE(s.fecha_evento, s.fecha_emision)';
const VALID_DATE = `${EVENT_DATE} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]*'`;

export const AGE_BANDS = [
  { label: 'Menos de 1 año', to: 0 },
  { label: '1 a 6 años', to: 6 },
  { label: '7 a 12 años', to: 12 },
  { label: '13 a 17 años', to: 17 },
  { label: '18 a 29 años', to: 29 },
  { label: '30 a 49 años', to: 49 },
  { label: '50 años o más', to: Infinity },
];

type BySacrament = Record<SacramentType, number>;

const emptyCounts = (): BySacrament => ({ bautismo: 0, confirmacion: 0, matrimonio: 0 });

/** Edad cumplida en la fecha del sacramento, o null si los datos no son coherentes. */
export function ageAt(birth: string | null, event: string): number | null {
  const birthDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birth ?? '');
  const eventDate = /^(\d{4})-(\d{2})-(\d{2})/.exec(event);
  if (!birthDate || !eventDate) return null;

  const hadBirthday = eventDate[2] + eventDate[3] >= birthDate[2] + birthDate[3];
  const age = Number(eventDate[1]) - Number(birthDate[1]) - (hadBirthday ? 0 : 1);
  return age >= 0 && age <= 130 ? age : null;
}

export function getStatistics(db: LocalDatabase, parroquiaId: number, requestedYear: unknown, now = new Date()) {
  const currentYear = now.getFullYear();
  const pad = (value: number) => String(value).padStart(2, '0');
  const currentMonth = pad(now.getMonth() + 1);
  const today = `${currentMonth}-${pad(now.getDate())}`;

  const yearRows = db
    .prepare(
      `SELECT DISTINCT CAST(substr(${EVENT_DATE}, 1, 4) AS INTEGER) AS year
       FROM sacramentos s WHERE s.parroquia_id = ? AND s.estado = 'vigente' AND ${VALID_DATE}`,
    )
    .pluck()
    .all(parroquiaId) as number[];
  const years = [...new Set([...yearRows, currentYear])].sort((a, b) => b - a);
  const year = years.includes(requestedYear as number) ? (requestedYear as number) : currentYear;
  const isCurrentYear = year === currentYear;

  /** Partidas vigentes por sacramento entre dos fechas (texto AAAA-MM-DD, ambas incluidas). */
  const countBetween = (from: string, to: string): BySacrament => {
    const counts = emptyCounts();
    const rows = db
      .prepare(
        `SELECT s.tipo, COUNT(*) AS total FROM sacramentos s
         WHERE s.parroquia_id = ? AND s.estado = 'vigente' AND ${VALID_DATE}
           AND substr(${EVENT_DATE}, 1, 10) BETWEEN ? AND ?
         GROUP BY s.tipo`,
      )
      .all(parroquiaId, from, to) as { tipo: SacramentType; total: number }[];
    for (const { tipo, total } of rows) counts[tipo] = total;
    return counts;
  };

  // Un año en curso solo se compara con el mismo tramo del año anterior: con el año completo
  // siempre parecería una caída.
  const periodEnd = isCurrentYear ? today : '12-31';
  const selected = countBetween(`${year}-01-01`, `${year}-12-31`);
  const previous = countBetween(`${year - 1}-01-01`, `${year - 1}-${periodEnd}`);
  const thisMonth = countBetween(`${currentYear}-${currentMonth}-01`, `${currentYear}-${currentMonth}-31`);
  const allTime = countBetween('0000-01-01', '9999-12-31');

  const totals = Object.fromEntries(
    SACRAMENTS.map((tipo) => [
      tipo,
      { anio: selected[tipo], anterior: previous[tipo], mes: thisMonth[tipo], historico: allTime[tipo] },
    ]),
  ) as Record<SacramentType, { anio: number; anterior: number; mes: number; historico: number }>;

  const monthly = Array.from({ length: 12 }, (_, index) => ({ mes: index + 1, ...emptyCounts() }));
  const monthRows = db
    .prepare(
      `SELECT s.tipo, CAST(substr(${EVENT_DATE}, 6, 2) AS INTEGER) AS mes, COUNT(*) AS total
       FROM sacramentos s
       WHERE s.parroquia_id = ? AND s.estado = 'vigente' AND ${VALID_DATE} AND substr(${EVENT_DATE}, 1, 4) = ?
       GROUP BY s.tipo, mes`,
    )
    .all(parroquiaId, String(year)) as { tipo: SacramentType; mes: number; total: number }[];
  for (const { tipo, mes, total } of monthRows) {
    if (monthly[mes - 1]) monthly[mes - 1][tipo] = total;
  }

  const firstYear = Math.max(Math.min(...years), year - TREND_YEARS + 1);
  const trend = Array.from({ length: year - firstYear + 1 }, (_, index) => ({ anio: firstYear + index, ...emptyCounts() }));
  const trendRows = db
    .prepare(
      `SELECT s.tipo, CAST(substr(${EVENT_DATE}, 1, 4) AS INTEGER) AS anio, COUNT(*) AS total
       FROM sacramentos s
       WHERE s.parroquia_id = ? AND s.estado = 'vigente' AND ${VALID_DATE}
       GROUP BY s.tipo, anio`,
    )
    .all(parroquiaId) as { tipo: SacramentType; anio: number; total: number }[];
  for (const { tipo, anio, total } of trendRows) {
    const point = trend.find((row) => row.anio === anio);
    if (point) point[tipo] = total;
  }

  const people = db
    .prepare(
      `SELECT s.tipo, ${EVENT_DATE} AS fecha, pe.fecha_nacimiento, pe.edad
       FROM (
         SELECT sacramento_id, persona_id FROM bautismos
         UNION ALL SELECT sacramento_id, persona_id FROM confirmaciones
         UNION ALL SELECT sacramento_id, conyuge_1_id FROM matrimonios
         UNION ALL SELECT sacramento_id, conyuge_2_id FROM matrimonios
       ) sub
       JOIN sacramentos s ON s.id = sub.sacramento_id
       JOIN personas pe ON pe.id = sub.persona_id
       WHERE s.parroquia_id = ? AND s.estado = 'vigente' AND ${VALID_DATE} AND substr(${EVENT_DATE}, 1, 4) = ?`,
    )
    .all(parroquiaId, String(year)) as {
    tipo: SacramentType;
    fecha: string;
    fecha_nacimiento: string | null;
    edad: number | null;
  }[];

  const ageGroups = Object.fromEntries(
    SACRAMENTS.map((tipo) => [tipo, { bandas: AGE_BANDS.map(() => 0), suma: 0, conEdad: 0, sinDato: 0 }]),
  ) as Record<SacramentType, { bandas: number[]; suma: number; conEdad: number; sinDato: number }>;
  for (const { tipo, fecha, fecha_nacimiento, edad } of people) {
    const age = ageAt(fecha_nacimiento, fecha) ?? edad;
    const group = ageGroups[tipo];
    if (age === null) {
      group.sinDato += 1;
      continue;
    }
    group.bandas[AGE_BANDS.findIndex((band) => age <= band.to)] += 1;
    group.suma += age;
    group.conEdad += 1;
  }
  const edades = Object.fromEntries(
    SACRAMENTS.map((tipo) => {
      const { bandas, suma, conEdad, sinDato } = ageGroups[tipo];
      return [tipo, { bandas, sinDato, promedio: conEdad > 0 ? Math.round((suma / conEdad) * 10) / 10 : null }];
    }),
  ) as Record<SacramentType, { bandas: number[]; sinDato: number; promedio: number | null }>;

  const ministros = db
    .prepare(
      `SELECT min.nombre || ' ' || min.apellido_paterno || ' ' || min.apellido_materno AS nombre, COUNT(*) AS total
       FROM sacramentos s JOIN ministros min ON min.id = s.ministro_id
       WHERE s.parroquia_id = ? AND s.estado = 'vigente' AND ${VALID_DATE} AND substr(${EVENT_DATE}, 1, 4) = ?
       GROUP BY min.id ORDER BY total DESC, nombre LIMIT ?`,
    )
    .all(parroquiaId, String(year), TOP_MINISTERS) as { nombre: string; total: number }[];

  const registro = db
    .prepare(
      `SELECT
         COALESCE(SUM(s.estado = 'anulado'), 0) AS anuladas,
         COALESCE(SUM(s.estado = 'vigente' AND s.ministro_id IS NULL), 0) AS sinCelebrante,
         COALESCE(SUM(s.estado = 'vigente' AND EXISTS (SELECT 1 FROM cambios_persona c WHERE c.sacramento_id = s.id)), 0) AS conCorrecciones
       FROM sacramentos s
       WHERE s.parroquia_id = ? AND ${VALID_DATE} AND substr(${EVENT_DATE}, 1, 4) = ?`,
    )
    .get(parroquiaId, String(year)) as { anuladas: number; sinCelebrante: number; conCorrecciones: number };

  return {
    anios: years,
    anio: year,
    esAnioActual: isCurrentYear,
    totales: totals,
    mensual: monthly,
    tendencia: trend,
    bandasEdad: AGE_BANDS.map((band) => band.label),
    edades,
    ministros,
    registro,
  };
}
