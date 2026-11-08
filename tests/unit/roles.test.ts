// @vitest-environment node
// Los tres roles en la PC: el ayudante (usuario) pide cambios que el párroco (admin_parroquia) aprueba,
// el historial de cada partida, y las cuentas que se crean y editan aquí sin internet.
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Baptism } from '../../shared/models';
import type { ChangeResult, SyncChange, UserData } from '../../shared/sync';
import { open_local_database, type LocalDatabase } from '../../electron/main/db/database';
import { verify_offline } from '../../electron/main/controllers/login';
import { list_pending, review_requests } from '../../electron/main/controllers/requests';
import { annul_sacrament, create_person_sacrament, read_person_sacrament, sacrament_history, search_sacraments, update_person_sacrament } from '../../electron/main/controllers/sacraments';
import { create_user, search_users, toggle_user_active, update_user } from '../../electron/main/controllers/users';
import type { Session } from '../../electron/main/models/session';
import type { RemoteOptions, RemoteRequest } from '../../electron/main/sync/online';
import { push_pending, save_reference_data } from '../../electron/main/sync/sync';
import { baptism, change, TEST_MINISTER } from './helpers/records';

const parroco: Session = { user_id: 1, role: 'admin_parroquia', parish_id: 1, token: 't' };
const ayudante: Session = { user_id: 4, role: 'usuario', parish_id: 1, token: 't' };
const general: Session = { user_id: 3, role: 'admin_general', parish_id: null, token: 't' };
const otroParroco: Session = { user_id: 2, role: 'admin_parroquia', parish_id: 2, token: 't' };

let dir: string;
let db: LocalDatabase;

const input = (values: Parameters<typeof baptism>[1] = {}) =>
  baptism('bautismo', {
    ...values,
    sacramento: { fecha_emision: '2020-01-01', libro: '1', folio: '0.1', numero: '3', ...values.sacramento },
    persona: { nombres: 'Diago', apellido_paterno: 'Guido', apellido_materno: 'Alvaro', ...values.persona },
  });

const read = (id: number) => read_person_sacrament(db, 'bautismo', id);
const queued = () => db.prepare('SELECT entidad, client_id, version_base FROM sync_cola ORDER BY id').all() as { entidad: string; client_id: string; version_base: number | null }[];

// Lo que el formulario manda para pedir una corrección: la partida tal como se leyó, más la nota.
const withCorrection = (record: Baptism, nombres: string): Baptism => ({
  ...record,
  persona: { ...record.persona, cambios: [...record.persona.cambios, change('nombres', nombres)] },
});

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'prelatura-roles-'));
  db = open_local_database(path.join(dir, 'local.db'), randomBytes(32).toString('hex'));
  const user = (id: number, parroquia_id: number | null, rol: UserData['rol'], principal = 0) => ({
    id,
    client_id: `servidor-${id}`,
    parroquia_id,
    username: `user${id}`,
    rol,
    nombre: 'U',
    apellido_paterno: 'P',
    apellido_materno: 'M',
    activo: 1,
    principal,
    version: 1,
  });
  save_reference_data(db, {
    parroquias: [
      { id: 1, nombre: 'Parroquia 1', ubicacion: null, activa: 1 },
      { id: 2, nombre: 'Parroquia 2', ubicacion: null, activa: 1 },
    ],
    ministros: [TEST_MINISTER],
    usuarios: [user(1, 1, 'admin_parroquia'), user(2, 2, 'admin_parroquia'), user(3, null, 'admin_general', 1), user(4, 1, 'usuario')],
  });
});

afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('solicitudes de cambio', () => {
  const pending = (id: number) => read(id).sacramento.solicitudes?.filter((request) => request.estado === 'pendiente') ?? [];

  it('la nota marginal en blanco el ayudante la escribe una sola vez; después la tiene que pedir', () => {
    const id = create_person_sacrament(db, 'bautismo', parroco, input());
    const withNote = (text: string) => ({ ...read(id), sacramento: { ...read(id).sacramento, anotaciones: text } });

    update_person_sacrament(db, 'bautismo', ayudante, withNote('Contrajo matrimonio en 2002.'));
    expect(read(id).sacramento.anotaciones).toBe('Contrajo matrimonio en 2002.');
    expect(pending(id)).toEqual([]);

    update_person_sacrament(db, 'bautismo', ayudante, withNote('Otra nota.'));
    expect(read(id).sacramento.anotaciones).toBe('Contrajo matrimonio en 2002.');
    expect(pending(id)).toMatchObject([{ parte: 'sacramento', campo: 'anotaciones', tipo: 'digitacion', valor_anterior: 'Contrajo matrimonio en 2002.', valor_nuevo: 'Otra nota.', solicitado_por: 'U P M' }]);
  });

  it('cualquier dato del formulario se pide, y la partida no cambia hasta que se apruebe', () => {
    const id = create_person_sacrament(db, 'bautismo', parroco, input());
    const record = read(id);

    update_person_sacrament(db, 'bautismo', ayudante, { ...record, sacramento: { ...record.sacramento, folio: '7' }, persona: { ...record.persona, padre: 'Juan Quispe Mamani' }, padrino_1: 'Mario' });

    expect(read(id)).toMatchObject({ sacramento: { folio: '0.1' }, persona: { padre: 'Pedro Prueba' }, padrino_1: null });
    expect(pending(id).map((request) => [request.parte, request.campo, request.valor_nuevo])).toEqual([
      ['sacramento', 'folio', '7'],
      ['persona', 'padre', 'Juan Quispe Mamani'],
      ['detalle', 'padrino_1', 'Mario'],
    ]);

    // Mientras espera, el ayudante no pide otra cosa.
    expect(() => update_person_sacrament(db, 'bautismo', ayudante, { ...read(id), padrino_2: 'Rosa' })).toThrow(/pendiente/);

    review_requests(db, parroco, id, 'aprobado');
    expect(read(id)).toMatchObject({ sacramento: { folio: '7' }, persona: { padre: 'Juan Quispe Mamani' }, padrino_1: 'Mario' });
    expect(pending(id)).toEqual([]);
    expect(list_pending(db, parroco)).toEqual([]);
  });

  it('sin cambios no hay nada que pedir, y no se puede pedir borrar un dato obligatorio', () => {
    const id = create_person_sacrament(db, 'bautismo', parroco, input());
    expect(() => update_person_sacrament(db, 'bautismo', ayudante, read(id))).toThrow('No hay cambios para pedir.');
    expect(() => update_person_sacrament(db, 'bautismo', ayudante, { ...read(id), persona: { ...read(id).persona, madre: '' } })).toThrow('Faltan datos: madre.');
  });

  it('la corrección por nota marginal, al aprobarse, conserva el nombre anterior para la búsqueda', () => {
    const id = create_person_sacrament(db, 'bautismo', parroco, input());
    update_person_sacrament(db, 'bautismo', ayudante, withCorrection(read(id), 'Diego'));

    expect(read(id).persona.nombres).toBe('Diago');
    expect(pending(id)).toMatchObject([{ parte: 'persona', campo: 'nombres', tipo: 'nota_marginal', valor_anterior: 'Diago', valor_nuevo: 'Diego' }]);
    expect(search_sacraments(db, 'bautismo', { nombres: 'Diego' }).resultados).toHaveLength(0);

    expect(list_pending(db, parroco).map((item) => item.partida.sacramento.id)).toEqual([id]);
    review_requests(db, parroco, id, 'aprobado');

    const record = read(id);
    expect(record.persona.nombres).toBe('Diego');
    expect(record.persona.cambios[0]).toMatchObject({ estado: 'aprobado', valor_anterior: 'Diago', revisado_por_usuario_id: 1 });
    expect(search_sacraments(db, 'bautismo', { nombres: 'Diago' }).resultados).toHaveLength(1);
    expect(record.sacramento.solicitudes).toMatchObject([{ estado: 'aprobado', revisado_por: 'U P M' }]);
  });

  it('rechazarla deja el dato como estaba, y el ayudante puede pedir otra', () => {
    const id = create_person_sacrament(db, 'bautismo', parroco, input());
    update_person_sacrament(db, 'bautismo', ayudante, withCorrection(read(id), 'Diego'));
    review_requests(db, parroco, id, 'rechazado');

    expect(read(id).persona).toMatchObject({ nombres: 'Diago', cambios: [] });
    expect(read(id).sacramento.solicitudes).toMatchObject([{ estado: 'rechazado' }]);
    update_person_sacrament(db, 'bautismo', ayudante, withCorrection(read(id), 'Diogo'));
    expect(pending(id)).toHaveLength(1);
  });

  it('si el administrador edita con un cambio pendiente: queda aprobado si usó lo pedido, descartado si no', () => {
    const used = create_person_sacrament(db, 'bautismo', parroco, input());
    update_person_sacrament(db, 'bautismo', ayudante, { ...read(used), padrino_1: 'Mario' });
    update_person_sacrament(db, 'bautismo', parroco, { ...read(used), padrino_1: 'Mario', padrino_2: 'Rosa' });
    expect(read(used)).toMatchObject({ padrino_1: 'Mario', padrino_2: 'Rosa' });
    expect(read(used).sacramento.solicitudes).toMatchObject([{ estado: 'aprobado' }]);

    const ignored = create_person_sacrament(db, 'bautismo', parroco, input({ sacramento: { numero: '4' } }));
    update_person_sacrament(db, 'bautismo', ayudante, { ...read(ignored), padrino_1: 'Mario' });
    update_person_sacrament(db, 'bautismo', parroco, { ...read(ignored), padrino_2: 'Rosa' });
    expect(read(ignored)).toMatchObject({ padrino_1: null, padrino_2: 'Rosa' });
    expect(read(ignored).sacramento.solicitudes).toMatchObject([{ estado: 'descartado', motivo: 'Descartada al editar la partida' }]);
  });

  it('solo un administrador de esa parroquia revisa los cambios', () => {
    const id = create_person_sacrament(db, 'bautismo', parroco, input());
    update_person_sacrament(db, 'bautismo', ayudante, withCorrection(read(id), 'Diego'));

    expect(() => review_requests(db, ayudante, id, 'aprobado')).toThrow(/administrador de la parroquia/);
    expect(() => review_requests(db, otroParroco, id, 'aprobado')).toThrow(/otra parroquia/);
    expect(() => review_requests(db, general, id, 'aprobado')).toThrow(/solo consulta/);
    expect(() => list_pending(db, ayudante)).toThrow(/administrador de la parroquia/);
    expect(read(id).persona.nombres).toBe('Diago');
  });

  it('al registrar, la corrección del ayudante queda pedida; la del párroco se aplica', () => {
    const helperId = create_person_sacrament(db, 'bautismo', ayudante, input({ persona: { cambios: [change('nombres', 'Diego')] } }));
    const parishId = create_person_sacrament(db, 'bautismo', parroco, input({ sacramento: { numero: '4' }, persona: { cambios: [change('nombres', 'Diego')] } }));

    expect(read(helperId).persona).toMatchObject({ nombres: 'Diago', cambios: [] });
    expect(pending(helperId)).toMatchObject([{ tipo: 'nota_marginal', valor_nuevo: 'Diego' }]);
    expect(read(parishId).persona).toMatchObject({ nombres: 'Diego', cambios: [{ estado: 'aprobado', revisado_por_usuario_id: 1 }] });
  });

  it('el ayudante no anula partidas, ni pide cambios en una anulada', () => {
    const id = create_person_sacrament(db, 'bautismo', ayudante, input());
    expect(() => annul_sacrament(db, ayudante, id, 'motivo')).toThrow(/administrador de la parroquia/);

    annul_sacrament(db, parroco, id, 'Duplicada');
    expect(() => update_person_sacrament(db, 'bautismo', ayudante, { ...read(id), padrino_1: 'X' })).toThrow(/anulada/);
  });
});

