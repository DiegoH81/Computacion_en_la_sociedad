import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { resetDatabase } from './helpers/resetDatabase';
import { login } from '../src/controllers/login';
import { hash_password } from '../src/utils/crypto';

const TEST_JWT_SECRET = 'secreto-de-prueba-para-integration-tests';

describe('authService.login (integración con D1)', () => {
  beforeEach(async () => {
    await resetDatabase(env.prelatura_db);

    await env.prelatura_db
      .prepare('INSERT INTO parroquias (id, nombre, activa) VALUES (1, ?, 1)')
      .bind('Parroquia de Prueba')
      .run();

    const hashActivo = await hash_password('passwordCorrecta123');
    await env.prelatura_db
      .prepare(
        `INSERT INTO usuarios (username, password_hash, nombre, apellido_paterno, apellido_materno,
                              rol, parroquia_id, activo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind('usuario.activo', hashActivo, 'Usuario', 'Activo', 'Test', 'admin_parroquia', 1, 1)
      .run();

    const hashInactivo = await hash_password('passwordCorrecta123');
    await env.prelatura_db
      .prepare(
        `INSERT INTO usuarios (username, password_hash, nombre, apellido_paterno, apellido_materno,
                              rol, parroquia_id, activo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind('usuario.inactivo', hashInactivo, 'Usuario', 'Inactivo', 'Test', 'admin_parroquia', 1, 0)
      .run();
  });

  it('devuelve un token y datos de usuario con credenciales correctas', async () => {
    const result = await login(
      env.prelatura_db,
      TEST_JWT_SECRET,
      'usuario.activo',
      'passwordCorrecta123',
    );

    expect(result.token).toBeTruthy();
    expect(result.usuario.nombre_completo).toBe('Usuario Activo Test');
    expect(result.usuario.parroquia_nombre).toBe('Parroquia de Prueba');
  });

  it('rechaza una contraseña incorrecta', async () => {
    await expect(login(
      env.prelatura_db,
      TEST_JWT_SECRET,
      'usuario.activo',
      'passwordIncorrecta',
    )).rejects.toMatchObject({ status: 401 });
  });

  it('rechaza un usuario que no existe', async () => {
    await expect(login(
      env.prelatura_db,
      TEST_JWT_SECRET,
      'usuario.inexistente',
      'cualquierPassword',
    )).rejects.toMatchObject({ status: 401 });
  });

  it('rechaza un usuario desactivado aunque la contraseña sea correcta', async () => {
    await expect(login(
      env.prelatura_db,
      TEST_JWT_SECRET,
      'usuario.inactivo',
      'passwordCorrecta123',
    )).rejects.toMatchObject({ status: 401 });
  });

  it('no revela si el motivo del fallo fue usuario inexistente o contraseña incorrecta', async () => {
    const errorUsuarioInexistente = await login(
      env.prelatura_db,
      TEST_JWT_SECRET,
      'no.existe',
      'algo',
    ).catch((error: Error) => error);
    const errorPasswordIncorrecta = await login(
      env.prelatura_db,
      TEST_JWT_SECRET,
      'usuario.activo',
      'incorrecta',
    ).catch((error: Error) => error);

    expect(errorUsuarioInexistente).toBeInstanceOf(Error);
    expect(errorPasswordIncorrecta).toBeInstanceOf(Error);
    expect((errorUsuarioInexistente as Error).message).toBe((errorPasswordIncorrecta as Error).message);
  });
});
