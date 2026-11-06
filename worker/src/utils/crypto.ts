import { jwtVerify, SignJWT } from 'jose';
import type { Role } from '../../../shared/sync';
import { JWT_DURATION, PASSWORD_ITERATIONS } from './config';


export interface TokenUser
{
	usuarioId: number;
	rol: Role;
	parroquiaId: number | null;
	[key: string]: unknown;
}

const JWT_ALGORITHM = 'HS256';
const SALT_LENGTH = 16;
const HASH_LENGTH_BITS = 256;
const IV_LENGTH = 12;

function to_base64(bytes: Uint8Array): string
{
	return btoa(String.fromCharCode(...bytes));
}

function from_base64(text: string): Uint8Array<ArrayBuffer>
{
	return Uint8Array.from(atob(text), (character) => character.charCodeAt(0));
}


function secret_bytes(secret: string): Uint8Array
{
	return new TextEncoder().encode(secret);
}

export async function sign_jwt(user: TokenUser, secret: string): Promise<string>
{
	const token = new SignJWT(user)
		.setProtectedHeader({ alg: JWT_ALGORITHM })
		.setIssuedAt()
		.setExpirationTime(JWT_DURATION);

	return token.sign(secret_bytes(secret));
}

export async function verify_jwt(token: string, secret: string): Promise<TokenUser>
{
	const result = await jwtVerify(token, secret_bytes(secret), { algorithms: [JWT_ALGORITHM] });
	return result.payload as TokenUser;
}


// Passwords

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
	const hash = await compute_hash(password, salt, PASSWORD_ITERATIONS);

	return `${PASSWORD_ITERATIONS}:${to_base64(salt)}:${to_base64(hash)}`;
}

export async function verify_password(password: string, stored_hash: string): Promise<boolean>
{
	const [iterations_text, salt_text, hash_text] = stored_hash.split(':');
	if (!iterations_text || !salt_text || !hash_text)
		return false;

	const hash = await compute_hash(password, from_base64(salt_text), Number(iterations_text));
	const computed_text = to_base64(hash);

	if (computed_text.length !== hash_text.length)
		return false;

	let difference = 0;
	for (let i = 0; i < computed_text.length; i++)
		difference |= computed_text.charCodeAt(i) ^ hash_text.charCodeAt(i);

	return difference === 0;
}


// From device
async function device_secret_key(secret: string): Promise<CryptoKey>
{
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
	return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encrypt_device_key(text: string, secret: string): Promise<string>
{
	const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
	const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, await device_secret_key(secret), new TextEncoder().encode(text));

	return `${to_base64(iv)}:${to_base64(new Uint8Array(data))}`;
}

export async function decrypt_device_key(stored: string, secret: string): Promise<string>
{
	const [iv, data] = stored.split(':');
	const text = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: from_base64(iv) }, await device_secret_key(secret), from_base64(data));

	return new TextDecoder().decode(text);
}
