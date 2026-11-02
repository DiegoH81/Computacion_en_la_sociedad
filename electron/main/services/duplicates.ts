import type { LocalDatabase } from '../localDb/database';
import { ServiceError, type SacramentType } from './common';

export interface DuplicatePersonInput {
  para?: string;
  dni?: string;
  nombre?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  fechaNacimiento?: string;
  padreNombre?: string;
  madreNombre?: string;
}

export interface DuplicateMatch {
  sacramentoId: number;
  para: string;
  nivel: 'alta' | 'posible';
  porcentaje: number;
  coincide: string[];
  nombreCompleto: string;
  parroquia: string;
  libro: string;
  folio: string;
  numero: string;
}

interface Candidate {
  id: number;
  persona_id: number;
  libro: string;
  folio: string;
  numero: string;
  parroquia: string;
  dni: string | null;
  nombres: string;
  apellido_paterno: string;
  apellido_materno: string;
  fecha_nacimiento: string | null;
  padre: string | null;
  madre: string | null;
}

const MAX_PER_PERSON = 50;
const MIN_PERCENT = 75;
const SIMILAR = 0.75;

const WEIGHTS = {
  dni: 40,
  nombres: 25,
  apellido_paterno: 20,
  apellido_materno: 15,
  fecha_nacimiento: 20,
  padre: 10,
  madre: 10,
} as const;

const LABELS: Record<keyof typeof WEIGHTS, string> = {
  dni: 'DNI',
  nombres: 'Nombres',
  apellido_paterno: 'Apellido paterno',
  apellido_materno: 'Apellido materno',
  fecha_nacimiento: 'Fecha de nacimiento',
  padre: 'Padre',
  madre: 'Madre',
};

const SOURCES: Record<SacramentType, string[]> = {
  bautismo: ['SELECT sacramento_id, persona_id FROM bautismos'],
  confirmacion: ['SELECT sacramento_id, persona_id FROM confirmaciones'],
  matrimonio: [
    'SELECT sacramento_id, conyuge_1_id AS persona_id FROM matrimonios',
    'SELECT sacramento_id, conyuge_2_id AS persona_id FROM matrimonios',
  ],
};

function normalize(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[b.length];
}


export function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;

  const tokensA = a.split(' ');
  const tokensB = b.split(' ');
  const [shorter, longer] = tokensA.length <= tokensB.length ? [tokensA, tokensB] : [tokensB, tokensA];
  if (shorter.every((token) => longer.includes(token))) return 0.85;

  const longest = Math.max(a.length, b.length);

  if (Math.abs(a.length - b.length) / longest > 1 - SIMILAR) return 0;
  const ratio = 1 - editDistance(a, b) / longest;
  return ratio >= SIMILAR ? ratio : 0;
}

type Values = Record<keyof typeof WEIGHTS, string>;

function score(input: Values, candidate: Candidate, previousNames: Map<string, string[]>) {
  const dniComparable = Boolean(input.dni && candidate.dni);
  const sameDni = dniComparable && input.dni === normalize(candidate.dni);

  const fieldSimilarity = (field: keyof typeof WEIGHTS, current: string | null): number => {
    const options = [normalize(current), ...(previousNames.get(`${candidate.persona_id}:${field}`) ?? [])];
    return Math.max(...options.map((option) => similarity(input[field], option)));
  };

  const nameScore = fieldSimilarity('nombres', candidate.nombres);
  const fatherNameScore = fieldSimilarity('apellido_paterno', candidate.apellido_paterno);

  if (!sameDni && (nameScore === 0 || fatherNameScore === 0)) return null;

  const similarities: Record<keyof typeof WEIGHTS, { comparable: boolean; value: number }> = {
    dni: { comparable: dniComparable, value: sameDni ? 1 : 0 },
    nombres: { comparable: Boolean(input.nombres), value: nameScore },
    apellido_paterno: { comparable: Boolean(input.apellido_paterno), value: fatherNameScore },
    apellido_materno: {
      comparable: Boolean(input.apellido_materno && candidate.apellido_materno),
      value: fieldSimilarity('apellido_materno', candidate.apellido_materno),
    },
    fecha_nacimiento: {
      comparable: Boolean(input.fecha_nacimiento && candidate.fecha_nacimiento),
      value: input.fecha_nacimiento === normalize(candidate.fecha_nacimiento) ? 1 : 0,
    },
    padre: { comparable: Boolean(input.padre && candidate.padre), value: similarity(input.padre, normalize(candidate.padre)) },
    madre: { comparable: Boolean(input.madre && candidate.madre), value: similarity(input.madre, normalize(candidate.madre)) },
  };

  let obtained = 0;
  let possible = 0;
  const coincide: string[] = [];
  for (const field of Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]) {
    const { comparable, value } = similarities[field];
    if (!comparable) continue;
    possible += WEIGHTS[field];
    obtained += WEIGHTS[field] * value;
    if (value >= SIMILAR) coincide.push(LABELS[field]);
  }
  const porcentaje = Math.round((obtained / possible) * 100);

  const namesMatch = nameScore >= SIMILAR && fatherNameScore >= SIMILAR;

  const hasIndependentData = ['fecha_nacimiento', 'padre', 'madre'].some(
    (field) => similarities[field as keyof typeof WEIGHTS].comparable && similarities[field as keyof typeof WEIGHTS].value >= SIMILAR,
  );
  const differentDni = dniComparable && !sameDni;

  if ((sameDni && (nameScore > 0 || fatherNameScore > 0)) || (namesMatch && hasIndependentData && !differentDni)) {
    return { nivel: 'alta' as const, porcentaje, coincide };
  }
  return sameDni || porcentaje >= MIN_PERCENT ? { nivel: 'posible' as const, porcentaje, coincide } : null;
}

