// Carga los datos reales de la prelatura, para hacer pruebas, en la base local del Worker o en la base
// online de PRUEBAS (nunca en la del padre):
//
//   1. Borra todo menos el administrador general (la cuenta con id 1 se queda con su contraseña; con
//      --admin-password se crea o se reemplaza como "admin_general" con esa contraseña).
//   2. Crea las 21 parroquias de la lista "LISTA DE PARROQUIAS Y SACERDOTES", como "Nombre (Lugar)".
//   3. Pone los 19 ministros activos en cada parroquia (Monseñor, Presbítero, Diácono).
//   4. Crea las cuentas: Jhon_1 (contraseña "ayaviri") es el administrador principal de Crucero y de
//      Usicayos; cada otra parroquia tiene admin_<lugar> con el lugar como contraseña ("ayaviri").
//   5. Importa el Excel del sistema anterior en Nuestra Señora del Rosario (Crucero), con las mismas
//      reglas que la app (electron/main/import/legacy_excel.ts).
//
// Uso, desde worker/:
//   node src/scripts/seed-prelatura.mjs --excel="../EXPORTADO - NUESTRA SÑORA DEL ROSARIO (CRUCERO).xlsx"
//
// Por defecto trabaja en la base local (para otra carpeta de datos: --persist-to=carpeta).
// En la base online de pruebas (recién migrada), con el administrador general nuevo:
//   node src/scripts/seed-prelatura.mjs --remote --env=pruebas --admin-password=<clave> --excel="..."
// --remote solo se acepta con --env=pruebas: así no se puede borrar la base del padre por error.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import readXlsxFile from 'read-excel-file/node';

const { values: options } = parseArgs({
	options: {
		excel: { type: 'string' },
		'persist-to': { type: 'string' },
		remote: { type: 'boolean', default: false },
		env: { type: 'string' },
		'admin-password': { type: 'string' },
	},
});

// El único entorno de wrangler.jsonc con base propia, y la base que le corresponde.
const DATABASES = { pruebas: 'prelatura-db-pruebas' };

if (options.env !== undefined && !DATABASES[options.env])
{
	console.error(`No existe el entorno "${options.env}". El único es "pruebas".`);
	process.exit(1);
}

if (options.remote && options.env !== 'pruebas')
{
	console.error('--remote solo se puede usar con --env=pruebas: este script borra la base entera.');
	process.exit(1);
}

const DATABASE = options.env ? DATABASES[options.env] : 'prelatura-db';

if (!options.excel)
{
	console.error('Falta --excel con la ruta del Excel exportado del sistema anterior.');
	process.exit(1);
}

// El lector del Excel es el mismo de la app (Node 24 ejecuta TypeScript directamente).
const LEGACY_EXCEL = path.resolve(import.meta.dirname, '../../../electron/main/import/legacy_excel.ts');
const { read_workbook } = await import(pathToFileURL(LEGACY_EXCEL).href);

const PBKDF2_ITERATIONS = 100_000; // Igual que PASSWORD_ITERATIONS en worker/src/utils/config.ts.

// ---------------------------------------------------------------------------
// Datos
// ---------------------------------------------------------------------------

