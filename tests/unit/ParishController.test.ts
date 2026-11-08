import { useSessionStore } from '../../src/store/sessionStore';
import { loadAllParishes, saveParish, toggleParishActive } from '../../src/controllers/ParishController';
import { OFFLINE_TOKEN } from '../../electron/shared';

// Gestión de parroquias desde la pantalla: qué se manda al Worker y qué se muestra.

function mockFetch(status: number, responseBody: unknown) {
  const fn = vi.fn<(url: string, init?: RequestInit) => Promise<unknown>>(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => responseBody,
  }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

function call(fn: ReturnType<typeof mockFetch>) {
  const [url, init] = fn.mock.calls[0];
  return { url, method: init?.method ?? 'GET', body: init?.body ? JSON.parse(init.body as string) : undefined };
}

describe('ParishController', () => {
  beforeEach(() => {
    useSessionStore.getState().setSession({
      token: 'token-de-prueba',
      usuarioId: 1,
      usuarioNombre: 'Admin',
      rol: 'admin_general',
      parroquiaId: null,
      parroquiaActivaId: 1,
      parroquiaActivaNombre: 'Parroquia 1',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    useSessionStore.getState().clearSession();
  });

  it('carga todas las parroquias de GET /api/parishes/todas', async () => {
    const parroquias = [{ id: 1, nombre: 'San Pedro', ubicacion: null, activa: 0 }];
    const fetchMock = mockFetch(200, { parroquias });

    expect(await loadAllParishes()).toEqual({ success: true, parishes: parroquias });
    expect(call(fetchMock).url).toMatch(/\/api\/parishes\/todas$/);
  });

  it('sin id crea con POST; con id edita con PUT. El nombre va sin espacios y la ubicación vacía como null', async () => {
    let fetchMock = mockFetch(201, { id: 9 });
    await saveParish({ nombre: '  Nueva  ', ubicacion: '  ' });
    expect(call(fetchMock)).toMatchObject({ method: 'POST', body: { nombre: 'Nueva', ubicacion: null } });

    fetchMock = mockFetch(200, { success: true });
    await saveParish({ id: 4, nombre: 'Renombrada', ubicacion: 'Puno' });
    expect(call(fetchMock).url).toMatch(/\/api\/parishes\/4$/);
    expect(call(fetchMock)).toMatchObject({ method: 'PUT', body: { id: 4, nombre: 'Renombrada', ubicacion: 'Puno' } });
  });

  it('sin nombre no llama al servidor, y muestra el rechazo del Worker', async () => {
    const fetchMock = mockFetch(201, { id: 9 });
    expect(await saveParish({ nombre: ' ', ubicacion: null })).toEqual({ success: false, errorMessage: 'El nombre de la parroquia es requerido.' });
    expect(fetchMock).not.toHaveBeenCalled();

    mockFetch(409, { message: 'Ya existe una parroquia con ese nombre.' });
    expect(await saveParish({ nombre: 'San Pedro', ubicacion: null })).toEqual({ success: false, errorMessage: 'Ya existe una parroquia con ese nombre.' });
  });

  it('toggle hace PATCH; sin conexión avisa sin llamar al servidor', async () => {
    let fetchMock = mockFetch(200, { success: true });
    expect((await toggleParishActive(2)).success).toBe(true);
    expect(call(fetchMock)).toMatchObject({ method: 'PATCH' });
    expect(call(fetchMock).url).toMatch(/\/api\/parishes\/2\/toggle-active$/);

    fetchMock = mockFetch(200, { success: true });
    useSessionStore.setState({ token: OFFLINE_TOKEN });
    expect(await toggleParishActive(2)).toEqual({ success: false, errorMessage: 'La gestión de parroquias necesita conexión a internet.' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
