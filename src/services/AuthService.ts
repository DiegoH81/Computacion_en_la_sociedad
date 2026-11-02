import { localRequest } from '../lib/localClient';

export interface LoginResponse {
  token: string;
  usuario: {
    id: number;
    nombreCompleto: string;
    rol: 'admin' | 'usuario_parroquia';
    parroquiaId: number | null;
    parroquiaNombre: string | null;
  };
}

export interface Parish {
  id: number;
  nombre: string;
}

export const AuthService = {
  login(username: string, password: string): Promise<LoginResponse> {
    return localRequest<LoginResponse>('auth.login', { username, password });
  },

  logout(): Promise<{ success: true }> {
    return localRequest<{ success: true }>('auth.logout');
  },

  getParishes(): Promise<{ parishes: Parish[] }> {
    return localRequest<{ parishes: Parish[] }>('parishes.list');
  },
};