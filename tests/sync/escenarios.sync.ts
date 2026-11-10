import { afterEach, describe, expect, it } from 'vitest';
import type { Baptism, User } from '../../shared/models';
import { create_minister, update_minister } from '../../electron/main/controllers/ministers';
import { request_changes } from '../../electron/main/controllers/requests';
import {
  annul_sacrament,
  create_person_sacrament,
  read_person_sacrament,
  restore_sacrament,
  update_person_sacrament,
} from '../../electron/main/controllers/sacraments';
import { create_user, update_user } from '../../electron/main/controllers/users';
import { select_working_parish } from '../../electron/main/models/session';
import { resolve_conflict } from '../../electron/main/sync/sync';
import { PUSH_BATCH_SIZE } from '../../electron/main/utils/config';
import { baptismIn, nextRegistry, Pc, SEED, server, uniqueName } from './pc';

const pcs: Pc[] = [];

function newPc(name: string): Pc {
  const pc = new Pc(name);
  pcs.push(pc);
  return pc;
}

afterEach(() => {
  pcs.splice(0).forEach((pc) => pc.close());
});

async function pcOf(name: string, username: string, password: string): Promise<Pc> {
  const pc = newPc(name);
  await pc.login(username, password);
  return pc;
}

const parroco1 = (name = 'parroquia1') => pcOf(name, SEED.parroco1.username, SEED.parroco1.password);

async function newAdmin(parishId: number): Promise<{ username: string; password: string; id: number }> {
  const username = uniqueName(`admin${parishId}`);
  const password = 'clave1';
  const id = await server.createUser({ username, password, rol: 'admin_parroquia', parroquia_id: parishId });
  return { username, password, id };
}

function register(pc: Pc, parishId: number, nombres = 'Prueba', extra: { libro?: string; folio?: string } = {}): { id: number; numero: string } {
  const numero = nextRegistry();
  const id = pc.as((db, session) => create_person_sacrament(db, 'bautismo', session, baptismIn(parishId, numero, nombres, extra)));
  return { id, numero };
}

function idOf(pc: Pc, numero: string): number {
  const rows = pc.recordsWithRegistry(numero);
  expect(rows).toHaveLength(1);
  return rows[0].id;
}

function rename(pc: Pc, numero: string, nombres: string): void {
  pc.as((db, session) => {
    const record = read_person_sacrament(db, 'bautismo', idOf(pc, numero));
    update_person_sacrament(db, 'bautismo', session, { ...record, persona: { ...record.persona, nombres } } as Baptism);
  });
}

function namesOf(pc: Pc, numero: string): string[] {
  return pc.recordsWithRegistry(numero).map((row) => row.nombres);
}

function helperValues(username: string, password = 'clave1'): User {
  return { username, password, rol: 'usuario', nombre: 'Ayu', apellido_paterno: username, apellido_materno: '', parroquia_id: null } as unknown as User;
}


describe('dos parroquias', () => {
  it('cada PC recibe las partidas de la otra parroquia, pero no puede modificarlas', async () => {
    const admin2 = await newAdmin(2);
    const p1 = await parroco1();
    const p2 = await pcOf('parroquia2', admin2.username, admin2.password);

    const de1 = register(p1, 1, 'DeUno');
    const de2 = register(p2, 2, 'DeDos');
    expect(await p1.sync()).toBe('ok');
    expect(await p2.sync()).toBe('ok');
    expect(await p1.sync()).toBe('ok');

    expect(namesOf(p1, de2.numero)).toEqual(['DeDos']);
    expect(namesOf(p2, de1.numero)).toEqual(['DeUno']);
    expect(p1.recordsWithRegistry(de2.numero)[0].parroquia_id).toBe(2);

    expect(() => rename(p1, de2.numero, 'Intruso')).toThrow();
    expect(() => p1.as((db, session) => annul_sacrament(db, session, idOf(p1, de2.numero), 'No es mía'))).toThrow();
    expect(p1.queue().pendientes).toBe(0);
  });
});

