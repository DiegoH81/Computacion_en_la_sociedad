import { spawnSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';

const PBKDF2_ITERATIONS = 100_000;
const DATABASES = { pruebas: 'prelatura-db-pruebas' };
const DETAIL = 'Recuperada con el script del servidor';

const { values: options } = parseArgs({
	options: {
		usuario: { type: 'string' },
		principal: { type: 'boolean', default: false },
		remote: { type: 'boolean', default: false },
		local: { type: 'boolean', default: false },
		env: { type: 'string' },
		'persist-to': { type: 'string' },
	},
});

function stop(message)
{
	console.error(message);
	process.exit(1);
}

if (!options.usuario)
	stop('Falta el usuario. Uso: --usuario=admin_general --remote (o --local) [--env=pruebas] [--principal]');

if (options.remote === options.local)
	stop('Indique la base: --remote (la del servidor) o --local (la del Worker local).');

if (options.env !== undefined && !DATABASES[options.env])
	stop(`No existe el entorno "${options.env}". El único es "pruebas".`);

const DATABASE = options.env ? DATABASES[options.env] : 'prelatura-db';
const target = options.remote ? '--remote' : '--local';
const environment = options.env ? `--env ${options.env}` : '';
const persist = options['persist-to'] ? `--persist-to "${options['persist-to']}"` : '';

const sql_text = (value) => (value === null ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`);

function wrangler(extra)
{
	return spawnSync(`npx wrangler d1 execute ${DATABASE} ${target} ${environment} ${persist} --yes ${extra}`, {
		shell: true,
		encoding: 'utf8',
		input: '',
	});
}

async function hash_password(password)
{
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
	const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' }, material, 256);
	return `${PBKDF2_ITERATIONS}:${Buffer.from(salt).toString('base64')}:${Buffer.from(bits).toString('base64')}`;
}

const lookup = wrangler(
	`--json --command "SELECT id, client_id, rol, parroquia_id, activo, principal FROM usuarios WHERE username = ${sql_text(options.usuario)} COLLATE NOCASE"`,
);
if (lookup.status !== 0)
	stop(`No se pudo leer la base.\n${lookup.stdout}${lookup.stderr}`);

let account;
try
{
	account = JSON.parse(lookup.stdout)[0].results[0];
}
catch
{
	stop(`No se entendió la respuesta de la base.\n${lookup.stdout}`);
}

if (!account)
	stop(`No existe la cuenta "${options.usuario}" en esa base.`);

if (options.principal && account.rol !== 'admin_general')
	stop('--principal solo sirve para un administrador general. La marca de una parroquia se pasa desde la app.');

const tables = wrangler(`--json --command "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'historial_ministros_cuentas'"`);
let has_history = false;
try
{
	has_history = tables.status === 0 && JSON.parse(tables.stdout)[0].results.length > 0;
}
catch
{
	has_history = false;
}

const password = randomBytes(12).toString('base64url');
const hash = await hash_password(password);
const now = new Date().toISOString();

const history = (event) => !has_history ? '' :
	`INSERT INTO historial_ministros_cuentas (client_id, parroquia_id, entidad, entidad_client_id, usuario_client_id, evento, detalle, fecha)
	 VALUES (${sql_text(randomUUID())}, ${sql_text(account.parroquia_id)}, 'usuario', ${sql_text(account.client_id)}, NULL, '${event}', ${sql_text(DETAIL)}, ${sql_text(now)});`;

const statements = [
	`UPDATE usuarios SET password_hash = ${sql_text(hash)}, activo = 1 WHERE id = ${account.id};`,
	history('contrasena'),
];

if (account.activo !== 1)
	statements.push(history('habilitado'));

const gives_mark = options.principal && account.principal !== 1;
if (gives_mark)
{
	statements.push('UPDATE usuarios SET principal = 0 WHERE principal = 1 AND parroquia_id IS NULL;');
	statements.push(`UPDATE usuarios SET principal = 1 WHERE id = ${account.id};`);
	statements.push(history('principal'));
}

const directory = mkdtempSync(path.join(tmpdir(), 'prelatura-recuperar-'));
const file = path.join(directory, 'recuperar.sql');
writeFileSync(file, statements.filter(Boolean).join('\n') + '\n');
const result = wrangler(`--file="${file}"`);
rmSync(directory, { recursive: true, force: true });

if (result.status !== 0)
	stop(`No se pudo recuperar la cuenta. No se cambió nada.\n${result.stdout}${result.stderr}`);

console.log(`Cuenta recuperada en ${DATABASE} (${options.remote ? 'servidor' : 'local'}).`);
console.log(`  Usuario:    ${options.usuario}`);
console.log(`  Contraseña: ${password}`);
if (account.activo !== 1)
	console.log('  Estaba deshabilitada: ahora está habilitada.');
if (gives_mark)
	console.log('  Ahora es el administrador general principal.');
if (!has_history)
	console.log('  (Esta base todavía no tiene la migración 0024: no quedó anotado en "Modificaciones".)');
console.log('Guárdela ahora: no se vuelve a mostrar. Las PCs la reciben al sincronizar.');
