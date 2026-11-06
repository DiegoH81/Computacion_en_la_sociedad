import { useSessionStore } from '../../src/store/sessionStore';
import {
  searchUsers,
  createUser,
  updateUser,
  toggleUserActive,
  loadIsPrincipal,
  makePrincipal,
} from '../../src/controllers/UserController';
import type { User } from '../../shared/models';

interface FetchCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: Record<string, unknown> | undefined;
}

/** Sustituye fetch por un mock que responde con el status y cuerpo indicados. */
function mockFetch(status: number, responseBody: unknown) {
  const fn = vi.fn<(url: string, init?: RequestInit) => Promise<unknown>>(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => responseBody,
  }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

function firstCall(fn: ReturnType<typeof mockFetch>): FetchCall {
  const [url, init] = fn.mock.calls[0];
  return {
    url,
    method: init?.method ?? 'GET',
    headers: (init?.headers ?? {}) as Record<string, string>,
    body: init?.body ? JSON.parse(init.body as string) : undefined,
  };
}

const PASSWORD = 'passwordNueva123';

// Una cuenta nueva en una parroquia existente, tal como la entrega el formulario.
const VALID: User = {
  username: 'ana.quispe',
  rol: 'usuario_parroquia',
  parroquia_id: 1,
  nombre: 'Ana',
  apellido_paterno: 'Quispe',
  apellido_materno: 'Mamani',
  password: PASSWORD,
};

describe('UserController', () => {
  beforeEach(() => {
    useSessionStore.getState().setSession({
      token: 'token-de-prueba',
      usuarioId: 1,
      usuarioNombre: 'Admin',
      rol: 'admin',
      parroquiaId: null,
      parroquiaActivaId: 1,
      parroquiaActivaNombre: 'Parroquia 1',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    useSessionStore.getState().clearSession();
  });

  describe('createUser', () => {
    // Este test fija el contrato con el Worker: la forma del cuerpo debe coincidir
    // con la que acepta POST /api/users (ver worker/test/userRoutes.test.ts).
    it('envía al Worker el model User, con una parroquia existente', async () => {
      const fetchMock = mockFetch(201, { id: 5 });

      const result = await createUser(VALID, PASSWORD);

      expect(result.success).toBe(true);
      const call = firstCall(fetchMock);
      expect(call.url).toMatch(/\/api\/users$/);
      expect(call.method).toBe('POST');
      expect(call.headers['Authorization']).toBe('Bearer token-de-prueba');
      expect(call.body).toEqual(VALID);
    });

    it('nunca envía la contraseña repetida', async () => {
      const fetchMock = mockFetch(201, { id: 5 });

      await createUser(VALID, PASSWORD);

      expect(JSON.stringify(firstCall(fetchMock).body)).not.toContain('confirm');
    });

    it('envía una parroquia nueva con el nombre sin espacios sobrantes', async () => {
      const fetchMock = mockFetch(201, { id: 5 });

      await createUser({ ...VALID, parroquia_id: null, parroquia_nueva: '  Parroquia Nueva  ' }, PASSWORD);

      expect(firstCall(fetchMock).body).toMatchObject({ parroquia_id: null, parroquia_nueva: 'Parroquia Nueva' });
    });

    it('un administrador se envía sin parroquia, aunque se haya elegido una', async () => {
      const fetchMock = mockFetch(201, { id: 5 });

      const result = await createUser({ ...VALID, rol: 'admin', parroquia_id: 3, parroquia_nueva: 'X' }, PASSWORD);

      expect(result.success).toBe(true);
      expect(firstCall(fetchMock).body).toMatchObject({ rol: 'admin', parroquia_id: null });
      expect(firstCall(fetchMock).body).not.toHaveProperty('parroquia_nueva');
    });

    describe('validación local: no llama al servidor', () => {
      const INVALID_CASES: Array<[string, Partial<User>, string, string]> = [
        ['sin nombre', { nombre: '  ' }, PASSWORD, 'Nombre y apellido paterno son requeridos.'],
        ['sin apellido paterno', { apellido_paterno: '' }, PASSWORD, 'Nombre y apellido paterno son requeridos.'],
        ['sin username', { username: ' ' }, PASSWORD, 'El nombre de usuario es requerido.'],
        ['sin parroquia elegida', { parroquia_id: null }, PASSWORD, 'Debe seleccionar una parroquia.'],
        ['parroquia nueva sin nombre', { parroquia_id: null, parroquia_nueva: '   ' }, PASSWORD, 'El nombre de la parroquia nueva es requerido.'],
        ['contraseña de 7 caracteres', { password: '1234567' }, '1234567', 'La contraseña debe tener al menos 8 caracteres.'],
        ['contraseñas que no coinciden', {}, 'otraDistinta123', 'Las contraseñas no coinciden.'],
      ];

      it.each(INVALID_CASES)('%s', async (_name, overrides, confirmPassword, expectedMessage) => {
        const fetchMock = mockFetch(201, { id: 5 });

        const result = await createUser({ ...VALID, ...overrides }, confirmPassword);

        expect(result.success).toBe(false);
        expect(result.errorMessage).toBe(expectedMessage);
        expect(fetchMock).not.toHaveBeenCalled();
      });
    });

    it('muestra el mensaje que devuelve el Worker cuando rechaza la petición', async () => {
      mockFetch(409, { message: 'Ese nombre de usuario ya existe.' });

      const result = await createUser(VALID, PASSWORD);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Ese nombre de usuario ya existe.');
    });

    it('sin sesión no llama al servidor', async () => {
      const fetchMock = mockFetch(201, { id: 5 });
      useSessionStore.getState().clearSession();

      const result = await createUser(VALID, PASSWORD);

      expect(result.success).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('updateUser', () => {
    // La cuenta tal como llegó de la búsqueda, sin contraseña escrita.
    const EDIT: User = { ...VALID, id: 7, activo: 1, parroquia_nombre: 'Parroquia 1', password: '' };

    it('hace PUT a /api/users/:id sin contraseña si se deja vacía', async () => {
      const fetchMock = mockFetch(200, { success: true });

      const result = await updateUser(EDIT, '');

      expect(result.success).toBe(true);
      const call = firstCall(fetchMock);
      expect(call.url).toMatch(/\/api\/users\/7$/);
      expect(call.method).toBe('PUT');
      expect(call.body).toMatchObject({ nombre: 'Ana', apellido_paterno: 'Quispe', apellido_materno: 'Mamani' });
      expect(call.body).not.toHaveProperty('password');
    });

    it('envía la contraseña solo cuando se escribe una nueva', async () => {
      const fetchMock = mockFetch(200, { success: true });

      await updateUser({ ...EDIT, password: 'contraseñaNueva456' }, 'contraseñaNueva456');

      expect(firstCall(fetchMock).body?.password).toBe('contraseñaNueva456');
    });

    it('rechaza una contraseña nueva que no coincide, sin llamar al servidor', async () => {
      const fetchMock = mockFetch(200, { success: true });

      const result = await updateUser({ ...EDIT, password: 'contraseñaNueva456' }, 'distinta');

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Las contraseñas no coinciden.');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rechaza una contraseña nueva demasiado corta', async () => {
      const fetchMock = mockFetch(200, { success: true });

      const result = await updateUser({ ...EDIT, password: '1234567' }, '1234567');

      expect(result.success).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rechaza escribir solo la confirmación sin contraseña', async () => {
      const fetchMock = mockFetch(200, { success: true });

      const result = await updateUser(EDIT, 'algo');

      expect(result.success).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('searchUsers', () => {
    it('entrega las cuentas tal como llegan del Worker', async () => {
      const users = [
        { id: 1, username: 'admin', rol: 'admin', parroquia_id: null, nombre: 'Administrador', apellido_paterno: 'De', apellido_materno: 'Prueba', parroquia_nombre: null, activo: 1 },
        { id: 3, username: 'secretaria2', rol: 'usuario_parroquia', parroquia_id: 2, nombre: 'Ana', apellido_paterno: 'Quispe', apellido_materno: 'Mamani', parroquia_nombre: 'Parroquia 2', activo: 0 },
      ];
      mockFetch(200, { resultados: users, total_paginas: 2 });

      const result = await searchUsers({ orden: 'nombres', direccion: 'asc', pagina: 1 });

      expect(result.success).toBe(true);
      expect(result.totalPages).toBe(2);
      expect(result.users).toEqual(users);
    });

    it('manda al Worker los filtros con los nombres de las columnas', async () => {
      const fetchMock = mockFetch(200, { resultados: [], total_paginas: 1 });

      await searchUsers({ apellido_paterno: 'Quispe', orden: 'apellido_paterno', direccion: 'desc', pagina: 2 });

      const query = new URL(firstCall(fetchMock).url).searchParams;
      expect(query.get('apellido_paterno')).toBe('Quispe');
      expect(query.get('orden')).toBe('apellido_paterno');
      expect(query.get('direccion')).toBe('desc');
      expect(query.get('pagina')).toBe('2');
    });

    it('devuelve el mensaje del Worker si responde 403', async () => {
      mockFetch(403, { message: 'Solo un administrador puede gestionar usuarios.' });

      const result = await searchUsers({ orden: 'nombres', direccion: 'asc', pagina: 1 });

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Solo un administrador puede gestionar usuarios.');
    });
  });

  describe('administrador principal', () => {
    it('loadIsPrincipal pregunta a GET /api/users/me', async () => {
      const fetchMock = mockFetch(200, { principal: true });

      expect(await loadIsPrincipal()).toBe(true);
      expect(firstCall(fetchMock).url).toMatch(/\/api\/users\/me$/);
    });

    it('si el Worker no responde, se toma como que no es el principal', async () => {
      mockFetch(500, { message: 'Error' });

      expect(await loadIsPrincipal()).toBe(false);
    });

    it('makePrincipal hace PATCH a /api/users/:id/make-principal y muestra el rechazo del Worker', async () => {
      const fetchMock = mockFetch(200, { success: true });

      expect((await makePrincipal(3)).success).toBe(true);
      expect(firstCall(fetchMock)).toMatchObject({ method: 'PATCH' });
      expect(firstCall(fetchMock).url).toMatch(/\/api\/users\/3\/make-principal$/);

      mockFetch(403, { message: 'Solo el administrador principal puede pasar la marca de principal.' });
      expect(await makePrincipal(3)).toEqual({
        success: false,
        errorMessage: 'Solo el administrador principal puede pasar la marca de principal.',
      });
    });
  });

  describe('toggleUserActive', () => {
    it('hace PATCH a /api/users/:id/toggle-active', async () => {
      const fetchMock = mockFetch(200, { success: true });

      const result = await toggleUserActive(7);

      expect(result.success).toBe(true);
      const call = firstCall(fetchMock);
      expect(call.url).toMatch(/\/api\/users\/7\/toggle-active$/);
      expect(call.method).toBe('PATCH');
    });

    it('muestra el mensaje del Worker si rechaza deshabilitar la propia cuenta', async () => {
      mockFetch(400, { message: 'No puede deshabilitar su propia cuenta.' });

      const result = await toggleUserActive(1);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('No puede deshabilitar su propia cuenta.');
    });
  });
});
