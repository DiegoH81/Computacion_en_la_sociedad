// Los permisos por rol al sincronizar: el ayudante (usuario) solo pide cambios, el párroco
// (admin_parroquia) los aprueba, el historial solo crece, y las cuentas creadas sin internet se suben después.
import { beforeEach, describe, expect, it } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import { hash_password, sign_jwt } from '../src/utils/crypto';
import { login } from '../src/controllers/login';
import type { ChangeRequestData, ChangeResult, HistoryData, PersonCorrection, RecordData, SyncChange, UserData } from '../../shared/sync';
import { resetDatabase } from './helpers/resetDatabase';

const db = () => env.prelatura_db;

const tokenParroco = () => sign_jwt({ usuarioId: 1, rol: 'admin_parroquia', parroquiaId: 1 }, env.JWT_SECRET);
const tokenAyudante = () => sign_jwt({ usuarioId: 4, rol: 'usuario', parroquiaId: 1 }, env.JWT_SECRET);
const tokenGeneral = () => sign_jwt({ usuarioId: 3, rol: 'admin_general', parroquiaId: null }, env.JWT_SECRET);

async function push(token: string, cambios: SyncChange[]): Promise<ChangeResult[]> {
  const response = await SELF.fetch('https://example.com/api/sync/push', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ cambios }),
  });
  expect(response.status).toBe(200);
  return ((await response.json()) as { resultados: ChangeResult[] }).resultados;
}

