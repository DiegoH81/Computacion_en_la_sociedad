import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';

const { values: options } = parseArgs({
	options: {
		'destino-local': { type: 'string' },
	},
});

const TABLES = [
	'historial_ministros_cuentas', 'cambios_persona', 'historial_campos', 'historial_partidas', 'solicitudes_cambio',
	'bautismos', 'confirmaciones', 'matrimonios', 'sync_feed', 'sacramentos', 'personas', 'ministros',
	'dispositivos', 'usuario_parroquias', 'usuarios', 'parroquias',
];

function wrangler(command)
{
	return spawnSync(`npx wrangler ${command}`, { shell: true, encoding: 'utf8', input: '' });
}

function stop(message, result)
{
	console.error(message);
	if (result)
		console.error(result.stdout, result.stderr);
	process.exit(1);
}

const directory = mkdtempSync(path.join(tmpdir(), 'prelatura-copia-'));
const exported = path.join(directory, 'local.sql');
const copy = path.join(directory, 'copia.sql');

try
{
	// 1. Los datos de la base local, sin la estructura.
	const export_result = wrangler(`d1 export prelatura-db --local --no-schema --output="${exported}"`);
	if (export_result.status !== 0)
		stop('No se pudo leer la base local.', export_result);

	// 2. Borrar lo de destino y poner lo de la local. La lista de migraciones aplicadas no se copia:
	//    es la del destino. Los contadores de id (sqlite_sequence) sí, para que los id sigan igual.
	const lines = readFileSync(exported, 'utf8').split('\n')
		.filter((line) => line.trim() !== '' && !line.startsWith('INSERT INTO "d1_migrations"') && !line.startsWith('PRAGMA'));

	//    Al insertar una partida, un trigger le agrega su fila en sync_feed (la cola de descargas): esas
	//    se descartan y se ponen las de la local al final, con su mismo orden. Lo mismo los contadores.
	const is_insert = (line, table) => line.startsWith(`INSERT INTO "${table}"`);
	const feed = lines.filter((line) => is_insert(line, 'sync_feed'));
	const sequences = lines.filter((line) => is_insert(line, 'sqlite_sequence') && !line.includes("'d1_migrations'"));
	// En la base online las claves foráneas se revisan en cada INSERT: se inserta de las padres a las hijas.
	const table_of = (line) => /^INSERT INTO "([a-z_0-9]+)"/.exec(line)?.[1];
	const unknown = lines.map(table_of).filter((table) => table && table !== 'sync_feed' && table !== 'sqlite_sequence' && !TABLES.includes(table));
	if (unknown.length > 0)
		stop(`La base local tiene tablas que este script no conoce: ${[...new Set(unknown)].join(', ')}. Agréguelas a TABLES.`);

	const insert_order = [...TABLES].reverse();
	const data = lines
		.filter((line) => !is_insert(line, 'sync_feed') && !is_insert(line, 'sqlite_sequence'))
		.sort((a, b) => insert_order.indexOf(table_of(a)) - insert_order.indexOf(table_of(b)));
	const clear_sequences = `DELETE FROM sqlite_sequence WHERE name IN (${TABLES.map((table) => `'${table}'`).join(', ')});`;

	const statements = [
		'PRAGMA defer_foreign_keys = TRUE;',
		...TABLES.map((table) => `DELETE FROM ${table};`),
		clear_sequences,
		...data,
		'DELETE FROM sync_feed;',
		...feed,
		clear_sequences,
		...sequences,
	];
	writeFileSync(copy, statements.join('\n') + '\n');

	// 3. Ejecutarlo en el destino.
	const target = options['destino-local']
		? `prelatura-db --local --persist-to "${options['destino-local']}"`
		: 'prelatura-db-pruebas --remote --env pruebas';
	const result = wrangler(`d1 execute ${target} --yes --file="${copy}"`);
	if (result.status !== 0)
		stop('No se pudo copiar. Si falló a la mitad, vuelva a ejecutarlo: empieza borrando todo.', result);

	const count = (table) => lines.filter((line) => line.startsWith(`INSERT INTO "${table}"`)).length;
	console.log(`Copiado a ${options['destino-local'] ? 'la carpeta ' + options['destino-local'] : 'prelatura-db-pruebas (online)'}:`);
	console.log(`  ${count('parroquias')} parroquias, ${count('usuarios')} cuentas, ${count('ministros')} ministros, ${count('sacramentos')} partidas.`);
	console.log('Las PCs instaladas con el paquete inicial de la base local ya coinciden con este servidor.');
}
finally
{
	rmSync(directory, { recursive: true, force: true });
}
