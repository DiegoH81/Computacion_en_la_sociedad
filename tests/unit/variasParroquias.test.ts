// @vitest-environment node
// Cuentas que trabajan en varias parroquias, en la PC: la parroquia de trabajo de la sesión, las
// parroquias adicionales que llegan con la referencia y quién gestiona a quién.
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ChangeResult, MembershipData, SyncChange, UserData } from '../../shared/sync';
import { open_local_database, type LocalDatabase } from '../../electron/main/db/database';
import { save_credential, verify_offline } from '../../electron/main/controllers/login';
import { create_person_sacrament } from '../../electron/main/controllers/sacraments';
import { create_user, search_users, toggle_user_active } from '../../electron/main/controllers/users';
import { end_session, refresh_working_parish, require_session, select_working_parish, start_session, type Session } from '../../electron/main/models/session';
import type { RemoteOptions, RemoteRequest } from '../../electron/main/sync/online';
import { push_pending, save_reference_data } from '../../electron/main/sync/sync';
import { baptism, TEST_MINISTER, TEST_MINISTER_2 } from './helpers/records';

// 1 juan: admin y principal de la 1 · 2 rosa: admin y principal de la 2 · 3 general · 4 ana: usuario de la 1
let dir: string;
let db: LocalDatabase;

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

function reference(memberships: MembershipData[]) {
  save_reference_data(db, {
    parroquias: [
      { id: 1, nombre: 'San Pedro', ubicacion: null, activa: 1 },
      { id: 2, nombre: 'Santa Rosa', ubicacion: null, activa: 1 },
      { id: 3, nombre: 'San José', ubicacion: null, activa: 1 },
    ],
    ministros: [TEST_MINISTER, TEST_MINISTER_2],
    usuarios: [user(1, 1, 'admin_parroquia', 1), user(2, 2, 'admin_parroquia', 1), user(3, null, 'admin_general', 1), user(4, 1, 'usuario')],
    usuario_parroquias: memberships,
  });
}

function login_as(user_id: number, role: Session['role'], parish_id: number | null): Session {
  start_session({ user_id, role, parish_id, token: '' }, `user${user_id}`, 'clave');
  return require_session();
}

const input = (numero: string) =>
  baptism('bautismo', {
    sacramento: { fecha_emision: '2020-01-01', libro: '1', folio: '1', numero, ministro_id: TEST_MINISTER_2.id },
    persona: { nombres: 'Diego', apellido_paterno: 'Guido', apellido_materno: 'Alvaro' },
  });

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'prelatura-parroquias-'));
  db = open_local_database(path.join(dir, 'local.db'), randomBytes(32).toString('hex'));
  // Ana también es administradora de Santa Rosa.
  reference([{ usuario_id: 4, parroquia_id: 2, rol: 'admin_parroquia', principal: 0 }]);
});

