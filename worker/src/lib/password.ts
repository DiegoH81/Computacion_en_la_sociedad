// Hashing de contraseñas con PBKDF2-HMAC-SHA256 vía Web Crypto (nativa en Workers).
// No usamos bcrypt: la implementación pura en JS excede el límite de CPU
// por request del plan gratuito de Cloudflare Workers (~74ms vs ~10ms disponibles).
// PBKDF2 vía crypto.subtle es nativo del runtime, sin dependencias adicionales.

const PBKDF2_ITERATIONS = 100_000; // tope permitido por Cloudflare para PBKDF2 vía WebCrypto
const HASH_ALGORITHM = 'SHA-256';
const KEY_LENGTH_BITS = 256;

function toBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}

/**
 * Genera un hash de contraseña en el formato: "iteraciones:saltBase64:hashBase64"
 * Este string completo es lo que se guarda en usuarios.password_hash.
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(plainPassword),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: HASH_ALGORITHM,
    },
    keyMaterial,
    KEY_LENGTH_BITS,
  );

  return `${PBKDF2_ITERATIONS}:${toBase64(salt.buffer as ArrayBuffer)}:${toBase64(derivedBits)}`;
}

/**
 * Verifica una contraseña en texto plano contra un hash almacenado.
 * Recalcula el hash con el mismo salt/iteraciones guardados y compara.
 */
export async function verifyPassword(
  plainPassword: string,
  storedHash: string,
): Promise<boolean> {
  const [iterationsStr, saltB64, hashB64] = storedHash.split(':');
  if (!iterationsStr || !saltB64 || !hashB64) {
    return false; // hash con formato inválido/corrupto
  }

  const iterations = Number(iterationsStr);
  const salt = fromBase64(saltB64);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(plainPassword),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: HASH_ALGORITHM,
    },
    keyMaterial,
    KEY_LENGTH_BITS,
  );

  const computedHash = toBase64(derivedBits);

  // Comparación de igual longitud para evitar timing attacks triviales.
  if (computedHash.length !== hashB64.length) return false;
  let result = 0;
  for (let i = 0; i < computedHash.length; i++) {
    result |= computedHash.charCodeAt(i) ^ hashB64.charCodeAt(i);
  }
  return result === 0;
}