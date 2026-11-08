import { createCipheriv, createDecipheriv, pbkdf2, randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

const KEY_LENGTH = 32;
const HASH_LENGTH = 32;
const SALT_LENGTH = 16;
const COST = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export function new_key(): string
{
	return randomBytes(KEY_LENGTH).toString('hex');
}

function compute_hash(password: string, salt: Buffer, options: ScryptOptions, length: number): Promise<Buffer>
{
	return new Promise((resolve, reject) =>
	{
		scrypt(password.normalize('NFKC'), salt, length, options, (error, hash) =>
		{
			if (error)
				reject(error);
			else
				resolve(hash);
		});
	});
}

// To verify a passwd
export async function create_verifier(password: string): Promise<string>
{
	const salt = randomBytes(SALT_LENGTH);
	const hash = await compute_hash(password, salt, COST, HASH_LENGTH);

	return `scrypt:${COST.N}:${COST.r}:${COST.p}:${salt.toString('base64')}:${hash.toString('base64')}`;
}


const SERVER_ITERATIONS = 100_000;
const SERVER_HASH_BITS = 256;

function compute_server_hash(password: string, salt: Buffer, iterations: number): Promise<Buffer>
{
	return new Promise((resolve, reject) =>
	{
		pbkdf2(password, salt, iterations, SERVER_HASH_BITS / 8, 'sha256', (error, hash) =>
		{
			if (error)
				reject(error);
			else
				resolve(hash);
		});
	});
}

export async function create_server_hash(password: string): Promise<string>
{
	const salt = randomBytes(SALT_LENGTH);
	const hash = await compute_server_hash(password, salt, SERVER_ITERATIONS);

	return `${SERVER_ITERATIONS}:${salt.toString('base64')}:${hash.toString('base64')}`;
}

async function matches_server_hash(password: string, stored: string): Promise<boolean>
{
	const [iterations, salt, hash] = stored.split(':');
	if (!/^\d+$/.test(iterations ?? '') || !salt || !hash)
		return false;

	const expected = Buffer.from(hash, 'base64');
	const actual = await compute_server_hash(password, Buffer.from(salt, 'base64'), Number(iterations));

	return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function matches_verifier(password: string, verifier: string): Promise<boolean>
{
	if (!verifier.startsWith('scrypt:'))
		return matches_server_hash(password, verifier);

	const [, n, r, p, salt, hash] = verifier.split(':');
	if (!salt || !hash)
		return false;

	const expected = Buffer.from(hash, 'base64');
	const options = { N: Number(n), r: Number(r), p: Number(p), maxmem: COST.maxmem };
	const actual = await compute_hash(password, Buffer.from(salt, 'base64'), options, expected.length);

	return timingSafeEqual(actual, expected);
}

export interface PasswordEncrypted
{
	sal: string;
	iv: string;
	etiqueta: string;
	datos: string;
}

const IV_LENGTH = 12;

export async function encrypt_with_password(password: string, data: Buffer): Promise<PasswordEncrypted>
{
	const salt = randomBytes(SALT_LENGTH);
	const iv = randomBytes(IV_LENGTH);
	const key = await compute_hash(password, salt, COST, KEY_LENGTH);

	const cipher = createCipheriv('aes-256-gcm', key, iv);
	const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);

	return {
		sal: salt.toString('base64'),
		iv: iv.toString('base64'),
		etiqueta: cipher.getAuthTag().toString('base64'),
		datos: encrypted.toString('base64'),
	};
}

export async function decrypt_with_password(password: string, encrypted: PasswordEncrypted): Promise<Buffer | null>
{
	const key = await compute_hash(password, Buffer.from(encrypted.sal, 'base64'), COST, KEY_LENGTH);

	try
	{
		const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(encrypted.iv, 'base64'));
		decipher.setAuthTag(Buffer.from(encrypted.etiqueta, 'base64'));
		return Buffer.concat([decipher.update(Buffer.from(encrypted.datos, 'base64')), decipher.final()]);
	}
	catch
	{
		return null;
	}
}
