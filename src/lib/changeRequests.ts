import type { ChangeRequest, SacramentRecord } from '../../shared/models';
import { field_label, field_text, get_field, set_field } from '../../shared/record_fields';
import type { CorrectionDraft } from './personCorrections';

/** Lo que un usuario pidió cambiar y todavía espera al administrador. */
export function pendingRequests(record: SacramentRecord): ChangeRequest[] {
  return (record.sacramento.solicitudes ?? []).filter((request) => request.estado === 'pendiente');
}

/** El último pedido ya revisado, para avisarle al usuario si se rechazó o se descartó. */
export function lastReviewed(record: SacramentRecord): ChangeRequest | null {
  return (record.sacramento.solicitudes ?? []).find((request) => request.estado !== 'pendiente') ?? null;
}

/** "Padre de la esposa", "Folio"... El texto de la nota se llama así para no repetir "Nota marginal". */
export function requestLabel(request: Pick<ChangeRequest, 'parte' | 'campo'>): string {
  if (request.parte === 'sacramento' && request.campo === 'anotaciones') return 'Texto de la nota';
  return field_label(request.parte, request.campo);
}

/** La clave de una fila de la nota marginal: "nombres" o, en un matrimonio, "conyuge_1.nombres". */
function draftKey(request: ChangeRequest): string {
  return request.parte === 'persona' ? request.campo : `${request.parte}.${request.campo}`;
}

/**
 * "Usar estos valores": la partida del formulario con los datos pedidos, y las correcciones por nota
 * marginal como filas nuevas del subformulario.
 */
export function withRequestedValues(record: SacramentRecord, requests: ChangeRequest[]): { record: SacramentRecord; drafts: CorrectionDraft[] } {
  let updated = record;
  const drafts: CorrectionDraft[] = [];

  for (const request of requests) {
    if (request.tipo === 'nota_marginal')
      drafts.push({ id: crypto.randomUUID(), field: draftKey(request), valor_nuevo: request.valor_nuevo ?? '' });
    else
      updated = set_field(updated, request.parte, request.campo, request.valor_nuevo);
  }

  return { record: updated, drafts };
}

/** Si lo que se va a guardar trae todo lo pedido (como lo revisa Electron al guardar). */
export function usesRequestedValues(record: SacramentRecord, drafts: CorrectionDraft[], requests: ChangeRequest[]): boolean {
  return requests.every((request) => {
    if (request.tipo === 'digitacion') return get_field(record, request.parte, request.campo) === request.valor_nuevo;
    return drafts.some((draft) => draft.field === draftKey(request) && field_text(draft.valor_nuevo) === request.valor_nuevo);
  });
}

/** "Rosa Mamani el 07/11/2026": quién pidió el cambio y cuándo. */
export function requestedBy(requests: ChangeRequest[]): string {
  const first = requests[0];
  if (!first) return '';
  return `${first.solicitado_por} el ${new Date(first.creado_en).toLocaleDateString('es-PE')}`;
}
