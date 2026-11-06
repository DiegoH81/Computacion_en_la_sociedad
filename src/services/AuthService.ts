import type { Parish as ParishRow } from '../../shared/models';
import type { LoginResponse } from '../../shared/sync';
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

  getParishes(): Promise<{ parroquias: Parish[] }> {
    return localRequest<{ parroquias: Parish[] }>('parishes.list');
  },
};