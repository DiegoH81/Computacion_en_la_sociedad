import { useSessionStore, type Rol } from '../../src/store/sessionStore';
import {
  searchUsers,
  createUser,
  updateUser,
  toggleUserActive,
  loadIsPrincipal,
  makePrincipal,
} from '../../src/controllers/UserController';
import type { User } from '../../shared/models';
import type { LocalResponse } from '../../electron/shared';

// Las cuentas se gestionan en la PC (Electron), también sin internet. Pasar la marca de principal
// también se pide a Electron, que lo hace en el Worker (necesita internet).

/** Sustituye a Electron: responde lo indicado y guarda qué se le pidió. */
function mockElectron(response: LocalResponse = { ok: true, data: { success: true } }) {
  const fn = vi.fn<(method: string, payload?: unknown) => Promise<LocalResponse>>(async () => response);
  window.electronAPI = { getAppVersion: async () => '0', localRequest: fn };
  return fn;
}

const PASSWORD = 'passwordNueva123';

// Una cuenta nueva en una parroquia existente, tal como la entrega el formulario.
const VALID: User = {
  username: 'ana.quispe',
  rol: 'usuario',
  parroquia_id: 1,
  nombre: ' Ana ',
  apellido_paterno: 'Quispe',
  apellido_materno: 'Mamani',
  password: PASSWORD,
};

function login(rol: Rol, parroquiaId: number | null) {
  useSessionStore.getState().setSession({
    token: 'token-de-prueba',
    usuarioId: 1,
    usuarioNombre: 'Admin',
    rol,
    parroquiaId,
    parroquiaActivaId: parroquiaId ?? 1,
    parroquiaActivaNombre: 'Parroquia 1',
    misParroquias: [],
  });
}

describe('UserController', () => {
  beforeEach(() => login('admin_general', null));

  afterEach(() => {
    vi.unstubAllGlobals();
    useSessionStore.getState().clearSession();
  });

  describe('createUser', () => {
    it('manda a Electron el model User, sin la contraseña repetida y con los nombres recortados', async () => {
      const electron = mockElectron({ ok: true, data: { id: -1 } });

      expect(await createUser(VALID, PASSWORD)).toEqual({ success: true });
      expect(electron).toHaveBeenCalledWith('users.create', expect.objectContaining({ username: 'ana.quispe', nombre: 'Ana', parroquia_id: 1, password: PASSWORD }));
      expect(JSON.stringify(electron.mock.calls[0][1])).not.toContain('confirm');
    });

    it('un administrador general se manda sin parroquia, aunque se haya elegido una', async () => {
      const electron = mockElectron({ ok: true, data: { id: -1 } });

      await createUser({ ...VALID, rol: 'admin_general', parroquia_id: 3 }, PASSWORD);
      expect(electron.mock.calls[0][1]).toMatchObject({ rol: 'admin_general', parroquia_id: null });
    });

    describe('validación local: no llama a Electron', () => {
      it.each([
        ['sin nombre', { ...VALID, nombre: '  ' }, PASSWORD, 'Nombre y apellido paterno son requeridos.'],
        ['sin usuario', { ...VALID, username: ' ' }, PASSWORD, 'El nombre de usuario es requerido.'],
        ['sin parroquia elegida', { ...VALID, parroquia_id: null }, PASSWORD, 'Debe seleccionar una parroquia.'],
        ['contraseña corta', { ...VALID, password: 'corta' }, 'corta', 'La contraseña debe tener al menos 6 caracteres.'],
        ['contraseña con espacios', { ...VALID, password: 'mi clave' }, 'mi clave', 'La contraseña no puede tener espacios.'],
        ['contraseñas distintas', VALID, 'otraCosa123', 'Las contraseñas no coinciden.'],
      ])('%s', async (_name, user, confirm, message) => {
        const electron = mockElectron();
        expect(await createUser(user as User, confirm as string)).toEqual({ success: false, errorMessage: message });
        expect(electron).not.toHaveBeenCalled();
      });
    });

    it('el administrador de una parroquia no elige parroquia: la pone Electron', async () => {
      login('admin_parroquia', 1);
      const electron = mockElectron({ ok: true, data: { id: -1 } });

      expect(await createUser({ ...VALID, parroquia_id: null }, PASSWORD)).toEqual({ success: true });
      expect(electron).toHaveBeenCalledWith('users.create', expect.anything());
    });

    it('muestra el mensaje con que Electron rechaza la cuenta', async () => {
      mockElectron({ ok: false, status: 409, message: 'Ese nombre de usuario ya existe.' });
      expect(await createUser(VALID, PASSWORD)).toEqual({ success: false, errorMessage: 'Ese nombre de usuario ya existe.' });
    });
  });

  describe('updateUser', () => {
    it('sin contraseña nueva no la manda', async () => {
      const electron = mockElectron();
      await updateUser({ ...VALID, id: 7, password: '' }, '');
      expect(electron.mock.calls[0][0]).toBe('users.update');
      expect(electron.mock.calls[0][1]).not.toHaveProperty('password');
    });

    it('manda la contraseña solo cuando se escribe una nueva', async () => {
      const electron = mockElectron();
      await updateUser({ ...VALID, id: 7 }, PASSWORD);
      expect(electron.mock.calls[0][1]).toMatchObject({ id: 7, password: PASSWORD });
    });
  });

  it('searchUsers entrega las cuentas tal como llegan de Electron', async () => {
    const electron = mockElectron({ ok: true, data: { resultados: [{ ...VALID, id: 1 }], total_paginas: 3 } });

    const result = await searchUsers({ nombres: 'Ana', pagina: 2 });
    expect(result).toMatchObject({ success: true, totalPages: 3, users: [{ id: 1 }] });
    expect(electron).toHaveBeenCalledWith('users.search', { nombres: 'Ana', pagina: 2 });
  });

  it('toggleUserActive y loadIsPrincipal van a Electron', async () => {
    const electron = mockElectron({ ok: true, data: { principal: true } });

    expect(await loadIsPrincipal()).toBe(true);
    await toggleUserActive(5);
    expect(electron.mock.calls.map((call) => call[0])).toEqual(['users.me', 'users.toggleActive']);
    expect(electron.mock.calls[1][1]).toEqual({ id: 5 });
  });

  it('pasar la marca de principal se le pide a Electron, con el nombre de usuario', async () => {
    const electron = mockElectron();
    expect(await makePrincipal('ana.quispe')).toEqual({ success: true });
    expect(electron).toHaveBeenCalledWith('users.makePrincipal', { username: 'ana.quispe' });

    mockElectron({ ok: false, message: 'Pasar la marca de principal necesita conexión a internet: la cuenta tiene que estar en el servidor.', status: 503 });
    expect(await makePrincipal('ana.quispe')).toMatchObject({ success: false, errorMessage: expect.stringContaining('necesita conexión a internet') });
  });
});
