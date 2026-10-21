import { useSessionStore } from '../../src/store/sessionStore';
import {
  searchUsers,
  createUser,
  updateUser,
  toggleUserActive,
} from '../../src/controllers/UserController';
import type { UserFormValues } from '../../src/components/features/UserFormModal';

interface FetchCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: Record<string, unknown> | undefined;
}

/** Sustituye fetch por un mock que responde con el status y cuerpo indicados. */
function mockFetch(status: number, responseBody: unknown) {
  const fn = vi.fn(async (_url: string, _init?: RequestInit) => ({
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

const VALID: UserFormValues = {
  nombre: 'Ana',
  apellidoPaterno: 'Quispe',
  apellidoMaterno: 'Mamani',
  username: 'ana.quispe',
  password: 'passwordNueva123',
  confirmPassword: 'passwordNueva123',
  parroquia: { kind: 'existing', parroquiaId: 1 },
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
    it('envía al Worker la forma exacta que espera, con una parroquia existente', async () => {
      const fetchMock = mockFetch(201, { id: 5 });

      const result = await createUser(VALID);

      expect(result.success).toBe(true);
      const call = firstCall(fetchMock);
      expect(call.url).toMatch(/\/api\/users$/);
      expect(call.method).toBe('POST');
      expect(call.headers['Authorization']).toBe('Bearer token-de-prueba');
      expect(call.body).toEqual({
        nombre: 'Ana',
        apellidoPaterno: 'Quispe',
        apellidoMaterno: 'Mamani',
        username: 'ana.quispe',
        password: 'passwordNueva123',
        parroquia: { kind: 'existing', parroquiaId: 1 },
      });
    });

    it('nunca envía confirmPassword', async () => {
      const fetchMock = mockFetch(201, { id: 5 });

      await createUser(VALID);

      expect(firstCall(fetchMock).body).not.toHaveProperty('confirmPassword');
    });

    it('envía una parroquia nueva con el nombre sin espacios sobrantes', async () => {
      const fetchMock = mockFetch(201, { id: 5 });

      await createUser({ ...VALID, parroquia: { kind: 'new', nombre: '  Parroquia Nueva  ' } });

      expect(firstCall(fetchMock).body?.parroquia).toEqual({
        kind: 'new',
        nombre: 'Parroquia Nueva',
      });
    });

    describe('validación local: no llama al servidor', () => {
      const INVALID_CASES: Array<[string, Partial<UserFormValues>, string]> = [
        ['sin nombre', { nombre: '  ' }, 'Nombre y apellido paterno son requeridos.'],
        ['sin apellido paterno', { apellidoPaterno: '' }, 'Nombre y apellido paterno son requeridos.'],
        ['sin username', { username: ' ' }, 'El nombre de usuario es requerido.'],
        [
          'sin parroquia elegida',
          { parroquia: { kind: 'existing', parroquiaId: null } },
          'Debe seleccionar una parroquia.',
        ],
        [
          'parroquia nueva sin nombre',
          { parroquia: { kind: 'new', nombre: '   ' } },
          'El nombre de la parroquia nueva es requerido.',
        ],
        [
          'contraseña de 7 caracteres',
          { password: '1234567', confirmPassword: '1234567' },
          'La contraseña debe tener al menos 8 caracteres.',
        ],
        [
          'contraseñas que no coinciden',
          { confirmPassword: 'otraDistinta123' },
          'Las contraseñas no coinciden.',
        ],
      ];

      it.each(INVALID_CASES)('%s', async (_name, overrides, expectedMessage) => {
        const fetchMock = mockFetch(201, { id: 5 });

        const result = await createUser({ ...VALID, ...overrides });

        expect(result.success).toBe(false);
        expect(result.errorMessage).toBe(expectedMessage);
        expect(fetchMock).not.toHaveBeenCalled();
      });
    });

    it('muestra el mensaje que devuelve el Worker cuando rechaza la petición', async () => {
      mockFetch(409, { message: 'Ese nombre de usuario ya existe.' });

      const result = await createUser(VALID);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Ese nombre de usuario ya existe.');
    });

    it('sin sesión no llama al servidor', async () => {
      const fetchMock = mockFetch(201, { id: 5 });
      useSessionStore.getState().clearSession();

      const result = await createUser(VALID);

      expect(result.success).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('updateUser', () => {
    const EDIT: UserFormValues = {
      ...VALID,
      password: '',
      confirmPassword: '',
    };

    it('hace PUT a /api/users/:id sin contraseña si se deja vacía', async () => {
      const fetchMock = mockFetch(200, { success: true });

      const result = await updateUser(7, EDIT);

      expect(result.success).toBe(true);
      const call = firstCall(fetchMock);
      expect(call.url).toMatch(/\/api\/users\/7$/);
      expect(call.method).toBe('PUT');
      expect(call.body).toEqual({
        nombre: 'Ana',
        apellidoPaterno: 'Quispe',
        apellidoMaterno: 'Mamani',
      });
      expect(call.body).not.toHaveProperty('password');
    });

    it('envía la contraseña solo cuando se escribe una nueva', async () => {
      const fetchMock = mockFetch(200, { success: true });

      await updateUser(7, { ...EDIT, password: 'contraseñaNueva456', confirmPassword: 'contraseñaNueva456' });

      expect(firstCall(fetchMock).body?.password).toBe('contraseñaNueva456');
    });

    it('rechaza una contraseña nueva que no coincide, sin llamar al servidor', async () => {
      const fetchMock = mockFetch(200, { success: true });

      const result = await updateUser(7, { ...EDIT, password: 'contraseñaNueva456', confirmPassword: 'distinta' });

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Las contraseñas no coinciden.');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rechaza una contraseña nueva demasiado corta', async () => {
      const fetchMock = mockFetch(200, { success: true });

      const result = await updateUser(7, { ...EDIT, password: '1234567', confirmPassword: '1234567' });

      expect(result.success).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rechaza escribir solo la confirmación sin contraseña', async () => {
      const fetchMock = mockFetch(200, { success: true });

      const result = await updateUser(7, { ...EDIT, confirmPassword: 'algo' });

      expect(result.success).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('searchUsers', () => {
    it('traduce las filas del Worker (snake_case) al formato de la tabla', async () => {
      mockFetch(200, {
        users: [
          {
            id: 1,
            username: 'admin',
            nombre: 'Administrador',
            apellido_paterno: 'De',
            apellido_materno: 'Prueba',
            parroquia_nombre: null,
            activo: 1,
          },
          {
            id: 3,
            username: 'secretaria2',
            nombre: 'Ana',
            apellido_paterno: 'Quispe',
            apellido_materno: 'Mamani',
            parroquia_nombre: 'Parroquia 2',
            activo: 0,
          },
        ],
        totalPages: 2,
      });

      const result = await searchUsers({ sortBy: 'nombre', sortDirection: 'asc', page: 1 });

      expect(result.success).toBe(true);
      expect(result.totalPages).toBe(2);
      expect(result.users).toEqual([
        {
          id: 1,
          username: 'admin',
          nombre: 'Administrador',
          apellidoPaterno: 'De',
          apellidoMaterno: 'Prueba',
          parroquiaNombre: null,
          activo: true,
        },
        {
          id: 3,
          username: 'secretaria2',
          nombre: 'Ana',
          apellidoPaterno: 'Quispe',
          apellidoMaterno: 'Mamani',
          parroquiaNombre: 'Parroquia 2',
          activo: false,
        },
      ]);
    });

    it('pide al Worker el campo de orden en snake_case y conserva los filtros', async () => {
      const fetchMock = mockFetch(200, { users: [], totalPages: 1 });

      await searchUsers({
        apellidoPaterno: 'Quispe',
        sortBy: 'apellidoPaterno',
        sortDirection: 'desc',
        page: 2,
      });

      const query = new URL(firstCall(fetchMock).url).searchParams;
      expect(query.get('apellidoPaterno')).toBe('Quispe');
      expect(query.get('sortBy')).toBe('apellido_paterno');
      expect(query.get('sortDirection')).toBe('desc');
      expect(query.get('page')).toBe('2');
    });

    it('devuelve el mensaje del Worker si responde 403', async () => {
      mockFetch(403, { message: 'Solo un administrador puede gestionar usuarios.' });

      const result = await searchUsers({ sortBy: 'nombre', sortDirection: 'asc', page: 1 });

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Solo un administrador puede gestionar usuarios.');
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
