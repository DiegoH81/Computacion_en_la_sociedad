import type { SearchFilters, SearchPage, User } from '../../shared/models';
import type { ParishRole } from '../../shared/sync';
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

  /**
   * Pasa la marca de principal a otro administrador: entre los generales, o en una parroquia (la
   * indicada o, si no, la de trabajo). En el servidor, a través de Electron: necesita internet.
   */
  makePrincipal(username: string, parishId?: number): Promise<{ success: true }> {
    return localRequest('users.makePrincipal', { username, parroquia_id: parishId });
  },

  /** Agrega una parroquia adicional a la cuenta o le cambia el rol. Solo el admin_general, con internet. */
  setParish(userId: number, parishId: number, rol: ParishRole): Promise<{ success: true }> {
    return localRequest('users.setParish', { id: userId, parroquia_id: parishId, rol });
  },

  /** Quita una parroquia adicional. Solo el admin_general, con internet. */
  removeParish(userId: number, parishId: number): Promise<{ success: true }> {
    return localRequest('users.removeParish', { id: userId, parroquia_id: parishId });
  },
};