describe('historial de la partida', () => {
  it('anota quién hizo qué, con los datos que cambiaron, el más nuevo primero', () => {
    const id = create_person_sacrament(db, 'bautismo', ayudante, input());
    update_person_sacrament(db, 'bautismo', ayudante, { ...read(id), padrino_1: 'Mario' });
    review_requests(db, parroco, id, 'aprobado');
    update_person_sacrament(db, 'bautismo', parroco, withCorrection(read(id), 'Diego'));
    annul_sacrament(db, parroco, id, 'Duplicada');

    const history = sacrament_history(db, parroco, id);
    expect(history.map((entry) => entry.evento)).toEqual(['anulada', 'correccion', 'cambio_aprobado', 'cambio_pedido', 'registrada']);
    expect(history[0]).toMatchObject({ motivo: 'Duplicada', usuario: 'U P M' });
    expect(history[1].campos).toEqual([{ parte: 'persona', campo: 'nombres', texto_anterior: 'Diago', texto_nuevo: 'Diego' }]);
    expect(history[3].campos).toEqual([{ parte: 'detalle', campo: 'padrino_1', texto_anterior: null, texto_nuevo: 'Mario' }]);
  });

  it('una edición guarda solo los datos que cambiaron, y el celebrante con su nombre', () => {
    db.prepare(`INSERT INTO ministros (id, client_id, parroquia_id, titulo, nombre, apellido_paterno, apellido_materno) VALUES (9, 'ministro-9', 1, 'Pbro.', 'Luis', 'Paz', 'Rey')`).run();
    const id = create_person_sacrament(db, 'bautismo', parroco, input());

    update_person_sacrament(db, 'bautismo', parroco, { ...read(id), sacramento: { ...read(id).sacramento, ministro_id: 9 } });

    const [edit] = sacrament_history(db, parroco, id);
    expect(edit).toMatchObject({ evento: 'editada', campos: [{ parte: 'sacramento', campo: 'ministro_id', texto_anterior: 'Manuel Torres Rios', texto_nuevo: 'Pbro. Luis Paz Rey' }] });
  });

  it('solo lo ven los administradores', () => {
    const id = create_person_sacrament(db, 'bautismo', parroco, input());
    expect(() => sacrament_history(db, ayudante, id)).toThrow(/administrador/);
    expect(() => sacrament_history(db, otroParroco, id)).toThrow(/su parroquia/);
    expect(sacrament_history(db, general, id)).toHaveLength(1);
  });
});