afterEach(() => {
  end_session();
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('parroquia de trabajo', () => {
  it('entra en su parroquia de origen y la cambia por otra de las suyas, con el rol de esa', () => {
    const session = login_as(4, 'usuario', 1);

    select_working_parish(db, 2);
    expect(session).toMatchObject({ role: 'admin_parroquia', parish_id: 2 });

    select_working_parish(db, 1);
    expect(session).toMatchObject({ role: 'usuario', parish_id: 1 });
  });

  it('una parroquia donde no trabaja no se elige para trabajar (solo se consulta)', () => {
    login_as(4, 'usuario', 1);
    expect(() => select_working_parish(db, 3)).toThrow(/no trabaja/);

    login_as(3, 'admin_general', null);
    expect(() => select_working_parish(db, 1)).toThrow(/solo consulta/);
  });

  it('registra en la parroquia de trabajo', () => {
    const session = login_as(4, 'usuario', 1);
    select_working_parish(db, 2);

    const id = create_person_sacrament(db, 'bautismo', session, input('7'));
    expect(db.prepare('SELECT parroquia_id FROM sacramentos WHERE id = ?').pluck().get(id)).toBe(2);
  });

  it('si el general le quita la parroquia de trabajo, al sincronizar vuelve a la de origen', () => {
    const session = login_as(4, 'usuario', 1);
    select_working_parish(db, 2);

    reference([]);
    refresh_working_parish(db);
    expect(session).toMatchObject({ role: 'usuario', parish_id: 1 });
  });

  it('el login sin internet devuelve todas sus parroquias, primero la de origen', async () => {
    await save_credential(db, 4, 'clave-larga');
    const result = await verify_offline(db, 'user4', 'clave-larga');
    expect(result.ok && result.usuario.parroquias).toEqual([
      { id: 1, nombre: 'San Pedro', rol: 'usuario' },
      { id: 2, nombre: 'Santa Rosa', rol: 'admin_parroquia' },
    ]);
  });
});

describe('referencia', () => {
  it('las parroquias adicionales se reemplazan enteras con cada referencia', () => {
    reference([
      { usuario_id: 1, parroquia_id: 3, rol: 'admin_parroquia', principal: 1 },
      { usuario_id: 2, parroquia_id: 1, rol: 'usuario', principal: 0 },
    ]);

    expect(db.prepare('SELECT usuario_id, parroquia_id FROM usuario_parroquias ORDER BY usuario_id').all()).toEqual([
      { usuario_id: 1, parroquia_id: 3 },
      { usuario_id: 2, parroquia_id: 1 },
    ]);
  });
});

describe('cuentas', () => {
  it('el admin de una parroquia adicional ve las cuentas de esa, con el rol que tienen en ella', () => {
    const session = login_as(4, 'usuario', 1);
    select_working_parish(db, 2);

    const page = search_users(db, session, {});
    expect(page.resultados.map((row) => [row.username, row.rol, row.parroquia_id])).toEqual([
      ['user2', 'admin_parroquia', 2],
      ['user4', 'admin_parroquia', 2],
    ]);
    expect(page.resultados[1].parroquias_adicionales).toEqual([{ parroquia_id: 2, parroquia_nombre: 'Santa Rosa', rol: 'admin_parroquia', principal: 0 }]);
  });

  it('a quien también trabaja en otra parroquia lo modifica solo el general', () => {
    reference([{ usuario_id: 4, parroquia_id: 2, rol: 'usuario', principal: 0 }]);

    expect(() => toggle_user_active(db, login_as(1, 'admin_parroquia', 1), 4)).toThrow(/otras parroquias/);
    expect(() => toggle_user_active(db, login_as(2, 'admin_parroquia', 2), 4)).toThrow(/otras parroquias/);
    toggle_user_active(db, login_as(3, 'admin_general', null), 4);
  });

  it('el principal de una parroquia adicional no se deshabilita', () => {
    reference([{ usuario_id: 4, parroquia_id: 3, rol: 'admin_parroquia', principal: 1 }]);
    expect(() => toggle_user_active(db, login_as(3, 'admin_general', null), 4)).toThrow(/principal/);
  });

  it('el primer administrador de una parroquia es principal aunque el de otra lo sea como adicional', async () => {
    // Juan es principal de San José como adicional: un administrador nuevo de San José no lo es.
    reference([{ usuario_id: 1, parroquia_id: 3, rol: 'admin_parroquia', principal: 1 }]);
    const general = login_as(3, 'admin_general', null);

    const id = await create_user(db, general, { username: 'nuevo', password: 'clave1', rol: 'admin_parroquia', parroquia_id: 3, nombre: 'N', apellido_paterno: 'P', apellido_materno: '' });
    expect(db.prepare('SELECT principal FROM usuarios WHERE id = ?').pluck().get(id)).toBe(0);
  });

  it('las contraseñas nuevas llevan al menos 6 caracteres y ningún espacio', async () => {
    const general = login_as(3, 'admin_general', null);
    const account = { username: 'otra', rol: 'usuario' as const, parroquia_id: 1, nombre: 'N', apellido_paterno: 'P', apellido_materno: '' };

    await expect(create_user(db, general, { ...account, password: '12345' })).rejects.toThrow(/6 caracteres/);
    await expect(create_user(db, general, { ...account, password: 'mi clave' })).rejects.toThrow(/espacios/);
    expect(await create_user(db, general, { ...account, password: '123456' })).toBeLessThan(0);
  });
});

describe('sincronizar en una PC que usan varias cuentas', () => {
  // El servidor acepta todo: lo que importa es qué se manda con cada cuenta.
  function fake_server(sent: string[]): RemoteRequest {
    return (async (_path: string, options: RemoteOptions = {}) => {
      const cambios = (options.body as { cambios: SyncChange[] }).cambios;
      sent.push(...cambios.map((cambio) => cambio.entidad));
      const results: ChangeResult[] = cambios.map((cambio) => ({ entidad: cambio.entidad, client_id: cambio.client_id, estado: 'aplicado', version: 1 }));
      return { resultados: results };
    }) as RemoteRequest;
  }

  it('las partidas de una parroquia esperan a que sincronice alguien de esa parroquia', async () => {
    // Ana registra una partida en San Pedro (con el celebrante de San Pedro).
    const record = input('8');
    create_person_sacrament(db, 'bautismo', login_as(4, 'usuario', 1), { ...record, sacramento: { ...record.sacramento, ministro_id: TEST_MINISTER.id } });
    // Un rechazo viejo por el mismo motivo deja de aparecer como registro por revisar.
    db.prepare(`UPDATE sync_cola SET estado = 'rechazado', motivo = 'El administrador general solo consulta: no puede modificar partidas.'`).run();

    const sent: string[] = [];
    login_as(3, 'admin_general', null);
    await push_pending(db, fake_server(sent), 'token');
    login_as(2, 'admin_parroquia', 2);
    await push_pending(db, fake_server(sent), 'token');
    expect(sent).toEqual([]);
    expect(db.prepare('SELECT estado, motivo FROM sync_cola').get()).toEqual({ estado: 'pendiente', motivo: null });

    login_as(1, 'admin_parroquia', 1);
    await push_pending(db, fake_server(sent), 'token');
    expect(sent).toEqual(['bautismo']);
    expect(db.prepare('SELECT COUNT(*) FROM sync_cola').pluck().get()).toBe(0);
  });
});