describe('una parroquia que pasa mucho tiempo sin internet', () => {
  it(`registra muchas partidas (más de ${PUSH_BATCH_SIZE} por envío y más de una página de descarga) y llegan todas`, async () => {
    const lejana = await parroco1('lejana');
    lejana.online = false;

    const libro = nextRegistry();
    const created = Array.from({ length: PUSH_BATCH_SIZE * 2 + 30 }, (_, index) => register(lejana, 1, `Lote${index}`, { libro }));
    expect(lejana.queue().pendientes).toBe(created.length);
    expect(await lejana.sync()).toBe('sin-conexion');
    expect(lejana.queue().pendientes).toBe(created.length);

    lejana.online = true;
    expect(await lejana.sync()).toBe('ok');
    expect(lejana.queue()).toMatchObject({ pendientes: 0, conflictos: 0, rechazados: 0 });

    const nueva = await parroco1('nueva');
    const count = nueva.db.prepare('SELECT COUNT(*) FROM sacramentos WHERE libro = ?').pluck().get(libro);
    expect(count).toBe(created.length);
  });

  it('al volver se pone al día con todo lo que pasó: partidas nuevas, editadas, anuladas y rehabilitadas', async () => {
    const lejana = await parroco1('lejana');
    const central = await parroco1('central');
    const editada = register(central, 1, 'Original');
    const anulada = register(central, 1, 'SeAnula');
    const rehabilitada = register(central, 1, 'Vuelve');
    expect(await central.sync()).toBe('ok');
    expect(await lejana.sync()).toBe('ok');

    lejana.online = false;
    rename(central, editada.numero, 'Editada');
    rename(central, editada.numero, 'EditadaOtraVez');
    central.as((db, session) => annul_sacrament(db, session, idOf(central, anulada.numero), 'Duplicada'));
    central.as((db, session) => annul_sacrament(db, session, idOf(central, rehabilitada.numero), 'Error'));
    central.as((db, session) => restore_sacrament(db, session, idOf(central, rehabilitada.numero), 'No era error'));
    const nueva = register(central, 1, 'Nueva');
    expect(await central.sync()).toBe('ok');

    expect(await lejana.sync()).toBe('sin-conexion');
    lejana.online = true;
    expect(await lejana.sync()).toBe('ok');

    expect(namesOf(lejana, editada.numero)).toEqual(['EditadaOtraVez']);
    expect(lejana.recordsWithRegistry(anulada.numero)[0].estado).toBe('anulado');
    expect(lejana.recordsWithRegistry(rehabilitada.numero)[0].estado).toBe('vigente');
    expect(namesOf(lejana, nueva.numero)).toEqual(['Nueva']);
    expect(lejana.recordsWithRegistry(editada.numero)[0].version).toBe(central.recordsWithRegistry(editada.numero)[0].version);
  });

  it('dos PCs sin internet registran la misma partida (mismo libro, folio y registro): no se pierde ninguna', async () => {
    const a = await parroco1('a');
    const b = await parroco1('b');
    a.online = false;
    b.online = false;

    const numero = nextRegistry();
    a.as((db, session) => create_person_sacrament(db, 'bautismo', session, baptismIn(1, numero, 'DesdeA')));
    b.as((db, session) => create_person_sacrament(db, 'bautismo', session, baptismIn(1, numero, 'DesdeB')));

    a.online = true;
    b.online = true;
    expect(await a.sync()).toBe('ok');
    expect(await b.sync()).toBe('ok');
    expect(await a.sync()).toBe('ok');

    expect(namesOf(a, numero).sort()).toEqual(['DesdeA', 'DesdeB']);
    expect(namesOf(b, numero).sort()).toEqual(['DesdeA', 'DesdeB']);
  });
});