function toValues(person: DuplicatePersonInput): Values {
  return {
    dni: normalize(person.dni),
    nombres: normalize(person.nombre),
    apellido_paterno: normalize(person.apellidoPaterno),
    apellido_materno: normalize(person.apellidoMaterno),
    fecha_nacimiento: normalize(person.fechaNacimiento),
    padre: normalize(person.padreNombre),
    madre: normalize(person.madreNombre),
  };
}


export function findDuplicates(
  db: LocalDatabase,
  tipo: SacramentType,
  excludeSacramentId: unknown,
  persons: DuplicatePersonInput[],
): { matches: DuplicateMatch[]; total: number } {
  const sources = SOURCES[tipo];
  if (!sources) throw new ServiceError('Tipo de sacramento inválido.', 400);

  const searchable = persons
    .map((person) => ({ para: person.para ?? '', values: toValues(person) }))
    .filter(({ values }) => values.dni || (values.nombres && values.apellido_paterno));
  if (searchable.length === 0) return { matches: [], total: 0 };

  const candidates = db
    .prepare(
      `SELECT s.id, sub.persona_id, s.libro, s.folio, s.numero, par.nombre AS parroquia,
              pe.dni, pe.nombres, pe.apellido_paterno, pe.apellido_materno, pe.fecha_nacimiento, pe.padre, pe.madre
       FROM (${sources.join(' UNION ALL ')}) sub
       JOIN sacramentos s ON s.id = sub.sacramento_id
       JOIN personas pe ON pe.id = sub.persona_id
       JOIN parroquias par ON par.id = s.parroquia_id
       WHERE s.estado = 'vigente' AND s.id <> ?`,
    )
    .all(Number.isInteger(excludeSacramentId) ? excludeSacramentId : 0) as Candidate[];


  const previousNames = new Map<string, string[]>();
  const corrections = db
    .prepare(
      `SELECT persona_id, campo_cambio, valor_anterior FROM cambios_persona
       WHERE campo_cambio IN ('nombres', 'apellido_paterno', 'apellido_materno') AND valor_anterior IS NOT NULL`,
    )
    .all() as { persona_id: number; campo_cambio: string; valor_anterior: string }[];
  for (const { persona_id, campo_cambio, valor_anterior } of corrections) {
    const key = `${persona_id}:${campo_cambio}`;
    previousNames.set(key, [...(previousNames.get(key) ?? []), normalize(valor_anterior)]);
  }

  const byRelevance = (a: DuplicateMatch, b: DuplicateMatch) =>
    Number(b.nivel === 'alta') - Number(a.nivel === 'alta') || b.porcentaje - a.porcentaje;

  let total = 0;
  const found = searchable.flatMap(({ para, values }) => {
    const matches: DuplicateMatch[] = [];
    for (const candidate of candidates) {
      const result = score(values, candidate, previousNames);
      if (!result) continue;
      matches.push({
        sacramentoId: candidate.id,
        para,
        ...result,
        nombreCompleto: [candidate.nombres, candidate.apellido_paterno, candidate.apellido_materno].filter(Boolean).join(' '),
        parroquia: candidate.parroquia,
        libro: candidate.libro,
        folio: candidate.folio,
        numero: candidate.numero,
      });
    }
    total += matches.length;
    return matches.sort(byRelevance).slice(0, MAX_PER_PERSON);
  });

  return { matches: found.sort(byRelevance), total };
}
