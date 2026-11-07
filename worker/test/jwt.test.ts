import { describe, it, expect } from 'vitest';
import { sign_jwt, verify_jwt } from '../src/utils/crypto';

const TEST_SECRET = 'secreto-de-prueba-suficientemente-largo';

describe('JWT signing and verification', () => {
  it('firma y verifica un token válido, preservando el payload', async () => {
    const token = await sign_jwt(
      { usuarioId: 1, rol: 'admin_general', parroquiaId: null },
      TEST_SECRET,
    );

    const payload = await verify_jwt(token, TEST_SECRET);

    expect(payload.usuarioId).toBe(1);
    expect(payload.rol).toBe('admin_general');
    expect(payload.parroquiaId).toBeNull();
  });

  it('rechaza un token firmado con un secreto distinto', async () => {
    const token = await sign_jwt(
      { usuarioId: 1, rol: 'admin_parroquia', parroquiaId: 1 },
      TEST_SECRET,
    );

    await expect(verify_jwt(token, 'otro-secreto-distinto')).rejects.toThrow();
  });

  it('rechaza un token con el payload alterado (firma inválida)', async () => {
    const token = await sign_jwt(
      { usuarioId: 1, rol: 'admin_parroquia', parroquiaId: 1 },
      TEST_SECRET,
    );

    // Altera un carácter del payload (segunda parte del JWT) para invalidar la firma.
    const parts = token.split('.');
    const tamperedToken = `${parts[0]}.${parts[1]}x.${parts[2]}`;

    await expect(verify_jwt(tamperedToken, TEST_SECRET)).rejects.toThrow();
  });
});