describe('ediciones cruzadas', () => {
  it('una edición hecha sin internet sobre una partida que otra PC cambió queda como conflicto; se resuelve de las dos formas', async () => {
    const a = await parroco1('a');
    const b = await parroco1('b');
    const { numero } = register(a, 1, 'Inicial');
    expect(await a.sync()).toBe('ok');
    expect(await b.sync()).toBe('ok');

    b.online = false;
    rename(b, numero, 'DeB');
    rename(a, numero, 'DeA');
    rename(a, numero, 'DeA2');
    expect(await a.sync()).toBe('ok');

    b.online = true;
    expect(await b.sync()).toBe('ok');
    expect(b.queue()).toMatchObject({ conflictos: 1, pendientes: 0 });
    expect(namesOf(b, numero)).toEqual(['DeB']);

    const clientId = b.recordsWithRegistry(numero)[0].client_id;
    await b.as((db, session) => resolve_conflict(db, b.request, session.token, 'bautismo', clientId, 'servidor'));
    expect(namesOf(b, numero)).toEqual(['DeA2']);
    expect(b.queue().conflictos).toBe(0);

    b.online = false;
    rename(b, numero, 'DeB2');
    rename(a, numero, 'DeA3');
    expect(await a.sync()).toBe('ok');
    b.online = true;
    expect(await b.sync()).toBe('ok');
    await b.as((db, session) => resolve_conflict(db, b.request, session.token, 'bautismo', clientId, 'local'));
    expect(await b.sync()).toBe('ok');
    expect(b.queue()).toMatchObject({ pendientes: 0, conflictos: 0 });
    expect(await a.sync()).toBe('ok');
    expect(namesOf(a, numero)).toEqual(['DeB2']);
  });

  it('una edición sin internet sobre una partida que otra PC anuló: conflicto, y no revive la partida sola', async () => {
    const a = await parroco1('a');
    const b = await parroco1('b');
    const { numero } = register(a, 1, 'PorAnular');
    expect(await a.sync()).toBe('ok');
    expect(await b.sync()).toBe('ok');

    b.online = false;
    rename(b, numero, 'EditadaSinSaber');
    a.as((db, session) => annul_sacrament(db, session, idOf(a, numero), 'Duplicada'));
    expect(await a.sync()).toBe('ok');

    b.online = true;
    expect(await b.sync()).toBe('ok');
    expect(b.queue().conflictos).toBe(1);

    const clientId = b.recordsWithRegistry(numero)[0].client_id;
    await b.as((db, session) => resolve_conflict(db, b.request, session.token, 'bautismo', clientId, 'servidor'));
    expect(b.recordsWithRegistry(numero)[0]).toMatchObject({ estado: 'anulado', nombres: 'PorAnular' });
  });

  it('dos PCs editan el mismo ministro sin internet: la segunda queda en conflicto', async () => {
    const a = await parroco1('a');
    const b = await parroco1('b');
    const ministerId = a.as((db, session) =>
      create_minister(db, session, { titulo: 'Pbro.', nombre: uniqueName('Min'), apellido_paterno: 'Sincro', apellido_materno: 'Prueba', parroquia_id: 1 } as never),
    );
    expect(await a.sync()).toBe('ok');
    expect(await b.sync()).toBe('ok');

    const clientId = a.db.prepare('SELECT client_id FROM ministros WHERE id = ?').pluck().get(ministerId) as string;
    const minister = (pc: Pc) => pc.db.prepare('SELECT * FROM ministros WHERE client_id = ?').get(clientId) as Record<string, unknown>;

    b.online = false;
    b.as((db, session) => update_minister(db, session, { ...minister(b), apellido_materno: 'DeB' } as never));
    a.as((db, session) => update_minister(db, session, { ...minister(a), apellido_materno: 'DeA' } as never));
    expect(await a.sync()).toBe('ok');
    b.online = true;
    expect(await b.sync()).toBe('ok');

    expect(b.queue().conflictos).toBe(1);
    expect(b.queue().items[0]).toMatchObject({ entidad: 'ministro', estado: 'conflicto' });
  });

  it('un ministro y una partida que lo usa, creados sin internet, llegan juntos a otra PC', async () => {
    const lejana = await parroco1('lejana');
    lejana.online = false;
    const nombre = uniqueName('Nuevo');
    const ministerId = lejana.as((db, session) =>
      create_minister(db, session, { titulo: null, nombre, apellido_paterno: 'Sincro', apellido_materno: 'Prueba', parroquia_id: 1 } as never),
    );
    const numero = nextRegistry();
    lejana.as((db, session) => {
      const record = baptismIn(1, numero, 'ConMinistroNuevo');
      create_person_sacrament(db, 'bautismo', session, { ...record, sacramento: { ...record.sacramento, ministro_id: ministerId } });
    });

    lejana.online = true;
    expect(await lejana.sync()).toBe('ok');
    expect(lejana.queue().pendientes).toBe(0);

    const otra = await parroco1('otra');
    const row = otra.db
      .prepare('SELECT mi.nombre FROM sacramentos s JOIN ministros mi ON mi.id = s.ministro_id WHERE s.numero = ?')
      .get(numero) as { nombre: string };
    expect(row.nombre).toBe(nombre);
  });
});

