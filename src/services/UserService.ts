import type { SearchFilters, SearchPage, User } from '../../shared/models';
import { localRequest } from '../lib/localClient';

/**
 * Las cuentas se gestionan en esta PC, también sin internet: Electron las guarda y las sube al
 * sincronizar (ver electron/main/controllers/users.ts). Se manda y recibe el model User.
 */
export const UserService = {
  search(filters: SearchFilters): Promise<SearchPage<User>> {
    return localRequest('users.search', filters);
  },

  create(user: User): Promise<{ id: number }> {
    return localRequest('users.create', user);
  },

  update(user: User): Promise<{ success: true }> {
    return localRequest('users.update', user);
  },

  toggleActive(userId: number): Promise<{ success: true }> {
    return localRequest('users.toggleActive', { id: userId });
  },

  /** Si la sesión es la del administrador general principal: el único que crea y modifica a los demás. */
  me(): Promise<{ principal: boolean }> {
    return localRequest('users.me');
  },

  /** Pasa la marca de principal a otro administrador general. Se hace directo en el Worker: necesita internet. */
  /** En el servidor, a través de Electron: necesita internet. */
  makePrincipal(username: string): Promise<{ success: true }> {
    return localRequest('users.makePrincipal', { username });
  },
};
