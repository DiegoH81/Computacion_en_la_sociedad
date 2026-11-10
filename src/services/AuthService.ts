import type { Parish as ParishRow } from '../../shared/models';
import type { LoginResponse, Role } from '../../shared/sync';
import { localRequest } from '../lib/localClient';


/** Lo que llega de cada parroquia en las listas para elegir. */
export type Parish = Pick<ParishRow, 'id' | 'nombre'>;

export const AuthService = {
  login(username: string, password: string): Promise<LoginResponse> {
    return localRequest<LoginResponse>('auth.login', { username, password });
  },

  logout(): Promise<{ success: true }> {
    return localRequest<{ success: true }>('auth.logout');
  },

  /** Cambia la parroquia de trabajo a otra donde trabaja la cuenta. Devuelve su rol en ella. */
  selectParish(parishId: number): Promise<{ rol: Role; parroquia_id: number }> {
    return localRequest('auth.selectParish', { parroquia_id: parishId });
  },

  getParishes(): Promise<{ parroquias: Parish[] }> {
    return localRequest<{ parroquias: Parish[] }>('parishes.list');
  },
};