describe('cuentas creadas sin internet', () => {
  it('un ayudante creado sin internet trabaja en esa PC; al sincronizar el párroco, suben la cuenta y sus partidas', async () => {
    const pc = await parroco1();
    pc.online = false;
    const username = uniqueName('ayudante');
    await pc.as((db, session) => create_user(db, session, helperValues(username)));

    await pc.login(username, 'clave1');
    expect(pc.session?.user_id).toBeLessThan(0);
    const { numero } = register(pc, 1, 'DelAyudante');

    pc.online = true;
    await pc.login(SEED.parroco1.username, SEED.parroco1.password);
    expect(pc.queue()).toMatchObject({ pendientes: 0, rechazados: 0, conflictos: 0 });
    expect(await server.userId(username)).not.toBeNull();

    const otra = await pcOf('otra', username, 'clave1');
    expect(namesOf(otra, numero)).toEqual(['DelAyudante']);
  });

  it('dos parroquias sin internet crean una cuenta con el mismo nombre: la segunda se avisa clara, se renombra y sube', async () => {
    const admin2 = await newAdmin(2);
    const p1 = await parroco1();
    const p2 = await pcOf('parroquia2', admin2.username, admin2.password);
    p1.online = false;
    p2.online = false;

    const username = uniqueName('juan');
    await p1.as((db, session) => create_user(db, session, helperValues(username)));
    const localId = await p2.as((db, session) => create_user(db, session, helperValues(username, 'clave2')));

    p1.online = true;
    p2.online = true;
    expect(await p1.sync()).toBe('ok');
    expect(await p2.sync()).toBe('ok');
    expect(p1.queue()).toMatchObject({ pendientes: 0, rechazados: 0 });

    expect(p2.queue().rechazados).toBe(1);
    const item = p2.queue().items[0];
    expect(item).toMatchObject({ entidad: 'usuario', estado: 'rechazado' });
    expect(item.motivo).toContain(`"${username}" ya lo tiene otra cuenta`);
    expect(item.descripcion).toMatch(/necesita otro nombre de usuario/);
    expect(await p2.sync()).toBe('ok');
    expect(p2.queue().items[0].motivo).toContain('ya lo tiene otra cuenta');

    const renamed = `${username}2`;
    await p2.as((db, session) => update_user(db, session, { ...helperValues(renamed, ''), id: localId } as User));
    expect(p2.queue()).toMatchObject({ pendientes: 1, rechazados: 0 });
    expect(await p2.sync()).toBe('ok');
    expect(p2.queue()).toMatchObject({ pendientes: 0, rechazados: 0 });

    const otra = newPc('otra');
    await otra.login(renamed, 'clave2');
    expect(otra.session?.parish_id).toBe(2);
    const otra1 = newPc('otra1');
    await otra1.login(username, 'clave1');
    expect(otra1.session?.parish_id).toBe(1);
  });

  it('a una cuenta que ya está en el servidor no se le cambia el nombre de usuario', async () => {
    const pc = await parroco1();
    const username = uniqueName('fijo');
    const id = await server.createUser({ username, password: 'clave1', rol: 'usuario', parroquia_id: 1 });
    expect(await pc.sync()).toBe('ok');
    await expect(pc.as((db, session) => update_user(db, session, { ...helperValues(`${username}x`, ''), id } as User))).rejects.toThrow(/no se puede cambiar/);
  });

  it('una cuenta rechazada por nombre repetido no bloquea lo demás de esa PC', async () => {
    const admin2 = await newAdmin(2);
    const p2 = await pcOf('parroquia2', admin2.username, admin2.password);
    p2.online = false;

    const username = uniqueName('repetido');
    await server.createUser({ username, password: 'clave1', rol: 'usuario', parroquia_id: 1 });
    await p2.as((db, session) => create_user(db, session, helperValues(username)));
    const { numero } = register(p2, 2, 'NoSeBloquea');

    p2.online = true;
    expect(await p2.sync()).toBe('ok');
    expect(p2.queue()).toMatchObject({ pendientes: 0, rechazados: 1 });

    const otra = await parroco1('otra');
    expect(namesOf(otra, numero)).toEqual(['NoSeBloquea']);
  });

  it('lo que registró una cuenta que quedó sin nombre espera en la PC, y sube cuando se la renombra', async () => {
    const admin2 = await newAdmin(2);
    const p2 = await pcOf('parroquia2', admin2.username, admin2.password);
    p2.online = false;

    const username = uniqueName('tomado');
    await server.createUser({ username, password: 'clave1', rol: 'usuario', parroquia_id: 1 });
    const localId = await p2.as((db, session) => create_user(db, session, helperValues(username, 'clave2')));
    await p2.login(username, 'clave2');
    const { numero } = register(p2, 2, 'DeCuentaRechazada');

    p2.online = true;
    await p2.login(admin2.username, admin2.password);

    expect(namesOf(p2, numero)).toEqual(['DeCuentaRechazada']);
    expect(p2.queue()).toMatchObject({ rechazados: 1, pendientes: 1 });
    expect(p2.queue().items.map((item) => item.entidad)).toEqual(['usuario']);

    await p2.as((db, session) => update_user(db, session, { ...helperValues(`${username}b`, ''), id: localId } as User));
    expect(await p2.sync()).toBe('ok');
    expect(p2.queue()).toMatchObject({ pendientes: 0, rechazados: 0, conflictos: 0 });

    const otra = await pcOf('otra', admin2.username, admin2.password);
    expect(namesOf(otra, numero)).toEqual(['DeCuentaRechazada']);
  });
});