// Los id se fijan en el orden de la lista (los mismos que ya usaba la base).
const PARISHES = [
	{ id: 1, nombre: 'San Francisco de Asís', lugar: 'Ayaviri', provincia: 'Melgar' },
	{ id: 2, nombre: 'Santa Cruz', lugar: 'Orurillo', provincia: 'Melgar' },
	{ id: 3, nombre: 'San Pedro Apóstol', lugar: 'Nuñoa', provincia: 'Melgar' },
	{ id: 4, nombre: 'Santa Rosa de Lima', lugar: 'Santa Rosa', provincia: 'Melgar' },
	{ id: 5, nombre: 'San Francisco de Asís', lugar: 'Umachiri', provincia: 'Melgar' },
	{ id: 6, nombre: 'Nuestra Señora de las Nieves', lugar: 'Llalli', provincia: 'Melgar' },
	{ id: 7, nombre: 'Santa Lucía', lugar: 'Macari', provincia: 'Melgar' },
	{ id: 8, nombre: 'San Juan Bautista', lugar: 'Cupi', provincia: 'Melgar' },
	{ id: 9, nombre: 'San Juan Bautista', lugar: 'Macusani', provincia: 'Carabaya' },
	{ id: 10, nombre: 'Santa Catalina', lugar: 'Antauta', provincia: 'Carabaya' },
	{ id: 11, nombre: 'San Bartolomé', lugar: 'Usicayos', provincia: 'Carabaya' },
	{ id: 12, nombre: 'San Juan Bautista', lugar: 'Ajoyani', provincia: 'Carabaya' },
	{ id: 13, nombre: 'San Francisco de Asís', lugar: 'Ollachea', provincia: 'Carabaya' },
	{ id: 14, nombre: 'Santa Bárbara', lugar: 'Coasa', provincia: 'Carabaya' },
	{ id: 15, nombre: 'Nuestra Señora de las Mercedes', lugar: 'San Gabán', provincia: 'Carabaya' },
	{ id: 16, nombre: 'Santísima Trinidad', lugar: 'Limbani', provincia: 'Carabaya' },
	{ id: 17, nombre: 'San Miguel Arcángel', lugar: 'Phara', provincia: 'Carabaya' },
	{ id: 18, nombre: 'Nuestra Señora del Rosario', lugar: 'Crucero', provincia: 'Carabaya' },
	{ id: 19, nombre: 'Nuestra Señora del Rosario', lugar: 'Corani', provincia: 'Carabaya' },
	{ id: 20, nombre: 'San Salvador', lugar: 'Ayapata', provincia: 'Carabaya' },
	{ id: 21, nombre: 'San Lorenzo', lugar: 'Ituata', provincia: 'Carabaya' },
];

const CRUCERO = 18;
const USICAYOS = 11;

const MINISTERS = [
	{ titulo: 'Monseñor', nombre: 'Benigno', apellido_paterno: 'Condori', apellido_materno: 'Chuchi' },
	{ titulo: 'Presbítero', nombre: 'Mauricio Andrés', apellido_paterno: 'Urrea', apellido_materno: 'Duque' },
	{ titulo: 'Presbítero', nombre: 'Juan Luis', apellido_paterno: 'Puma', apellido_materno: 'Yunganina' },
	{ titulo: 'Presbítero', nombre: 'Nilton', apellido_paterno: 'Cueto', apellido_materno: 'Fernández' },
	{ titulo: 'Presbítero', nombre: 'Percy Elvis', apellido_paterno: 'Yaresi', apellido_materno: 'Quispe' },
	{ titulo: 'Presbítero', nombre: 'Dante Moisés', apellido_paterno: 'Rosado', apellido_materno: 'Maraví' },
	{ titulo: 'Presbítero', nombre: 'Domingo', apellido_paterno: 'Atamari', apellido_materno: 'Calcina' },
	{ titulo: 'Presbítero', nombre: 'Rafael', apellido_paterno: 'Vargas', apellido_materno: 'Martínez' },
	{ titulo: 'Presbítero', nombre: 'Mario', apellido_paterno: 'Farfán', apellido_materno: 'Zevallos' },
	{ titulo: 'Presbítero', nombre: 'Javier', apellido_paterno: 'Quicaña', apellido_materno: 'Cuaquira' },
	{ titulo: 'Presbítero', nombre: 'Joseph Ismael', apellido_paterno: 'Icochea', apellido_materno: 'Bastarrachea' },
	{ titulo: 'Presbítero', nombre: 'César John', apellido_paterno: 'Caparachin', apellido_materno: 'Villaverde' },
	{ titulo: 'Presbítero', nombre: 'Pedro Flavio', apellido_paterno: 'Anccori', apellido_materno: 'Hancco' },
	{ titulo: 'Presbítero', nombre: 'Arnaldo Guillen', apellido_paterno: 'Condori', apellido_materno: 'Huanca' },
	{ titulo: 'Presbítero', nombre: 'Piter Yasmani', apellido_paterno: 'Huamani', apellido_materno: 'Palacios' },
	{ titulo: 'Presbítero', nombre: 'Julián', apellido_paterno: 'Condori', apellido_materno: 'Qquenta' },
	{ titulo: 'Presbítero', nombre: 'Alejandro', apellido_paterno: 'Flores', apellido_materno: 'López' },
	{ titulo: 'Presbítero', nombre: 'Romeo', apellido_paterno: 'Quispe', apellido_materno: 'Ramos' },
	{ titulo: 'Diácono', nombre: 'Nelson', apellido_paterno: 'Mauricio', apellido_materno: '' },
];

// Los títulos abreviados del Excel se escriben completos; los demás ("P.", "HNO") quedan como están.
const FULL_TITLES = { 'MONS': 'Monseñor', 'PBRO': 'Presbítero', 'DIAC': 'Diácono' };