async function stored(token: string): Promise<RecordData> {
  const response = await SELF.fetch('https://example.com/api/sync/record?entidad=bautismo&client_id=partida-1', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return ((await response.json()) as { registro: RecordData }).registro;
}

const persona = (nombres = 'Diego') => ({
  client_id: 'persona-1',
  dni: null,
  nombres,
  apellido_paterno: 'Guido',
  apellido_materno: 'Alvaro',
  fecha_nacimiento: null,
  fecha_aproximada: null,
  lugar_nacimiento: null,
  padre: null,
  madre: null,
});

const bautismo = (overrides: Partial<RecordData> = {}): RecordData => ({
  tipo: 'bautismo',
  client_id: 'partida-1',
  parroquia_id: 1,
  ministro_client_id: null,
  libro: '1',
  folio: '0.1',
  numero: '3',
  fecha_emision: '2020-01-01',
  fecha_evento: null,
  anotaciones: null,
  estado: 'vigente',
  anulado_por_usuario_id: null,
  anulado_en: null,
  motivo_anulacion: null,
  personas: [persona()],
  detalle: { padrino_1: null, padrino_2: null },
  cambios: [],
  solicitudes: [],
  historial: [],
  ...overrides,
});

// Una corrección por nota marginal ya aplicada (la guarda un administrador).
const correccion = (overrides: Partial<PersonCorrection> = {}): PersonCorrection => ({
  client_id: 'cambio-1',
  persona_client_id: 'persona-1',
  usuario_id: 4,
  campo_cambio: 'nombres',
  valor_anterior: 'Diego',
  valor_nuevo: 'Diogo',
  fecha_cambio: '2026-01-02T00:00:00.000Z',
  estado: 'aprobado',
  revisado_por_usuario_id: 1,
  revisado_en: '2026-01-02T00:00:00.000Z',
  ...overrides,
});

const solicitud = (overrides: Partial<ChangeRequestData> = {}): ChangeRequestData => ({
  client_id: 'solicitud-1',
  usuario_id: 4,
  parte: 'detalle',
  campo: 'padrino_1',
  tipo: 'digitacion',
  valor_anterior: null,
  valor_nuevo: 'Mario',
  estado: 'pendiente',
  motivo: null,
  revisado_por_usuario_id: null,
  revisado_en: null,
  creado_en: '2026-01-02T00:00:00.000Z',
  ...overrides,
});

const evento = (overrides: Partial<HistoryData> = {}): HistoryData => ({
  client_id: 'evento-1',
  usuario_id: 4,
  evento: 'cambio_pedido',
  motivo: null,
  fecha: '2026-01-02T00:00:00.000Z',
  campos: [{ parte: 'detalle', campo: 'padrino_1', valor_anterior: null, valor_nuevo: 'Mario' }],
  ...overrides,
});

const cambio = (datos: RecordData | UserData, version_base: number | null, cola_id: string, entidad?: SyncChange['entidad']): SyncChange => ({
  entidad: entidad ?? ('tipo' in datos ? datos.tipo : 'usuario'),
  client_id: datos.client_id,
  version_base,
  cola_id,
  datos,
});

beforeEach(async () => {
  await resetDatabase(db());
  await db().batch([
    db().prepare(`INSERT INTO parroquias (id, nombre) VALUES (1, 'Parroquia 1'), (2, 'Parroquia 2')`),
    db().prepare(
      `INSERT INTO usuarios (id, username, password_hash, rol, parroquia_id, nombre, apellido_paterno, apellido_materno, principal)
       VALUES (1, 'parroco', 'h', 'admin_parroquia', 1, 'P', 'U', 'N', 0),
              (3, 'general', 'h', 'admin_general', NULL, 'A', 'D', 'M', 1),
              (4, 'ayudante', 'h', 'usuario', 1, 'A', 'Y', 'U', 0)`,
    ),
  ]);
});

describe('el ayudante (usuario)', () => {
  it('registra una partida nueva; sus correcciones van como solicitudes, no aplicadas', async () => {
    const [nueva] = await push(await tokenAyudante(), [
      cambio(bautismo({ solicitudes: [solicitud({ parte: 'persona', campo: 'nombres', tipo: 'nota_marginal', valor_anterior: 'Diego', valor_nuevo: 'Diogo' })], historial: [evento({ evento: 'registrada', campos: [] })] }), null, 'c1'),
    ]);
    expect(nueva).toMatchObject({ estado: 'aplicado' });
    expect(await stored(await tokenParroco())).toMatchObject({ solicitudes: [{ estado: 'pendiente', tipo: 'nota_marginal' }], historial: [{ evento: 'registrada' }] });

    const [aplicada] = await push(await tokenAyudante(), [
      cambio(bautismo({ client_id: 'partida-2', personas: [{ ...persona(), client_id: 'persona-2' }], cambios: [correccion({ persona_client_id: 'persona-2' })] }), null, 'c2'),
    ]);
    expect(aplicada).toMatchObject({ estado: 'rechazado', motivo: expect.stringContaining('debe pedirlas') });
  });

  it('en una partida guardada no cambia datos: los pide, de a una solicitud a la vez', async () => {
    await push(await tokenParroco(), [cambio(bautismo(), null, 'c1')]);

    const [editada] = await push(await tokenAyudante(), [cambio(bautismo({ libro: '9' }), 1, 'c2')]);
    expect(editada).toMatchObject({ estado: 'rechazado', motivo: expect.stringContaining('debe pedir el cambio') });

    const [padrino] = await push(await tokenAyudante(), [cambio(bautismo({ detalle: { padrino_1: 'Mario', padrino_2: null } }), 1, 'c3')]);
    expect(padrino).toMatchObject({ estado: 'rechazado' });

    const [pide] = await push(await tokenAyudante(), [cambio(bautismo({ solicitudes: [solicitud()], historial: [evento()] }), 1, 'c4')]);
    expect(pide).toMatchObject({ estado: 'aplicado', version: 2 });
    expect(await stored(await tokenParroco())).toMatchObject({ detalle: { padrino_1: null }, solicitudes: [{ client_id: 'solicitud-1', estado: 'pendiente' }] });

    const [otra] = await push(await tokenAyudante(), [cambio(bautismo({ solicitudes: [solicitud(), solicitud({ client_id: 'solicitud-2', campo: 'padrino_2' })] }), 2, 'c5')]);
    expect(otra).toMatchObject({ estado: 'rechazado', motivo: expect.stringContaining('ya tiene un cambio pendiente') });
  });

  it('escribe la nota marginal solo si estaba en blanco', async () => {
    await push(await tokenParroco(), [cambio(bautismo(), null, 'c1')]);

    const [primera] = await push(await tokenAyudante(), [cambio(bautismo({ anotaciones: 'Contrajo matrimonio en 2002.' }), 1, 'c2')]);
    expect(primera).toMatchObject({ estado: 'aplicado' });

    const [cambia] = await push(await tokenAyudante(), [cambio(bautismo({ anotaciones: 'Otra nota.' }), 2, 'c3')]);
    expect(cambia).toMatchObject({ estado: 'rechazado', motivo: expect.stringContaining('ya tiene texto') });
    expect((await stored(await tokenParroco())).anotaciones).toBe('Contrajo matrimonio en 2002.');
  });

  it('no aprueba sus propios pedidos, no pide a nombre de otro ni anula partidas', async () => {
    await push(await tokenParroco(), [cambio(bautismo(), null, 'c1')]);
    await push(await tokenAyudante(), [cambio(bautismo({ solicitudes: [solicitud()] }), 1, 'c2')]);

    const [aprueba] = await push(await tokenAyudante(), [cambio(bautismo({ solicitudes: [solicitud({ estado: 'aprobado', revisado_por_usuario_id: 4 })] }), 2, 'c3')]);
    expect(aprueba).toMatchObject({ estado: 'rechazado', motivo: expect.stringContaining('administrador') });

    const [ajeno] = await push(await tokenAyudante(), [
      cambio(bautismo({ client_id: 'partida-3', personas: [{ ...persona(), client_id: 'persona-3' }], historial: [evento({ usuario_id: 1 })] }), null, 'c4'),
    ]);
    expect(ajeno).toMatchObject({ estado: 'rechazado', motivo: expect.stringContaining('lo que hizo él') });

    const [anula] = await push(await tokenAyudante(), [
      cambio(bautismo({ client_id: 'partida-4', personas: [{ ...persona(), client_id: 'persona-4' }], estado: 'anulado', anulado_por_usuario_id: 4, anulado_en: '2026-01-01', motivo_anulacion: 'x' }), null, 'c5'),
    ]);
    expect(anula).toMatchObject({ estado: 'rechazado', motivo: expect.stringContaining('anular') });
  });

  it('una PC con la versión anterior de la app no sube correcciones pendientes', async () => {
    const [vieja] = await push(await tokenAyudante(), [cambio(bautismo({ cambios: [correccion({ estado: 'pendiente', revisado_por_usuario_id: null, revisado_en: null })] }), null, 'c1')]);
    expect(vieja).toMatchObject({ estado: 'rechazado', motivo: expect.stringContaining('versión anterior') });
  });
});

describe('el párroco (admin_parroquia)', () => {
  it('aprueba lo pedido: cambia el dato, cierra la solicitud y el historial queda completo', async () => {
    await push(await tokenParroco(), [cambio(bautismo({ historial: [evento({ client_id: 'e-0', usuario_id: 1, evento: 'registrada', campos: [] })] }), null, 'c1')]);
    await push(await tokenAyudante(), [cambio(bautismo({ solicitudes: [solicitud()], historial: [evento()] }), 1, 'c2')]);

    const aprobada = bautismo({
      detalle: { padrino_1: 'Mario', padrino_2: null },
      solicitudes: [solicitud({ estado: 'aprobado', revisado_por_usuario_id: 1, revisado_en: '2026-01-03T00:00:00.000Z' })],
      historial: [evento({ client_id: 'e-0', usuario_id: 1, evento: 'registrada', campos: [] }), evento(), evento({ client_id: 'evento-2', usuario_id: 1, evento: 'cambio_aprobado' })],
    });
    const [r] = await push(await tokenParroco(), [cambio(aprobada, 2, 'c3')]);
    expect(r).toMatchObject({ estado: 'aplicado', version: 3 });

    const record = await stored(await tokenParroco());
    expect(record.detalle.padrino_1).toBe('Mario');
    expect(record.solicitudes).toMatchObject([{ estado: 'aprobado', revisado_por_usuario_id: 1 }]);
    expect(record.historial.map((entry) => entry.evento)).toEqual(['registrada', 'cambio_pedido', 'cambio_aprobado']);
    expect(record.historial[1].campos).toEqual([{ parte: 'detalle', campo: 'padrino_1', valor_anterior: null, valor_nuevo: 'Mario' }]);
  });

  it('el historial solo crece: un evento que ya está no se reescribe', async () => {
    await push(await tokenParroco(), [cambio(bautismo({ historial: [evento({ usuario_id: 1, evento: 'registrada', campos: [] })] }), null, 'c1')]);
    const [r] = await push(await tokenParroco(), [cambio(bautismo({ historial: [evento({ usuario_id: 1, evento: 'anulada', motivo: 'inventado', campos: [] })] }), 1, 'c2')]);
    expect(r).toMatchObject({ estado: 'aplicado' });
    expect((await stored(await tokenParroco())).historial).toMatchObject([{ evento: 'registrada', motivo: null }]);
  });

  it('rechaza solicitudes o eventos con datos que no existen en ese tipo de partida', async () => {
    const [r] = await push(await tokenParroco(), [cambio(bautismo({ solicitudes: [solicitud({ parte: 'conyuge_2', campo: 'madre' })] }), null, 'c1')]);
    expect(r).toMatchObject({ estado: 'rechazado', motivo: expect.stringContaining('no es válido') });
  });
});

describe('usuarios creados en una PC', () => {
  const cuenta = (overrides: Partial<UserData> = {}): UserData => ({
    client_id: 'cuenta-1',
    id: -1,
    parroquia_id: 1,
    username: 'nuevo.ayudante',
    rol: 'usuario',
    nombre: 'Nuevo',
    apellido_paterno: 'Ayudante',
    apellido_materno: '',
    activo: 1,
    password_hash: null,
    ...overrides,
  });

  it('el párroco crea un ayudante sin internet: al subirlo recibe su id y puede iniciar sesión', async () => {
    const hash = await hash_password('clave-del-ayudante');
    const [r] = await push(await tokenParroco(), [cambio(cuenta({ password_hash: hash }), null, 'u1')]);

    expect(r).toMatchObject({ estado: 'aplicado', version: 1 });
    expect((r as { id: number }).id).toBeGreaterThan(4);

    const session = await login(db(), env.JWT_SECRET, 'nuevo.ayudante', 'clave-del-ayudante');
    expect(session.usuario).toMatchObject({ rol: 'usuario', parroquia_id: 1 });
  });

  it('una edición posterior cambia nombre y contraseña, con control de versión', async () => {
    await push(await tokenParroco(), [cambio(cuenta({ password_hash: await hash_password('primera-clave') }), null, 'u1')]);

    const [edit] = await push(await tokenParroco(), [cambio(cuenta({ nombre: 'Renombrado', password_hash: await hash_password('segunda-clave') }), 1, 'u2')]);
    expect(edit).toMatchObject({ estado: 'aplicado', version: 2 });
    await expect(login(db(), env.JWT_SECRET, 'nuevo.ayudante', 'segunda-clave')).resolves.toBeTruthy();

    const [viejo] = await push(await tokenParroco(), [cambio(cuenta({ nombre: 'Otro' }), 1, 'u3')]);
    expect(viejo).toMatchObject({ estado: 'conflicto', version: 2 });
  });

  it('rechaza un username repetido, cuentas fuera de su parroquia y administradores', async () => {
    const hash = await hash_password('una-clave-cualquiera');
    const results = await push(await tokenParroco(), [
      cambio(cuenta({ username: 'AYUDANTE', password_hash: hash }), null, 'u1'),
      cambio(cuenta({ client_id: 'cuenta-2', parroquia_id: 2, password_hash: hash }), null, 'u2'),
      cambio(cuenta({ client_id: 'cuenta-3', rol: 'admin_parroquia', password_hash: hash }), null, 'u3'),
      cambio(cuenta({ client_id: 'cuenta-4' }), null, 'u4'),
    ]);

    expect(results.map((r) => r.estado)).toEqual(['rechazado', 'rechazado', 'rechazado', 'rechazado']);
    expect((results[0] as { motivo: string }).motivo).toContain('ya existe');
    expect((results[3] as { motivo: string }).motivo).toContain('contraseña');
  });

  it('el ayudante no crea cuentas; el administrador general sí, de cualquier parroquia', async () => {
    const hash = await hash_password('una-clave-cualquiera');
    const [ayudante] = await push(await tokenAyudante(), [cambio(cuenta({ password_hash: hash }), null, 'u1')]);
    expect(ayudante).toMatchObject({ estado: 'rechazado' });

    const [general] = await push(await tokenGeneral(), [cambio(cuenta({ parroquia_id: 2, rol: 'admin_parroquia', password_hash: hash }), null, 'u2')]);
    expect(general).toMatchObject({ estado: 'aplicado' });
  });

  it('no deja cambiar el rol ni deshabilitarse a sí mismo', async () => {
    const helper = await db().prepare('SELECT client_id FROM usuarios WHERE id = 4').first<{ client_id: string }>();
    const ascendido: UserData = { client_id: helper!.client_id, parroquia_id: 1, username: 'ayudante', rol: 'admin_parroquia', nombre: 'A', apellido_paterno: 'Y', apellido_materno: 'U', activo: 1 };
    const [rol] = await push(await tokenParroco(), [cambio(ascendido, 1, 'u1')]);
    expect(rol).toMatchObject({ estado: 'rechazado', motivo: expect.stringContaining('rol') });

    const own = await db().prepare('SELECT client_id FROM usuarios WHERE id = 1').first<{ client_id: string }>();
    const yo: UserData = { client_id: own!.client_id, parroquia_id: 1, username: 'parroco', rol: 'admin_parroquia', nombre: 'P', apellido_paterno: 'U', apellido_materno: 'N', activo: 0 };
    const [off] = await push(await tokenParroco(), [cambio(yo, 1, 'u2')]);
    expect(off).toMatchObject({ estado: 'rechazado', motivo: expect.stringContaining('propia cuenta') });
  });
});