describe('permisos que cambian mientras una PC no tiene internet', () => {
  it('el general deshabilita al párroco: su PC deja de sincronizar sin perder nada, y otro administrador de la parroquia lo sube', async () => {
    const parroco = await newAdmin(2);
    const pc = await pcOf('parroquia2b', parroco.username, parroco.password);
    const reemplazo = await newAdmin(2);

    pc.online = false;
    const { numero } = register(pc, 2, 'Pendiente');
    await server.toggleUser(parroco.id);

    pc.online = true;
    pc.session!.token = '';
    expect(await pc.sync()).toBe('requiere-login');
    expect(pc.queue().pendientes).toBe(1);
    await pc.login(reemplazo.username, reemplazo.password);
    expect(pc.queue()).toMatchObject({ pendientes: 0, rechazados: 0 });

    const otra = await pcOf('otra', reemplazo.username, reemplazo.password);
    expect(namesOf(otra, numero)).toEqual(['Pendiente']);

    // Y ahora que esa PC ya sabe que la cuenta está deshabilitada, no la deja entrar sin internet.
    pc.online = false;
    await expect(pc.login(parroco.username, parroco.password)).rejects.toThrow();
  });

  it('el general cambia la contraseña mientras la PC está sin internet: pide entrar de nuevo y no pierde lo pendiente', async () => {
    const parroco = await newAdmin(2);
    const pc = await pcOf('parroquia2b', parroco.username, parroco.password);
    pc.online = false;
    const { numero } = register(pc, 2, 'AntesDelCambio');

    await server.changePassword(parroco.id, { nombre: 'Prueba', apellido_paterno: parroco.username, apellido_materno: '' }, 'nueva1');

    pc.online = true;
    pc.session!.token = '';
    expect(await pc.sync()).toBe('requiere-login');
    expect(pc.queue().pendientes).toBe(1);

    // Con la contraseña vieja todavía entra sin internet en esa PC (no sabe del cambio), y con la nueva entra con internet.
    await pc.login(parroco.username, 'nueva1');
    expect(pc.queue().pendientes).toBe(0);
    const otra = await pcOf('otra', parroco.username, 'nueva1');
    expect(namesOf(otra, numero)).toEqual(['AntesDelCambio']);
  });

  it('el general le quita una parroquia adicional mientras registraba en ella sin internet: no se sube, y no se pierde', async () => {
    const username = uniqueName('multi');
    const id = await server.createUser({ username, password: 'clave1', rol: 'admin_parroquia', parroquia_id: 2 });
    await server.setParish(id, 1, 'usuario');

    const pc = await pcOf('multi', username, 'clave1');
    pc.as((db) => select_working_parish(db, 1));
    pc.online = false;
    const { numero } = register(pc, 1, 'EnLaQuitada');

    await server.removeParish(id, 1);
    pc.online = true;
    expect(await pc.sync()).toBe('ok');

    // Al bajar la referencia vuelve a su parroquia de origen; la partida de la otra espera a alguien de esa parroquia.
    expect(pc.session).toMatchObject({ parish_id: 2, role: 'admin_parroquia' });
    expect(namesOf(pc, numero)).toEqual(['EnLaQuitada']);
    expect(pc.queue().rechazados).toBe(0);
    expect(pc.queue().pendientes).toBe(1);

    // Cuando sincroniza alguien de la Parroquia 1 en esa PC, sube.
    await pc.login(SEED.parroco1.username, SEED.parroco1.password);
    expect(pc.queue().pendientes).toBe(0);
  });

  it('el general deshabilita la parroquia mientras una PC tenía partidas sin subir: se suben igual, sin repetirse', async () => {
    const admin = await newAdmin(2);
    const pc = await pcOf('parroquia2b', admin.username, admin.password);
    pc.online = false;
    const { numero } = register(pc, 2, 'ParroquiaCerrada');

    await server.toggleParish(2);
    try {
      pc.online = true;
      expect(await pc.sync()).toBe('ok');
      expect(pc.queue()).toMatchObject({ pendientes: 0, rechazados: 0, conflictos: 0 });
    } finally {
      await server.toggleParish(2);
    }

    expect(await pc.sync()).toBe('ok');
    const otra = await parroco1('otra');
    expect(namesOf(otra, numero)).toEqual(['ParroquiaCerrada']);
  });

  it('un ayudante cambia su contraseña sin internet y el general también se la cambia: queda como conflicto, no se pisa', async () => {
    const pc = await parroco1();
    const username = uniqueName('ayu');
    await pc.as((db, session) => create_user(db, session, helperValues(username)));
    expect(await pc.sync()).toBe('ok');
    const id = (await server.userId(username)) as number;

    await pc.login(username, 'clave1');
    pc.online = false;
    await pc.as((db, session) => update_user(db, session, { ...helperValues(username, 'local1'), id: session.user_id } as User));

    await server.changePassword(id, { nombre: 'Ayu', apellido_paterno: username, apellido_materno: '' }, 'servidor1');

    pc.online = true;
    await pc.login(SEED.parroco1.username, SEED.parroco1.password);
    expect(pc.queue().conflictos).toBe(1);
    expect(pc.queue().items[0]).toMatchObject({ entidad: 'usuario', estado: 'conflicto' });
  });
});