const JHON = { username: 'Jhon_1', password: 'ayaviri', nombre: 'Jhon', apellido_paterno: '', apellido_materno: '' };

// ---------------------------------------------------------------------------
// Ayudas
// ---------------------------------------------------------------------------

// El mismo formato que usa el Worker al guardar una contraseña: iteraciones:sal:hash (PBKDF2-SHA256).
async function hash_password(in_password)
{
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(in_password), 'PBKDF2', false, ['deriveBits']);
	const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' }, key, 256);
	return `${PBKDF2_ITERATIONS}:${Buffer.from(salt).toString('base64')}:${Buffer.from(bits).toString('base64')}`;
}

function sql_value(value)
{
	if (value === null || value === undefined)
		return 'NULL';

	if (typeof value === 'number')
		return String(value);

	return `'${String(value).replaceAll("'", "''")}'`;
}

// "San Gabán" -> "sangaban": sin tildes, sin espacios y en minúsculas.
function plain_text(in_text)
{
	return in_text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ñ/gi, 'n').toLowerCase();
}

function normalize(in_text)
{
	return in_text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
}

function minister_key(minister)
{
	return normalize([minister.nombre, minister.apellido_paterno, minister.apellido_materno].filter((part) => part).join(' '));
}

function full_title(in_title)
{
	if (!in_title)
		return null;

	return FULL_TITLES[normalize(in_title).replace(/\.$/, '')] ?? in_title;
}

const sacrament_id = (client_id) => `(SELECT id FROM sacramentos WHERE client_id = ${sql_value(client_id)})`;
const person_id = (client_id) => `(SELECT id FROM personas WHERE client_id = ${sql_value(client_id)})`;
const minister_id = (client_id) => `(SELECT id FROM ministros WHERE client_id = ${sql_value(client_id)})`;

// ---------------------------------------------------------------------------
// Leer el Excel antes de borrar nada: si el formato no es el correcto, no se toca la base.
// ---------------------------------------------------------------------------

const excel = read_workbook(await readXlsxFile(path.resolve(options.excel)));

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------

const statements = [];

// 1. Borrar todo, de las tablas hijas a las padres. El administrador general (id 1) se queda.
const TABLES_TO_EMPTY = ['cambios_persona', 'historial_campos', 'historial_partidas', 'solicitudes_cambio', 'bautismos', 'confirmaciones', 'matrimonios', 'sync_feed', 'sacramentos', 'personas', 'ministros', 'dispositivos', 'usuario_parroquias'];
for (const table of TABLES_TO_EMPTY)
	statements.push(`DELETE FROM ${table};`);

statements.push(`DELETE FROM usuarios WHERE id <> 1;`);

// Una base recién migrada trae en el id 1 una cuenta de prueba (admin/admin123): se reemplaza por el
// administrador general, con la contraseña indicada.
if (options['admin-password'] !== undefined)
{
	statements.push(`DELETE FROM usuarios;`);
	statements.push(
		`INSERT INTO usuarios (id, client_id, username, password_hash, rol, parroquia_id, activo, principal, nombre, apellido_paterno, apellido_materno)
		 VALUES (1, ${sql_value(crypto.randomUUID())}, 'admin_general', ${sql_value(await hash_password(options['admin-password']))},
		         'admin_general', NULL, 1, 1, 'Administrador', 'General', '');`,
	);
}
statements.push(`DELETE FROM parroquias;`);
statements.push(`DELETE FROM sqlite_sequence WHERE name IN (${[...TABLES_TO_EMPTY, 'parroquias'].map(sql_value).join(', ')});`);
statements.push(`UPDATE sqlite_sequence SET seq = 1 WHERE name = 'usuarios';`);

// 2. Parroquias.
for (const parish of PARISHES)
{
	statements.push(
		`INSERT INTO parroquias (id, nombre, ubicacion, activa)
		 VALUES (${parish.id}, ${sql_value(`${parish.nombre} (${parish.lugar})`)}, ${sql_value(`${parish.lugar}, ${parish.provincia}`)}, 1);`,
	);
}

// 3. Cuentas. Jhon_1 es de Crucero (su parroquia de origen) y también principal de Usicayos.
const accounts = [];
let next_user_id = 2;
for (const parish of PARISHES)
{
	if (parish.id === USICAYOS)
		continue;

	if (parish.id === CRUCERO)
	{
		accounts.push({ id: next_user_id++, parroquia_id: CRUCERO, ...JHON });
		continue;
	}

	accounts.push({
		id: next_user_id++,
		parroquia_id: parish.id,
		username: `admin_${plain_text(parish.lugar).replaceAll(' ', '_')}`,
		password: plain_text(parish.lugar).replaceAll(' ', ''),
		nombre: 'Administrador',
		apellido_paterno: parish.lugar,
		apellido_materno: '',
	});
}

