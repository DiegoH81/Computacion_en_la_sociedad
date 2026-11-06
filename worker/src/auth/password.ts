// Contraseñas con PBKDF2-SHA256 usando Web Crypto, que ya viene incluido en los Workers.
//
// No usamos bcrypt: en JavaScript puro tarda unos 74 ms y el plan gratuito de Cloudflare
// solo da unos 10 ms de CPU por petición.
//
// En usuarios.password_hash se guarda el texto "iteraciones:sal:hash" (sal y hash en base64).
// Los scripts de src/scripts generan hashes con este mismo formato.

const ITERATIONS = 100_000; // el máximo que permite Cloudflare
const SALT_LENGTH = 16;
const HASH_LENGTH_BITS = 256;

function to_base64(bytes: Uint8Array): string
{
	return btoa(String.fromCharCode(...bytes));
}

function from_base64(text: string): Uint8Array<ArrayBuffer>
{
	return Uint8Array.from(atob(text), (character) => character.charCodeAt(0));
}

async function compute_hash(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array>
{
	const password_key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
	const settings = { name: 'PBKDF2', salt: salt, iterations: iterations, hash: 'SHA-256' };
	const bits = await crypto.subtle.deriveBits(settings, password_key, HASH_LENGTH_BITS);

	return new Uint8Array(bits);
}

export async function hash_password(password: string): Promise<string>
{
	const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
	const hash = await compute_hash(password, salt, ITERATIONS);

	return `${ITERATIONS}:${to_base64(salt)}:${to_base64(hash)}`;
}

// Vuelve a calcular el hash con la misma sal e iteraciones y lo compara con el guardado.
export async function verify_password(password: string, stored_hash: string): Promise<boolean>
{
	const [iterations_text, salt_text, hash_text] = stored_hash.split(':');
	if (!iterations_text || !salt_text || !hash_text)
		return false;

	const hash = await compute_hash(password, from_base64(salt_text), Number(iterations_text));
	const computed_text = to_base64(hash);

	if (computed_text.length !== hash_text.length)
		return false;

	// Se recorren todos los caracteres aunque el primero ya sea distinto,
	// así el tiempo de respuesta no revela cuántos coincidieron.
	let difference = 0;
	for (let i = 0; i < computed_text.length; i++)
		difference |= computed_text.charCodeAt(i) ^ hash_text.charCodeAt(i);

	return difference === 0;
}