describe('correcciones entre PCs', () => {
  it('el ayudante pide un cambio sin internet mientras el párroco edita la partida: el pedido no se pierde ni pisa lo editado', async () => {
    const parroco = await parroco1('parroco');
    const username = uniqueName('ayu');
    await parroco.as((db, session) => create_user(db, session, helperValues(username)));
    const { numero } = register(parroco, 1, 'Original');
    expect(await parroco.sync()).toBe('ok');

    const ayudante = await pcOf('ayudante', username, 'clave1');
    ayudante.online = false;
    ayudante.as((db, session) => {
      const record = read_person_sacrament(db, 'bautismo', idOf(ayudante, numero));
      request_changes(db, session, { ...record, persona: { ...record.persona, nombres: 'PedidoPorAyudante' } } as Baptism);
    });

    rename(parroco, numero, 'EditadoPorParroco');
    expect(await parroco.sync()).toBe('ok');

    ayudante.online = true;
    expect(await ayudante.sync()).toBe('ok');
    const summary = ayudante.queue();
    // O sube el pedido, o queda en conflicto para revisar: nunca se pierde en silencio.
    expect(summary.rechazados).toBe(0);
    if (summary.conflictos === 0) {
      expect(await parroco.sync()).toBe('ok');
      expect(namesOf(parroco, numero)).toEqual(['EditadoPorParroco']);
      const pending = parroco.db
        .prepare(`SELECT valor_nuevo FROM solicitudes_cambio WHERE estado = 'pendiente' AND sacramento_id = ?`)
        .pluck()
        .all(idOf(parroco, numero));
      expect(pending).toContain('PedidoPorAyudante');
    }
  });
});

