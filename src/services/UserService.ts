import { apiRequest } from '../lib/apiClient';

export interface UserListItem {
  id: number;
  username: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string;
  parroquia_nombre: string | null; // null en cuentas admin
  activo: number;
}

export interface SearchUsersParams {
  nombre?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  sortBy: 'nombre' | 'apellido_paterno' | 'apellido_materno';
  sortDirection: 'asc' | 'desc';
  page: number;
}

export type ParishChoiceBody =
  | { kind: 'existing'; parroquiaId: number }
  | { kind: 'new'; nombre: string };

export interface CreateUserBody {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  username: string;
  password: string;
  parroquia: ParishChoiceBody;
}

export interface UpdateUserBody {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  password?: string; // ausente = conservar la contraseña actual
}

const PAGE_SIZE = 20;

export const UserService = {
  search(
    params: SearchUsersParams,
    token: string,
  ): Promise<{ users: UserListItem[]; totalPages: number }> {
    const query = new URLSearchParams();
    if (params.nombre) query.set('nombre', params.nombre);
    if (params.apellidoPaterno) query.set('apellidoPaterno', params.apellidoPaterno);
    if (params.apellidoMaterno) query.set('apellidoMaterno', params.apellidoMaterno);
    query.set('sortBy', params.sortBy);
    query.set('sortDirection', params.sortDirection);
    query.set('page', String(params.page));
    query.set('pageSize', String(PAGE_SIZE));

    return apiRequest(`/api/users?${query.toString()}`, { token });
  },

  create(body: CreateUserBody, token: string): Promise<{ id: number }> {
    return apiRequest('/api/users', { method: 'POST', body, token });
  },

  update(userId: number, body: UpdateUserBody, token: string): Promise<{ success: true }> {
    return apiRequest(`/api/users/${userId}`, { method: 'PUT', body, token });
  },

  toggleActive(userId: number, token: string): Promise<{ success: true }> {
    return apiRequest(`/api/users/${userId}/toggle-active`, { method: 'PATCH', token });
  },
};
