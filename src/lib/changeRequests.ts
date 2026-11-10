import type { ChangeRequest, SacramentRecord } from '../../shared/models';
import { field_label, field_text, get_field, set_field } from '../../shared/record_fields';
import type { CorrectionDraft } from './personCorrections';

export function pendingRequests(record: SacramentRecord): ChangeRequest[] {
  return (record.sacramento.solicitudes ?? []).filter((request) => request.estado === 'pendiente');
}

export function lastReviewed(record: SacramentRecord): ChangeRequest | null {
  return (record.sacramento.solicitudes ?? []).find((request) => request.estado !== 'pendiente') ?? null;
}

export function requestLabel(request: Pick<ChangeRequest, 'parte' | 'campo'>): string {
  if (request.parte === 'sacramento' && request.campo === 'anotaciones') return 'Texto de la nota';
  return field_label(request.parte, request.campo);
}

function draftKey(request: ChangeRequest): string {
  return request.parte === 'persona' ? request.campo : `${request.parte}.${request.campo}`;
}

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

export function usesRequestedValues(record: SacramentRecord, drafts: CorrectionDraft[], requests: ChangeRequest[]): boolean {
  return requests.every((request) => {
    if (request.tipo === 'digitacion') return get_field(record, request.parte, request.campo) === request.valor_nuevo;
    return drafts.some((draft) => draft.field === draftKey(request) && field_text(draft.valor_nuevo) === request.valor_nuevo);
  });
}

export function requestedBy(requests: ChangeRequest[]): string {
  const first = requests[0];
  if (!first) return '';
  return `${first.solicitado_por} el ${new Date(first.creado_en).toLocaleDateString('es-PE')}`;
}