describe('cortes de red', () => {
  it('si internet se corta a mitad de una subida larga, lo que faltaba sigue pendiente y después sube sin duplicar', async () => {
    const pc = await parroco1();
    pc.online = false;
    const libro = nextRegistry();
    const total = PUSH_BATCH_SIZE + 10;
    for (let index = 0; index < total; index++) register(pc, 1, `Corte${index}`, { libro });

    // La red se cae después del primer envío.
    pc.online = true;
    let calls = 0;
    const original = pc.request;
    (pc as unknown as { request: typeof original }).request = (async (requestPath: string, options?: never) => {
      if (requestPath === '/api/sync/push' && ++calls > 1) throw Object.assign(new Error('corte'), { status: 0, name: 'ServiceError' });
      return original(requestPath, options);
    }) as typeof original;
    await pc.sync().catch(() => undefined);
    (pc as unknown as { request: typeof original }).request = original;

    expect(pc.queue().pendientes).toBe(total - PUSH_BATCH_SIZE);
    expect(await pc.sync()).toBe('ok');
    expect(pc.queue().pendientes).toBe(0);

    const otra = await parroco1('otra');
    expect(otra.db.prepare('SELECT COUNT(*) FROM sacramentos WHERE libro = ?').pluck().get(libro)).toBe(total);
  });
});

describe('más cortes y sesiones', () => {
  it('el servidor guarda pero la respuesta no llega: el reenvío no duplica ni crea un conflicto', async () => {
    const pc = await parroco1();
    const { numero } = register(pc, 1, 'RespuestaPerdida');
    rename(pc, numero, 'RespuestaPerdida2');

    const original = pc.request;
    (pc as unknown as { request: typeof original }).request = (async (requestPath: string, options?: never) => {
      const result = await original(requestPath, options);
      if (requestPath === '/api/sync/push') throw Object.assign(new Error('se cortó'), { status: 0, name: 'ServiceError' });
      return result;
    }) as typeof original;
    await pc.sync().catch(() => undefined);
    (pc as unknown as { request: typeof original }).request = original;
    expect(pc.queue().pendientes).toBe(1);

    expect(await pc.sync()).toBe('ok');
    expect(pc.queue()).toMatchObject({ pendientes: 0, conflictos: 0, rechazados: 0 });
    const otra = await parroco1('otra');
    expect(namesOf(otra, numero)).toEqual(['RespuestaPerdida2']);
  });

  it('con el token vencido, pide uno nuevo con la contraseña guardada y sigue', async () => {
    const pc = await parroco1();
    const { numero } = register(pc, 1, 'TokenVencido');
    pc.session!.token = 'token-que-ya-no-sirve';
    expect(await pc.sync()).toBe('ok');
    expect(pc.queue().pendientes).toBe(0);
    const otra = await parroco1('otra');
    expect(namesOf(otra, numero)).toEqual(['TokenVencido']);
  });

  it('una cuenta que el general creó mientras la PC estaba sin internet llega al sincronizar, y después entra sin internet', async () => {
    const pc = await parroco1();
    pc.online = false;
    const username = uniqueName('nuevo');
    await server.createUser({ username, password: 'clave1', rol: 'usuario', parroquia_id: 1 });

    pc.online = true;
    expect(await pc.sync()).toBe('ok');
    pc.online = false;
    await pc.login(username, 'clave1');
    expect(pc.session).toMatchObject({ parish_id: 1, role: 'usuario' });
  });

  it('una parroquia adicional que el general agregó mientras la PC estaba sin internet se puede elegir al sincronizar', async () => {
    const username = uniqueName('suma');
    const id = await server.createUser({ username, password: 'clave1', rol: 'usuario', parroquia_id: 2 });
    const pc = await pcOf('suma', username, 'clave1');
    expect(() => pc.as((db) => select_working_parish(db, 1))).toThrow();

    pc.online = false;
    await server.setParish(id, 1, 'usuario');
    expect(await pc.sync()).toBe('sin-conexion');
    expect(() => pc.as((db) => select_working_parish(db, 1))).toThrow();

    pc.online = true;
    expect(await pc.sync()).toBe('ok');
    pc.as((db) => select_working_parish(db, 1));
    const { numero } = register(pc, 1, 'EnLaNueva');
    expect(await pc.sync()).toBe('ok');
    expect(pc.queue()).toMatchObject({ pendientes: 0, rechazados: 0 });
    const otra = await parroco1('otra');
    expect(namesOf(otra, numero)).toEqual(['EnLaNueva']);
  });
});