describe('cuentas creadas en esta PC', () => {
  it('el párroco crea un ayudante de su parroquia sin internet, y ese ayudante ya puede entrar aquí', async () => {
    const id = await create_user(db, parroco, { username: 'ana.ayudante', password: 'clave-segura', rol: 'usuario', parroquia_id: 2, nombre: 'Ana', apellido_paterno: 'Paz', apellido_materno: '' });

    expect(id).toBeLessThan(0);
    expect(db.prepare('SELECT rol, parroquia_id FROM usuarios WHERE id = ?').get(id)).toEqual({ rol: 'usuario', parroquia_id: 1 });
    expect(queued()).toMatchObject([{ entidad: 'usuario', version_base: null }]);

    const login = await verify_offline(db, 'ana.ayudante', 'clave-segura');
    expect(login).toMatchObject({ ok: true, usuario: { id, rol: 'usuario', parroquia_id: 1 } });
  });

  it('aplica los mismos permisos que el servidor', async () => {
    const base = { password: 'clave-segura', nombre: 'Ana', apellido_paterno: 'Paz', apellido_materno: '', parroquia_id: 1 };

    await expect(create_user(db, parroco, { ...base, username: 'admin.nuevo', rol: 'admin_parroquia' })).rejects.toMatchObject({ status: 403 });
    await expect(create_user(db, ayudante, { ...base, username: 'otro', rol: 'usuario' })).rejects.toMatchObject({ status: 403 });
    await expect(create_user(db, parroco, { ...base, username: 'USER4', rol: 'usuario' })).rejects.toMatchObject({ status: 409 });
    await expect(create_user(db, parroco, { ...base, username: 'corta', rol: 'usuario', password: '123' })).rejects.toMatchObject({ status: 400 });
    expect(() => toggle_user_active(db, parroco, 2)).toThrow(/su propia parroquia/);

    // El admin general principal crea párrocos de cualquier parroquia.
    const id = await create_user(db, general, { ...base, username: 'parroco.dos', rol: 'admin_parroquia', parroquia_id: 2 });
    expect(db.prepare('SELECT parroquia_id FROM usuarios WHERE id = ?').pluck().get(id)).toBe(2);
  });

  it('el párroco ve solo las cuentas de su parroquia', () => {
    expect(search_users(db, parroco, {}).resultados.map((user) => user.id).sort()).toEqual([1, 4]);
    expect(search_users(db, general, {}).resultados).toHaveLength(4);
    expect(() => search_users(db, ayudante, {})).toThrow(/administrador/);
  });

  it('deshabilitar una cuenta le quita la entrada en esta PC', async () => {
    await update_user(db, parroco, { id: 4, username: 'user4', rol: 'usuario', parroquia_id: 1, nombre: 'Nuevo', apellido_paterno: 'Nombre', apellido_materno: '', password: 'clave-nueva-1' });
    expect(await verify_offline(db, 'user4', 'clave-nueva-1')).toMatchObject({ ok: true });

    toggle_user_active(db, parroco, 4);
    expect(await verify_offline(db, 'user4', 'clave-nueva-1')).toMatchObject({ ok: false });
  });

  it('al subirla, la cuenta toma el id del servidor y las partidas que la nombran también', async () => {
    const provisional = await create_user(db, parroco, { username: 'ana.ayudante', password: 'clave-segura', rol: 'usuario', parroquia_id: 1, nombre: 'Ana', apellido_paterno: 'Paz', apellido_materno: '' });
    const asAna: Session = { user_id: provisional, role: 'usuario', parish_id: 1, token: 't' };
    const id = create_person_sacrament(db, 'bautismo', asAna, input({ persona: { cambios: [change('nombres', 'Diego')] } }));

    const sent: SyncChange[] = [];
    const request = (async (_path: string, options: RemoteOptions = {}) => {
      const cambios = (options.body as { cambios: SyncChange[] }).cambios;
      sent.push(...cambios);
      const results: ChangeResult[] = cambios.map((cambio) =>
        cambio.entidad === 'usuario'
          ? { entidad: 'usuario', client_id: cambio.client_id, estado: 'aplicado', version: 1, id: 50 }
          : { entidad: cambio.entidad, client_id: cambio.client_id, estado: 'aplicado', version: 1 },
      );
      return { resultados: results };
    }) as RemoteRequest;

    await push_pending(db, request, 'token');

    expect(sent[0]).toMatchObject({ entidad: 'usuario', datos: { username: 'ana.ayudante', password_hash: expect.stringMatching(/^100000:/) } });
    // La partida sale después de la cuenta, ya con el id del servidor (no con el provisional negativo).
    const record_sent = JSON.stringify(sent.filter((cambio) => cambio.entidad === 'bautismo'));
    expect(record_sent).toContain('"usuario_id":50');
    expect(record_sent).not.toMatch(/"usuario_id":-\d/);
    expect(db.prepare('SELECT id, password_hash_pendiente FROM usuarios WHERE username = ?').get('ana.ayudante')).toEqual({ id: 50, password_hash_pendiente: null });
    expect(read(id).sacramento.solicitudes?.[0]).toMatchObject({ solicitado_por: 'Ana Paz' });
    expect(db.prepare('SELECT DISTINCT usuario_id FROM historial_partidas').pluck().all()).toEqual([50]);
    expect(await verify_offline(db, 'ana.ayudante', 'clave-segura')).toMatchObject({ ok: true, usuario: { id: 50 } });
    expect(queued()).toEqual([]);
  });

  it('la referencia guarda la contraseña del servidor para entrar sin internet, pero no pisa una cuenta con cambios sin subir', async () => {
    // "clave-del-servidor" con PBKDF2 (100000 iteraciones), como la guarda el servidor.
    const { create_server_hash } = await import('../../electron/main/utils/crypto');
    const hash = await create_server_hash('clave-del-servidor');

    await update_user(db, parroco, { id: 4, username: 'user4', rol: 'usuario', parroquia_id: 1, nombre: 'Local', apellido_paterno: 'X', apellido_materno: '' });
    save_reference_data(db, {
      parroquias: [{ id: 1, nombre: 'Parroquia 1', ubicacion: null, activa: 1 }],
      ministros: [TEST_MINISTER],
      usuarios: [
        { id: 1, client_id: 'servidor-1', parroquia_id: 1, username: 'user1', rol: 'admin_parroquia', nombre: 'U', apellido_paterno: 'P', apellido_materno: 'M', activo: 1, version: 2, password_hash: hash },
        { id: 4, client_id: 'servidor-4', parroquia_id: 1, username: 'user4', rol: 'usuario', nombre: 'Servidor', apellido_paterno: 'P', apellido_materno: 'M', activo: 1, version: 5 },
      ],
    });

    expect(await verify_offline(db, 'user1', 'clave-del-servidor')).toMatchObject({ ok: true });
    expect(db.prepare('SELECT nombre FROM usuarios WHERE id = 4').pluck().get()).toBe('Local');
  });
});

