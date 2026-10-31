import { apiRequest } from '../lib/apiClient';

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
    return apiRequest<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: { username, password },
    });
  },

  getParishes(token: string): Promise<{ parishes: Parish[] }> {
    return apiRequest<{ parishes: Parish[] }>('/api/parishes', {
      token,
    });
  },
};