for (const account of accounts)
{
	statements.push(
		`INSERT INTO usuarios (id, client_id, username, password_hash, rol, parroquia_id, activo, principal, nombre, apellido_paterno, apellido_materno)
		 VALUES (${account.id}, ${sql_value(crypto.randomUUID())}, ${sql_value(account.username)}, ${sql_value(await hash_password(account.password))},
		         'admin_parroquia', ${account.parroquia_id}, 1, 1, ${sql_value(account.nombre)}, ${sql_value(account.apellido_paterno)}, ${sql_value(account.apellido_materno)});`,
	);
}

const jhon = accounts.find((account) => account.username === JHON.username);
statements.push(`INSERT INTO usuario_parroquias (usuario_id, parroquia_id, rol, principal) VALUES (${jhon.id}, ${USICAYOS}, 'admin_parroquia', 1);`);

// 4. Los 19 ministros en cada parroquia. En Crucero se guardan por nombre para buscar a los celebrantes.
const crucero_ministers = new Map();
for (const parish of PARISHES)
{
	for (const minister of MINISTERS)
	{
		const client_id = crypto.randomUUID();
		statements.push(
			`INSERT INTO ministros (client_id, titulo, nombre, apellido_paterno, apellido_materno, parroquia_id, activo)
			 VALUES (${sql_value(client_id)}, ${sql_value(minister.titulo)}, ${sql_value(minister.nombre)}, ${sql_value(minister.apellido_paterno)},
			         ${sql_value(minister.apellido_materno)}, ${parish.id}, 1);`,
		);

		if (parish.id === CRUCERO)
			crucero_ministers.set(minister_key(minister), client_id);

	}
}

// El celebrante se busca por nombre entre los ministros de Crucero; si no está, se crea (como en la app).
let created_ministers = 0;
function celebrant_of(in_minister)
{
	if (!in_minister)
		return null;

	const key = minister_key(in_minister);
	const found = crucero_ministers.get(key);
	if (found)
		return found;

	const client_id = crypto.randomUUID();
	statements.push(
		`INSERT INTO ministros (client_id, titulo, nombre, apellido_paterno, apellido_materno, parroquia_id, activo)
		 VALUES (${sql_value(client_id)}, ${sql_value(full_title(in_minister.titulo))}, ${sql_value(in_minister.nombre)}, ${sql_value(in_minister.apellido_paterno)},
		         ${sql_value(in_minister.apellido_materno)}, ${CRUCERO}, 1);`,
	);
	crucero_ministers.set(key, client_id);
	created_ministers++;
	return client_id;
}

// 5. Las partidas del Excel, en Crucero, importadas por Jhon_1.
function insert_person(in_person)
{
	const client_id = crypto.randomUUID();
	statements.push(
		`INSERT INTO personas (client_id, parroquia_id, dni, nombres, apellido_paterno, apellido_materno, fecha_nacimiento, fecha_aproximada, lugar_nacimiento, padre, madre)
		 VALUES (${sql_value(client_id)}, ${CRUCERO}, ${sql_value(in_person.dni)}, ${sql_value(in_person.nombres)}, ${sql_value(in_person.apellido_paterno)},
		         ${sql_value(in_person.apellido_materno)}, ${sql_value(in_person.fecha_nacimiento)}, ${sql_value(in_person.fecha_aproximada)},
		         ${sql_value(in_person.lugar_nacimiento)}, ${sql_value(in_person.padre)}, ${sql_value(in_person.madre)});`,
	);
	return client_id;
}

