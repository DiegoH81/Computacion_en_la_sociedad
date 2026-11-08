import type { HistoryEntry, SacramentRecord } from '../../shared/models';
import { localRequest } from '../lib/localClient';

/** Una partida con cambios que pidió un usuario y esperan a un administrador de la parroquia. */
export interface PendingChanges {
  partida: SacramentRecord;
  solicitado_por: string;
}

export type ReviewDecision = 'aprobado' | 'rechazado';

export const RequestService = {
  pending(): Promise<{ pendientes: PendingChanges[] }> {
    return localRequest('requests.pending');
  },

  /** Aprueba o rechaza todo lo que se pidió en la partida. */
  review(sacramento_id: number, decision: ReviewDecision): Promise<{ success: true }> {
    return localRequest('requests.review', { sacramento_id, decision });
  },

  /** El historial de la partida (solo administradores), el evento más nuevo primero. */
  history(id: number): Promise<{ historial: HistoryEntry[] }> {
    return localRequest('sacraments.history', { id });
  },
};
