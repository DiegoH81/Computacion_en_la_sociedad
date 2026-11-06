import type { SearchFilters, SearchPage, User } from '../../shared/models';
import { apiRequest } from '../lib/apiClient';

const PAGE_SIZE = 20;

/** Gestión de cuentas en el Worker (solo admin). Se manda y recibe el model User de shared/models.ts. */
export const UserService = {
  search(filters: SearchFilters, token: string): Promise<SearchPage<User>> {
    const query = new URLSearchParams();
    if (filters.nombres) query.set('nombres', filters.nombres);
    if (filters.apellido_paterno) query.set('apellido_paterno', filters.apellido_paterno);
    if (filters.apellido_materno) query.set('apellido_materno', filters.apellido_materno);
    if (filters.parroquia_id) query.set('parroquia_id', String(filters.parroquia_id));
    if (filters.orden) query.set('orden', filters.orden);
    if (filters.direccion) query.set('direccion', filters.direccion);
    query.set('pagina', String(filters.pagina ?? 1));
    query.set('por_pagina', String(PAGE_SIZE));

    return apiRequest(`/api/users?${query.toString()}`, { token });
  },

  create(user: User, token: string): Promise<{ id: number }> {
    return apiRequest('/api/users', { method: 'POST', body: user, token });
  },

  update(user: User, token: string): Promise<{ success: true }> {
    return apiRequest(`/api/users/${user.id}`, { method: 'PUT', body: user, token });
  },

  toggleActive(userId: number, token: string): Promise<{ success: true }> {
    return apiRequest(`/api/users/${userId}/toggle-active`, { method: 'PATCH', token });
  },

  /** Si el admin de la sesión es el principal: el único que crea y modifica a otros admins. */
  me(token: string): Promise<{ principal: boolean }> {
    return apiRequest('/api/users/me', { token });
  },

  /** Pasa la marca de principal a otro admin activo. Solo la puede pasar el principal. */
  makePrincipal(userId: number, token: string): Promise<{ success: true }> {
    return apiRequest(`/api/users/${userId}/make-principal`, { method: 'PATCH', token });
  },
};