const by_type = { bautismo: 0, confirmacion: 0, matrimonio: 0 };
for (const record of excel.partidas)
{
	by_type[record.tipo]++;
	const people = record.personas.map(insert_person);
	const celebrant = celebrant_of(record.celebrante);
	const client_id = crypto.randomUUID();

	statements.push(
		`INSERT INTO sacramentos (client_id, tipo, parroquia_id, ministro_id, libro, folio, numero, fecha_emision, fecha_evento, anotaciones)
		 VALUES (${sql_value(client_id)}, ${sql_value(record.tipo)}, ${CRUCERO}, ${celebrant ? minister_id(celebrant) : 'NULL'},
		         ${sql_value(record.libro)}, ${sql_value(record.folio)}, ${sql_value(record.numero)}, ${sql_value(record.fecha_emision)},
		         ${sql_value(record.fecha_evento)}, ${sql_value(record.anotaciones)});`,
	);

	statements.push(
		`INSERT INTO historial_partidas (client_id, sacramento_id, usuario_id, evento, motivo)
		 VALUES (${sql_value(crypto.randomUUID())}, ${sacrament_id(client_id)}, ${jhon.id}, 'importada', ${sql_value(`Fila ${record.fila} del Excel del sistema anterior`)});`,
	);

	const detail = record.detalle;
	if (record.tipo === 'matrimonio')
	{
		statements.push(
			`INSERT INTO matrimonios (sacramento_id, conyuge_1_id, conyuge_2_id, lugar, testigo_1, testigo_2, testigo_3, testigo_4,
			                          conyuge_1_bautismo_parroquia, conyuge_1_bautismo_fecha, conyuge_2_bautismo_parroquia, conyuge_2_bautismo_fecha)
			 VALUES (${sacrament_id(client_id)}, ${person_id(people[0])}, ${person_id(people[1])}, ${sql_value(detail.lugar)},
			         ${sql_value(detail.testigo_1)}, ${sql_value(detail.testigo_2)}, ${sql_value(detail.testigo_3)}, ${sql_value(detail.testigo_4)},
			         ${sql_value(detail.conyuge_1_bautismo_parroquia)}, ${sql_value(detail.conyuge_1_bautismo_fecha)},
			         ${sql_value(detail.conyuge_2_bautismo_parroquia)}, ${sql_value(detail.conyuge_2_bautismo_fecha)});`,
		);
		continue;
	}

	const detail_table = record.tipo === 'bautismo' ? 'bautismos' : 'confirmaciones';
	statements.push(
		`INSERT INTO ${detail_table} (sacramento_id, persona_id, padrino_1, padrino_2)
		 VALUES (${sacrament_id(client_id)}, ${person_id(people[0])}, ${sql_value(detail.padrino_1)}, ${sql_value(detail.padrino_2)});`,
	);
}

// ---------------------------------------------------------------------------
// Ejecutar en la base local
// ---------------------------------------------------------------------------

const directory = mkdtempSync(path.join(tmpdir(), 'prelatura-datos-'));
const file = path.join(directory, 'prelatura.sql');
writeFileSync(file, statements.join('\n') + '\n');

const target = options.remote ? '--remote' : '--local';
const environment = options.env ? `--env ${options.env}` : '';
const persist = options['persist-to'] ? `--persist-to "${options['persist-to']}"` : '';
const result = spawnSync(`npx wrangler d1 execute ${DATABASE} ${target} ${environment} ${persist} --yes --file="${file}"`, {
	shell: true,
	encoding: 'utf8',
	input: '',
});
rmSync(directory, { recursive: true, force: true });

if (result.status !== 0)
{
	console.error(result.stdout, result.stderr);
	console.error('No se pudieron cargar los datos.');
	process.exit(1);
}

console.log(`Base ${DATABASE} (${options.remote ? 'online' : 'local'}) cargada (${statements.length} sentencias).`);
console.log(`${PARISHES.length} parroquias, ${MINISTERS.length} ministros en cada una (${created_ministers} más en Crucero, tomados de los celebrantes del Excel).`);
console.log(`Partidas importadas en Crucero: ${excel.partidas.length} (${by_type.bautismo} bautismos, ${by_type.confirmacion} confirmaciones, ${by_type.matrimonio} matrimonios).`);
if (excel.errores.length > 0)
{
	console.log(`Filas del Excel que no se importaron: ${excel.errores.length}`);
	for (const error of excel.errores)
		console.log(`  fila ${error.fila}: ${error.motivo}`);

}

console.log('Cuentas (todas administrador principal de su parroquia):');
for (const account of accounts)
{
	const parishes = account.id === jhon.id ? 'Crucero y Usicayos' : PARISHES.find((parish) => parish.id === account.parroquia_id).lugar;
	console.log(`  ${account.username.padEnd(18)} contraseña: ${account.password.padEnd(12)} ${parishes}`);
}
if (options['admin-password'] !== undefined)
	console.log('Administrador general: admin_general, con la contraseña indicada en --admin-password.');
else
	console.log('El administrador general (id 1) se conserva con su contraseña.');
