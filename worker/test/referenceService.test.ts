import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { resetDatabase } from './helpers/resetDatabase';
import { getReferenceData } from '../src/services/referenceService';

describe('getReferenceData', () => {
  beforeEach(async () => {
    await resetDatabase(env.prelatura_db);
    await env.prelatura_db.batch([
      env.prelatura_db.prepare(`INSERT INTO parroquias (id, nombre, activa) VALUES (1, 'Parroquia 1', 1)`),
      env.prelatura_db.prepare(
        `INSERT INTO sacerdotes (id, nombre, apellido_paterno, apellido_materno, parroquia_id, activo, client_id)
         VALUES (1, 'Braulio', 'Guido', 'Alvaro', 1, 1, 'ministro-1')`,
      ),
      env.prelatura_db.prepare(
        `INSERT INTO usuarios (id, username, password_hash, rol, parroquia_id, nombre, apellido_paterno, apellido_materno)
         VALUES (1, 'parroco1', 'hash-secreto', 'usuario_parroquia', 1, 'Usuario', 'Parroquia', 'Uno'),
                (2, 'parroco2', 'otro-hash', 'usuario_parroquia', 1, 'Otro', 'Usuario', 'Dos')`,
      ),
    ]);
  });

  it('devuelve parroquias y ministros, y solo el usuario que inició sesión', async () => {
    const data = await getReferenceData(env.prelatura_db, 1);

    expect(data.parroquias).toHaveLength(1);
    expect(data.ministros).toHaveLength(1);
    expect(data.ministros[0]).toMatchObject({ client_id: 'ministro-1' });
    expect(data.usuarios).toHaveLength(1);
    expect(data.usuarios[0]).toMatchObject({ id: 1, username: 'parroco1' });
  });

  it('nunca incluye contraseñas', async () => {
    const data = await getReferenceData(env.prelatura_db, 1);

    expect(JSON.stringify(data)).not.toContain('hash');
  });
});
