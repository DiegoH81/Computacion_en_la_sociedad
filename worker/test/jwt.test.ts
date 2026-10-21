import { describe, it, expect } from 'vitest';
import { signJwt, verifyJwt } from '../src/lib/jwt';

const TEST_SECRET = 'secreto-de-prueba-suficientemente-largo';

describe('JWT signing and verification', () => {
  it('firma y verifica un token válido, preservando el payload', async () => {
    const token = await signJwt(
      { usuarioId: 1, rol: 'admin', parroquiaId: null },
      TEST_SECRET,
    );

    const payload = await verifyJwt(token, TEST_SECRET);

    expect(payload.usuarioId).toBe(1);
    expect(payload.rol).toBe('admin');
    expect(payload.parroquiaId).toBeNull();
  });

  it('rechaza un token firmado con un secreto distinto', async () => {
    const token = await signJwt(
      { usuarioId: 1, rol: 'usuario_parroquia', parroquiaId: 1 },
      TEST_SECRET,
    );

    await expect(verifyJwt(token, 'otro-secreto-distinto')).rejects.toThrow();
  });

  it('rechaza un token con el payload alterado (firma inválida)', async () => {
    const token = await signJwt(
      { usuarioId: 1, rol: 'usuario_parroquia', parroquiaId: 1 },
      TEST_SECRET,
    );

    // Altera un carácter del payload (segunda parte del JWT) para invalidar la firma.
    const parts = token.split('.');
    const tamperedToken = `${parts[0]}.${parts[1]}x.${parts[2]}`;

    await expect(verifyJwt(tamperedToken, TEST_SECRET)).rejects.toThrow();
  });
});