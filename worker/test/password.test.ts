import { describe, it, expect } from 'vitest';
import { hash_password, verify_password } from '../src/utils/crypto';

describe('password hashing (PBKDF2)', () => {
  it('genera un hash verificable con la contraseña correcta', async () => {
    const hash = await hash_password('miPasswordSegura123');

    const isValid = await verify_password('miPasswordSegura123', hash);

    expect(isValid).toBe(true);
  });

  it('rechaza una contraseña incorrecta contra un hash válido', async () => {
    const hash = await hash_password('miPasswordSegura123');

    const isValid = await verify_password('passwordEquivocada', hash);

    expect(isValid).toBe(false);
  });

  it('genera hashes distintos para la misma contraseña (salt aleatorio)', async () => {
    const hash1 = await hash_password('miPasswordSegura123');
    const hash2 = await hash_password('miPasswordSegura123');

    expect(hash1).not.toBe(hash2);
  });

  it('rechaza un hash con formato corrupto sin lanzar excepción', async () => {
    const isValid = await verify_password('cualquierPassword', 'formato-invalido-sin-partes');

    expect(isValid).toBe(false);
  });
});