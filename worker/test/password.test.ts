import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../src/lib/password';

describe('password hashing (PBKDF2)', () => {
  it('genera un hash verificable con la contraseña correcta', async () => {
    const hash = await hashPassword('miPasswordSegura123');

    const isValid = await verifyPassword('miPasswordSegura123', hash);

    expect(isValid).toBe(true);
  });

  it('rechaza una contraseña incorrecta contra un hash válido', async () => {
    const hash = await hashPassword('miPasswordSegura123');

    const isValid = await verifyPassword('passwordEquivocada', hash);

    expect(isValid).toBe(false);
  });

  it('genera hashes distintos para la misma contraseña (salt aleatorio)', async () => {
    const hash1 = await hashPassword('miPasswordSegura123');
    const hash2 = await hashPassword('miPasswordSegura123');

    expect(hash1).not.toBe(hash2);
  });

  it('rechaza un hash con formato corrupto sin lanzar excepción', async () => {
    const isValid = await verifyPassword('cualquierPassword', 'formato-invalido-sin-partes');

    expect(isValid).toBe(false);
  });
});