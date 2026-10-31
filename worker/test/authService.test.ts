import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { resetDatabase } from './helpers/resetDatabase';
import { login } from '../src/services/authService';
import { hashPassword } from '../src/lib/password';

const TEST_JWT_SECRET = 'secreto-de-prueba-para-integration-tests';

describe('authService.login (integración con D1)', () => {
  beforeEach(async () => {
    await resetDatabase(env.prelatura_db);

    await env.prelatura_db
      .prepare('INSERT INTO parroquias (id, nombre, activa) VALUES (1, ?, 1)')
      .bind('Parroquia de Prueba')
      .run();

    const hashActivo = await hashPassword('passwordCorrecta123');
    await env.prelatura_db
      .prepare(
        `INSERT INTO usuarios (username, password_hash, nombre, apellido_paterno, apellido_materno,
                              rol, parroquia_id, activo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind('usuario.activo', hashActivo, 'Usuario', 'Activo', 'Test', 'usuario_parroquia', 1, 1)
      .run();

    const hashInactivo = await hashPassword('passwordCorrecta123');
    await env.prelatura_db
      .prepare(
        `INSERT INTO usuarios (username, password_hash, nombre, apellido_paterno, apellido_materno,
                              rol, parroquia_id, activo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind('usuario.inactivo', hashInactivo, 'Usuario', 'Inactivo', 'Test', 'usuario_parroquia', 1, 0)
      .run();
  });

  it('devuelve un token y datos de usuario con credenciales correctas', async () => {
    const result = await login(
      env.prelatura_db,
      TEST_JWT_SECRET,
      'usuario.activo',
      'passwordCorrecta123',
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.token).toBeTruthy();
      expect(result.usuario.nombreCompleto).toBe('Usuario Activo Test');
      expect(result.usuario.parroquiaNombre).toBe('Parroquia de Prueba');
    }
  });

  it('rechaza una contraseña incorrecta', async () => {
    const result = await login(
      env.prelatura_db,
      TEST_JWT_SECRET,
      'usuario.activo',
      'passwordIncorrecta',
    );

    expect(result.success).toBe(false);
  });

  it('rechaza un usuario que no existe', async () => {
    const result = await login(
      env.prelatura_db,
      TEST_JWT_SECRET,
      'usuario.inexistente',
      'cualquierPassword',
    );

    expect(result.success).toBe(false);
  });

  it('rechaza un usuario desactivado aunque la contraseña sea correcta', async () => {
    const result = await login(
      env.prelatura_db,
      TEST_JWT_SECRET,
      'usuario.inactivo',
      'passwordCorrecta123',
    );

    expect(result.success).toBe(false);
  });

  it('no revela si el motivo del fallo fue usuario inexistente o contraseña incorrecta', async () => {
    const resultUsuarioInexistente = await login(
      env.prelatura_db,
      TEST_JWT_SECRET,
      'no.existe',
      'algo',
    );
    const resultPasswordIncorrecta = await login(
      env.prelatura_db,
      TEST_JWT_SECRET,
      'usuario.activo',
      'incorrecta',
    );

    if (!resultUsuarioInexistente.success && !resultPasswordIncorrecta.success) {
      expect(resultUsuarioInexistente.message).toBe(resultPasswordIncorrecta.message);
    }
  });
});