describe('administrador principal de la parroquia', () => {
  const principal: Session = { user_id: 1, role: 'admin_parroquia', parish_id: 1, token: 't' };
  const otherAdmin: Session = { user_id: 5, role: 'admin_parroquia', parish_id: 1, token: 't' };
  const account = (username: string, rol: UserData['rol']) => ({ username, password: 'clave-segura', rol, parroquia_id: 1, nombre: 'Ana', apellido_paterno: 'Paz', apellido_materno: '' });

  beforeEach(() => {
    db.prepare('UPDATE usuarios SET principal = 1 WHERE id = 1').run();
    db.prepare(`INSERT INTO usuarios (id, client_id, parroquia_id, username, rol, nombre, apellido_paterno, apellido_materno, activo) VALUES (5, 'servidor-5', 1, 'user5', 'admin_parroquia', 'O', 'T', 'R', 1)`).run();
  });

  it('el principal crea administradores de su parroquia; los otros administradores, solo usuarios', async () => {
    const id = await create_user(db, principal, account('admin.delegado', 'admin_parroquia'));
    expect(db.prepare('SELECT rol, parroquia_id, principal FROM usuarios WHERE id = ?').get(id)).toEqual({ rol: 'admin_parroquia', parroquia_id: 1, principal: 0 });

    await expect(create_user(db, otherAdmin, account('otro.admin', 'admin_parroquia'))).rejects.toMatchObject({ status: 403 });
    await expect(create_user(db, otherAdmin, account('otro.ayudante', 'usuario'))).resolves.toBeLessThan(0);
  });

  it('un administrador común no toca a otros administradores, y nadie deshabilita al principal', () => {
    expect(() => toggle_user_active(db, otherAdmin, 1)).toThrow(/principal de la parroquia/);
    expect(() => toggle_user_active(db, general, 1)).toThrow(/pase la marca/);

    toggle_user_active(db, principal, 5);
    expect(db.prepare('SELECT activo FROM usuarios WHERE id = 5').pluck().get()).toBe(0);
  });

  it('el primer administrador de una parroquia sin principal queda como su principal', async () => {
    // La parroquia 2 todavía no tiene principal; la 1, sí.
    const first = await create_user(db, general, { ...account('primero.dos', 'admin_parroquia'), parroquia_id: 2 });
    const second = await create_user(db, general, { ...account('segundo.dos', 'admin_parroquia'), parroquia_id: 2 });
    const inParishOne = await create_user(db, general, { ...account('otro.uno', 'admin_parroquia'), parroquia_id: 1 });

    const principalOf = (id: number) => db.prepare('SELECT principal FROM usuarios WHERE id = ?').pluck().get(id);
    expect([principalOf(first), principalOf(second), principalOf(inParishOne)]).toEqual([1, 0, 0]);
  });
});
