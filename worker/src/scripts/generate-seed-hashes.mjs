// Script temporal, NO forma parte del Worker ni de la app.
// Se corre una sola vez con Node para generar los hashes de la semilla,
// y su salida se pega directamente en la migración SQL.
//
// Uso: node generate-seed-hashes.mjs

const PBKDF2_ITERATIONS = 100_000;

async function hashPassword(plainPassword) {
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(plainPassword),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256,
  );

  const toBase64 = (buffer) => Buffer.from(buffer).toString('base64');

  return `${PBKDF2_ITERATIONS}:${toBase64(salt)}:${toBase64(derivedBits)}`;
}

const users = [
  { username: 'admin', password: 'admin123' },
  { username: 'parroco1', password: 'parroco123' },
];

for (const user of users) {
  const hash = await hashPassword(user.password);
  console.log(`-- ${user.username} / contraseña: ${user.password}`);
  console.log(hash);
  console.log('');
}
