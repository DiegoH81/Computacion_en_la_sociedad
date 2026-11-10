import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const PACKAGE_FORMAT = 'prelatura-paquete-inicial';
const PACKAGE_VERSION = 1;

const { values: options } = parseArgs({
	options: {
		url: { type: 'string', default: 'http://localhost:8787' },
		user: { type: 'string' },
		password: { type: 'string' },
	},
});

if (!options.user || !options.password)
{
	console.error('Falta --user y --password de un administrador general.');
	process.exit(1);
}

const OUTPUT_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../resources/instalador/paquete-inicial.json');

async function request(in_path, in_token, in_body)
{
	const response = await fetch(options.url + in_path, {
		method: in_body ? 'POST' : 'GET',
		headers: { 'Content-Type': 'application/json', ...(in_token ? { Authorization: `Bearer ${in_token}` } : {}) },
		body: in_body ? JSON.stringify(in_body) : undefined,
	});

	const out_data = await response.json().catch(() => null);
	if (!response.ok)
	{
		console.error(`${in_path} respondió ${response.status}:`, out_data);
		process.exit(1);
	}

	return out_data;
}

// 1. Entrar. Solo el admin_general puede armar el paquete inicial.
const login = await request('/api/auth/login', null, { username: options.user, password: options.password });
if (login.usuario?.rol !== 'admin_general')
{
	console.error('La cuenta debe ser de administrador general.');
	process.exit(1);
}

// 2. Parroquias, ministros y usuarios.
const reference = await request('/api/reference', login.token);

// 3. Todas las partidas, página por página, desde el principio.
const records = [];
let cursor = 0;
while (true)
{
	const page = await request(`/api/sync/pull?cursor=${cursor}`, login.token);
	records.push(...page.partidas);
	cursor = page.cursor;
	if (!page.hayMas)
		break;

}

const content = {
	formato: PACKAGE_FORMAT,
	version: PACKAGE_VERSION,
	generado_en: new Date().toISOString(),
	cursor: String(cursor),
	parroquias: reference.parroquias,
	usuarios: reference.usuarios,
	usuario_parroquias: reference.usuario_parroquias,
	ministros: reference.ministros,
	partidas: records,
};

mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
writeFileSync(OUTPUT_FILE, JSON.stringify(content), 'utf8');

console.log(`Paquete inicial guardado en ${OUTPUT_FILE}`);
console.log(`${content.parroquias.length} parroquias, ${content.usuarios.length} usuarios, ${content.ministros.length} ministros y ${records.length} partidas.`);
