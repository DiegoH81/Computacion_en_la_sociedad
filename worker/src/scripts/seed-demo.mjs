import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';

const { values: options } = parseArgs({
	options: {
		'persist-to': { type: 'string' },
	},
});

const PASSWORD = 'admin123';
const PBKDF2_ITERATIONS = 100_000;

// ---------------------------------------------------------------------------
// Números al azar, pero siempre los mismos: cada corrida genera exactamente las mismas partidas.
// ---------------------------------------------------------------------------

let random_state = 20261107;

function next_random()
{
	// mulberry32: un generador pequeño y conocido.
	random_state = (random_state + 0x6d2b79f5) | 0;
	let t = random_state;
	t = Math.imul(t ^ (t >>> 15), t | 1);
	t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function random_int(min, max)
{
	return min + Math.floor(next_random() * (max - min + 1));
}

function pick(list)
{
	return list[random_int(0, list.length - 1)];
}

function chance(probability)
{
	return next_random() < probability;
}

// Un client_id con forma de UUID que depende solo del texto: "demo-bautismo-1-12" da siempre el mismo.
function seed_uuid(key)
{
	let hex = '';
	let hash = 2166136261;
	while (hex.length < 32)
	{
		for (const character of key + hex.length)
			hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);

		hex += (hash >>> 0).toString(16).padStart(8, '0');
	}
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

// El mismo formato que usa el Worker al guardar una contraseña: iteraciones:sal:hash (PBKDF2-SHA256).
async function hash_password(in_password)
{
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(in_password), 'PBKDF2', false, ['deriveBits']);
	const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' }, key, 256);
	return `${PBKDF2_ITERATIONS}:${Buffer.from(salt).toString('base64')}:${Buffer.from(bits).toString('base64')}`;
}

// ---------------------------------------------------------------------------
// Ayudas para escribir el SQL
// ---------------------------------------------------------------------------

function sql_value(value)
{
	if (value === null || value === undefined)
		return 'NULL';

	if (typeof value === 'number')
		return String(value);

	return `'${String(value).replaceAll("'", "''")}'`;
}

const minister_id = (client_id) => `(SELECT id FROM ministros WHERE client_id = ${sql_value(client_id)})`;
const sacrament_id = (client_id) => `(SELECT id FROM sacramentos WHERE client_id = ${sql_value(client_id)})`;
const person_id = (client_id) => `(SELECT id FROM personas WHERE client_id = ${sql_value(client_id)})`;

const two_digits = (number) => String(number).padStart(2, '0');

// ---------------------------------------------------------------------------
// Datos base
// ---------------------------------------------------------------------------

const MALE_NAMES = ['Juan', 'José', 'Luis', 'Carlos', 'Miguel', 'Jorge', 'Pedro', 'Manuel', 'Víctor', 'César', 'Raúl', 'Andrés', 'Diego', 'Fernando', 'Ricardo', 'Álvaro', 'Hugo', 'Mateo', 'Santiago', 'Gabriel', 'Julio', 'Teodoro', 'Eusebio', 'Wilfredo'];
const FEMALE_NAMES = ['María', 'Rosa', 'Ana', 'Carmen', 'Juana', 'Luz', 'Elena', 'Lucía', 'Sofía', 'Valeria', 'Patricia', 'Gladys', 'Marisol', 'Teresa', 'Silvia', 'Milagros', 'Yolanda', 'Flor', 'Camila', 'Ximena', 'Rocío', 'Nélida', 'Gumersinda', 'Dominga'];
const SURNAMES = ['Quispe', 'Mamani', 'Huamán', 'Flores', 'Rojas', 'García', 'Sánchez', 'Torres', 'Ramírez', 'Chávez', 'Vargas', 'Castillo', 'Mendoza', 'Gutiérrez', 'Condori', 'Apaza', 'Ccama', 'Paredes', 'Ríos', 'Salazar', 'Cáceres', 'Zevallos', 'Pacheco', 'Villanueva', 'Cusi', 'Yupanqui', 'Ticona', 'Choque'];
const PLACES = ['Juli', 'Puno', 'Pomata', 'Ilave', 'Yunguyo', 'Desaguadero', 'Zepita', 'Crucero', 'Pilcuyo', 'Arequipa', 'Lima', 'Tacna'];
const MINISTER_TITLES = ['Pbro.', 'Pbro.', 'Pbro.', 'Mons.', 'Fr.', 'Diác.'];

// Los id se fijan (1 a 4) para que admin1 sea siempre de la parroquia 1, admin2 de la 2, etc.
const PARISHES = [
	{ id: 1, nombre: 'San Pedro Mártir', ubicacion: 'Juli, Chucuito' },
	{ id: 2, nombre: 'Nuestra Señora del Rosario', ubicacion: 'Crucero, Carabaya' },
	{ id: 3, nombre: 'Santiago Apóstol', ubicacion: 'Pomata, Chucuito' },
	{ id: 4, nombre: 'San Juan Bautista', ubicacion: 'Ilave, El Collao' },
];

const RECORDS_PER_PARISH = { bautismo: 22, confirmacion: 16, matrimonio: 12 };
const MINISTERS_PER_PARISH = 3;
const HELPERS_PER_PARISH = 2;

// ---------------------------------------------------------------------------
// Generadores
// ---------------------------------------------------------------------------

function random_person_name(sex)
{
	const first_name = pick(sex === 'm' ? MALE_NAMES : FEMALE_NAMES);
	const second_name = chance(0.4) ? ' ' + pick(sex === 'm' ? MALE_NAMES : FEMALE_NAMES) : '';
	return {
		nombres: first_name + second_name,
		apellido_paterno: pick(SURNAMES),
		apellido_materno: pick(SURNAMES),
	};
}

function random_full_name(sex)
{
	const name = random_person_name(sex);
	return `${name.nombres} ${name.apellido_paterno} ${name.apellido_materno}`.trim();
}

// Una fecha completa que no pase de hoy.
function clamp_to_today(date)
{
	const today = new Date();
	const today_text = `${today.getFullYear()}-${two_digits(today.getMonth() + 1)}-${two_digits(today.getDate())}`;
	return date > today_text ? today_text : date;
}

// Una fecha AAAA-MM-DD. A veces sale incompleta (solo año, o año y mes), como en los libros viejos.
function random_date(year, allow_partial)
{
	const month = random_int(1, 12);
	const day = random_int(1, new Date(year, month, 0).getDate());

	if (allow_partial && chance(0.06))
		return String(year);

	if (allow_partial && chance(0.1))
		return `${year}-${two_digits(month)}`;

	return clamp_to_today(`${year}-${two_digits(month)}-${two_digits(day)}`);
}

// Más partidas en los años recientes, para que las estadísticas tengan forma.
function random_event_date()
{
	const current_year = new Date().getFullYear();
	const year = chance(0.55) ? random_int(current_year - 3, current_year) : random_int(1985, current_year - 4);
	return random_date(year, false);
}

// Una persona con todos los datos obligatorios: fecha de nacimiento o, si no, una fecha aproximada.
function random_person(key, sex, event_date, in_age_min, in_age_max)
{
	const name = random_person_name(sex);
	const event_year = Number(event_date.slice(0, 4));
	const age = random_int(in_age_min, in_age_max);
	const birth_year = Math.max(1900, event_year - age);

	let fecha_nacimiento = null;
	let fecha_aproximada = null;
	const roll = next_random();
	if (roll < 0.8)
		fecha_nacimiento = random_date(birth_year, true);
	else
		fecha_aproximada = age === 0 ? 'Recién nacido' : `(${age} AÑOS AL DÍA DEL SACRAMENTO)`;

	return {
		client_id: seed_uuid(key),
		dni: chance(0.6) ? String(random_int(10000000, 79999999)) : null,
		...name,
		fecha_nacimiento,
		fecha_aproximada,
		lugar_nacimiento: pick(PLACES),
		padre: random_full_name('m'),
		madre: random_full_name('f'),
	};
}

// Libro, folio y número en orden, como en un libro real: 4 partidas por folio y 40 por libro.
function register_for(index)
{
	return {
		libro: String(1 + Math.floor(index / 40)),
		folio: String(1 + Math.floor((index % 40) / 4)),
		numero: String(index + 1),
	};
}

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------

const statements = [];

// 1. Borrar todo, de las tablas hijas a las padres (D1 revisa las claves foráneas).
const TABLES_TO_EMPTY = ['cambios_persona', 'historial_campos', 'historial_partidas', 'solicitudes_cambio', 'bautismos', 'confirmaciones', 'matrimonios', 'sync_feed', 'sacramentos', 'personas', 'ministros', 'dispositivos', 'usuarios', 'parroquias'];
for (const table of TABLES_TO_EMPTY)
	statements.push(`DELETE FROM ${table};`);

statements.push(`DELETE FROM sqlite_sequence WHERE name IN (${TABLES_TO_EMPTY.map(sql_value).join(', ')});`);

// 2. Parroquias.
for (const parish of PARISHES)
	statements.push(`INSERT INTO parroquias (id, nombre, ubicacion, activa) VALUES (${parish.id}, ${sql_value(parish.nombre)}, ${sql_value(parish.ubicacion)}, 1);`);

// 3. Usuarios. Los id se fijan: adminG = 1, adminN = 1 + N (el principal de su parroquia), los
// ayudantes después, y al final adminNb (otro administrador de la parroquia, no principal).
const users = [{ id: 1, username: 'adminG', rol: 'admin_general', parroquia_id: null, principal: 1, nombre: 'Administrador', apellido_paterno: 'General', apellido_materno: '' }];
for (const parish of PARISHES)
{
	users.push({ id: 1 + parish.id, username: `admin${parish.id}`, rol: 'admin_parroquia', parroquia_id: parish.id, principal: 1, ...random_person_name('m') });
}

let helper_number = 0;
for (const parish of PARISHES)
{
	for (let index = 0; index < HELPERS_PER_PARISH; index++)
	{
		helper_number++;
		const name = random_person_name(chance(0.5) ? 'm' : 'f');
		users.push({ id: 1 + PARISHES.length + helper_number, username: `usuario${helper_number}`, rol: 'usuario', parroquia_id: parish.id, principal: 0, ...name });
	}
}

for (const parish of PARISHES)
{
	users.push({ id: 1 + PARISHES.length + helper_number + parish.id, username: `admin${parish.id}b`, rol: 'admin_parroquia', parroquia_id: parish.id, principal: 0, ...random_person_name('f') });
}

for (const user of users)
{
	// Los usuarios no usan "nombres" sino "nombre".
	const nombre = user.nombre ?? user.nombres;
	statements.push(
		`INSERT INTO usuarios (id, client_id, username, password_hash, rol, parroquia_id, activo, principal, nombre, apellido_paterno, apellido_materno)
		 VALUES (${user.id}, ${sql_value(seed_uuid(`demo-usuario-${user.username}`))}, ${sql_value(user.username)}, ${sql_value(await hash_password(PASSWORD))},
		         ${sql_value(user.rol)}, ${sql_value(user.parroquia_id)}, 1, ${user.principal}, ${sql_value(nombre)}, ${sql_value(user.apellido_paterno)}, ${sql_value(user.apellido_materno)});`,
	);
}

const admin_of = (parish) => users.find((user) => user.rol === 'admin_parroquia' && user.parroquia_id === parish.id && user.principal === 1);
const helpers_of = (parish) => users.filter((user) => user.rol === 'usuario' && user.parroquia_id === parish.id);

// Un evento del historial de la partida, con los datos que cambiaron.
function add_history(key, sacrament_client_id, user, event, fields = [], reason = null)
{
	const client_id = seed_uuid(key);
	statements.push(
		`INSERT INTO historial_partidas (client_id, sacramento_id, usuario_id, evento, motivo)
		 VALUES (${sql_value(client_id)}, ${sacrament_id(sacrament_client_id)}, ${user.id}, ${sql_value(event)}, ${sql_value(reason)});`,
	);

	for (const field of fields)
	{
		statements.push(
			`INSERT INTO historial_campos (historial_id, parte, campo, valor_anterior, valor_nuevo)
			 VALUES ((SELECT id FROM historial_partidas WHERE client_id = ${sql_value(client_id)}), ${sql_value(field.parte)}, ${sql_value(field.campo)},
			         ${sql_value(field.valor_anterior)}, ${sql_value(field.valor_nuevo)});`,
		);
	}
}

// Un error de digitación creíble: en la última palabra, la segunda y la tercera letra cambiadas de lugar
// ("Mamani" -> "Mmaani").
function with_swapped_letters(text)
{
	const words = text.split(' ');
	const last = words[words.length - 1];
	words[words.length - 1] = last[0] + last[2] + last[1] + last.slice(3);
	return words.join(' ');
}

// Lo que pidió un ayudante y espera a un administrador: una fila por dato, y su evento en el historial.
function insert_requests(key, sacrament_client_id, user, requests)
{
	requests.forEach((request, index) =>
	{
		statements.push(
			`INSERT INTO solicitudes_cambio (client_id, sacramento_id, usuario_id, parte, campo, tipo, valor_anterior, valor_nuevo)
			 VALUES (${sql_value(seed_uuid(`${key}-${index}`))}, ${sacrament_id(sacrament_client_id)}, ${user.id}, ${sql_value(request.parte)},
			         ${sql_value(request.campo)}, ${sql_value(request.tipo)}, ${sql_value(request.valor_anterior)}, ${sql_value(request.valor_nuevo)});`,
		);
	});
	add_history(`${key}-historial`, sacrament_client_id, user, 'cambio_pedido', requests);
}

// El sacramento común a las tres partidas, con su historial. Devuelve su client_id y su nota marginal.
function insert_sacrament(key, type, parish, minister_client_id, register, event_date)
{
	const client_id = seed_uuid(key);
	const is_annulled = chance(0.05);
	const notes = chance(0.15) ? 'Partida transcrita del libro original.' : null;

	statements.push(
		`INSERT INTO sacramentos (client_id, tipo, parroquia_id, ministro_id, libro, folio, numero, fecha_emision, fecha_evento, anotaciones,
		                          estado, anulado_por_usuario_id, anulado_en, motivo_anulacion)
		 VALUES (${sql_value(client_id)}, ${sql_value(type)}, ${parish.id}, ${minister_client_id ? minister_id(minister_client_id) : 'NULL'},
		         ${sql_value(register.libro)}, ${sql_value(register.folio)}, ${sql_value(register.numero)}, ${sql_value(event_date)}, ${sql_value(event_date)},
		         ${sql_value(notes)},
		         ${sql_value(is_annulled ? 'anulado' : 'vigente')}, ${is_annulled ? admin_of(parish).id : 'NULL'},
		         ${is_annulled ? "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')" : 'NULL'}, ${sql_value(is_annulled ? 'Partida duplicada por error.' : null)});`,
	);

	// La registró el administrador principal o uno de los ayudantes de la parroquia.
	const registrar = chance(0.5) ? admin_of(parish) : pick(helpers_of(parish));
	add_history(`${key}-registrada`, client_id, registrar, 'registrada');

	if (is_annulled)
		add_history(`${key}-anulada`, client_id, admin_of(parish), 'anulada', [], 'Partida duplicada por error.');

	return { client_id: client_id, notes: notes };
}

function insert_person(person, parish)
{
	statements.push(
		`INSERT INTO personas (client_id, parroquia_id, dni, nombres, apellido_paterno, apellido_materno, fecha_nacimiento, fecha_aproximada, lugar_nacimiento, padre, madre)
		 VALUES (${sql_value(person.client_id)}, ${parish.id}, ${sql_value(person.dni)}, ${sql_value(person.nombres)}, ${sql_value(person.apellido_paterno)},
		         ${sql_value(person.apellido_materno)}, ${sql_value(person.fecha_nacimiento)}, ${sql_value(person.fecha_aproximada)}, ${sql_value(person.lugar_nacimiento)},
		         ${sql_value(person.padre)}, ${sql_value(person.madre)});`,
	);
}

// Una corrección por nota marginal que cambia un apellido.
//   aprobada    la hizo el párroco: la persona ya tiene el valor nuevo, y el anterior se sigue buscando.
//   pendiente   la pidió un ayudante: la persona sigue igual y la partida espera la aprobación. Si la
//               partida no tenía nota marginal, el ayudante la escribió (se guarda directo); si ya
//               tenía, pide cambiarla junto con el apellido.
function insert_correction(key, person, sacrament, in_user, in_state)
{
	const field = 'apellido_paterno';
	const old_value = person[field];
	const new_value = pick(SURNAMES.filter((surname) => surname !== old_value));
	const change = { parte: 'persona', campo: field, valor_anterior: old_value, valor_nuevo: new_value };

	if (in_state === 'aprobado')
	{
		statements.push(
			`INSERT INTO cambios_persona (client_id, persona_id, sacramento_id, usuario_id, campo_cambio, valor_anterior, valor_nuevo, estado, revisado_por_usuario_id, revisado_en)
			 VALUES (${sql_value(seed_uuid(key))}, ${person_id(person.client_id)}, ${sacrament_id(sacrament.client_id)}, ${in_user.id},
			         ${sql_value(field)}, ${sql_value(old_value)}, ${sql_value(new_value)}, 'aprobado', ${in_user.id}, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));`,
		);
		statements.push(`UPDATE personas SET ${field} = ${sql_value(new_value)} WHERE client_id = ${sql_value(person.client_id)};`);
		add_history(`${key}-historial`, sacrament.client_id, in_user, 'correccion', [change]);
		return;
	}

	const note = 'Se corrige el apellido paterno según la partida de nacimiento presentada por la familia.';
	const requests = [{ ...change, tipo: 'nota_marginal' }];

	if (sacrament.notes === null)
	{
		statements.push(`UPDATE sacramentos SET anotaciones = ${sql_value(note)} WHERE client_id = ${sql_value(sacrament.client_id)};`);
		add_history(`${key}-nota`, sacrament.client_id, in_user, 'editada', [{ parte: 'sacramento', campo: 'anotaciones', valor_anterior: null, valor_nuevo: note }]);
	}
	else
	{
		requests.push({ parte: 'sacramento', campo: 'anotaciones', tipo: 'digitacion', valor_anterior: sacrament.notes, valor_nuevo: `${sacrament.notes} ${note}` });
	}

	insert_requests(key, sacrament.client_id, in_user, requests);
}

// 4. Ministros y partidas de cada parroquia.
for (const parish of PARISHES)
{
	const admin = admin_of(parish);
	const helpers = helpers_of(parish);

	const minister_ids = [];
	for (let index = 0; index < MINISTERS_PER_PARISH; index++)
	{
		const client_id = seed_uuid(`demo-ministro-${parish.id}-${index}`);
		const name = random_person_name('m');
		statements.push(
			`INSERT INTO ministros (client_id, titulo, nombre, apellido_paterno, apellido_materno, parroquia_id, activo)
			 VALUES (${sql_value(client_id)}, ${sql_value(pick(MINISTER_TITLES))}, ${sql_value(name.nombres)}, ${sql_value(name.apellido_paterno)},
			         ${sql_value(name.apellido_materno || pick(SURNAMES))}, ${parish.id}, 1);`,
		);
		minister_ids.push(client_id);
	}

	// Celebrante: siempre uno de la parroquia (es obligatorio).
	const random_minister = () => pick(minister_ids);

	// Las partidas que reciben una corrección por nota marginal: dos del párroco (aprobadas) y una de
	// un ayudante (pendiente). Otra partida tiene un arreglo de digitación pedido por el otro ayudante.
	const corrected = [
		{ type: 'bautismo', index: 3, user: admin, state: 'aprobado' },
		{ type: 'confirmacion', index: 5, user: admin, state: 'aprobado' },
		{ type: 'bautismo', index: 10, user: helpers[0], state: 'pendiente' },
	];
	const typo_request = { type: 'confirmacion', index: 8, user: helpers[1] };
	const correction_for = (type, index) => corrected.find((item) => item.type === type && item.index === index);

	for (const type of ['bautismo', 'confirmacion'])
	{
		const detail_table = type === 'bautismo' ? 'bautismos' : 'confirmaciones';
		for (let index = 0; index < RECORDS_PER_PARISH[type]; index++)
		{
			const key = `demo-${type}-${parish.id}-${index}`;
			const event_date = random_event_date();
			const person = type === 'bautismo'
				? random_person(`${key}-persona`, chance(0.5) ? 'm' : 'f', event_date, 0, chance(0.85) ? 2 : 30)
				: random_person(`${key}-persona`, chance(0.5) ? 'm' : 'f', event_date, 12, chance(0.8) ? 17 : 45);

			insert_person(person, parish);
			const sacrament = insert_sacrament(key, type, parish, random_minister(), register_for(index), event_date);
			statements.push(
				`INSERT INTO ${detail_table} (sacramento_id, persona_id, padrino_1, padrino_2)
				 VALUES (${sacrament_id(sacrament.client_id)}, ${person_id(person.client_id)}, ${sql_value(chance(0.85) ? random_full_name('m') : null)},
				         ${sql_value(chance(0.9) ? random_full_name('f') : null)});`,
			);

			const correction = correction_for(type, index);
			if (correction)
				insert_correction(`${key}-nota`, person, sacrament, correction.user, correction.state);

			// El padre quedó mal digitado (dos letras cambiadas de lugar) y el ayudante pide arreglarlo.
			if (typo_request.type === type && typo_request.index === index)
			{
				const typo = with_swapped_letters(person.padre);
				statements.push(`UPDATE personas SET padre = ${sql_value(typo)} WHERE client_id = ${sql_value(person.client_id)};`);
				insert_requests(`${key}-pedido`, sacrament.client_id, typo_request.user, [
					{ parte: 'persona', campo: 'padre', tipo: 'digitacion', valor_anterior: typo, valor_nuevo: person.padre },
				]);
			}

		}
	}

	// Matrimonios: dos personas nuevas, con datos de su bautismo y testigos.
	for (let index = 0; index < RECORDS_PER_PARISH.matrimonio; index++)
	{
		const key = `demo-matrimonio-${parish.id}-${index}`;
		const event_date = random_event_date();
		const husband = random_person(`${key}-esposo`, 'm', event_date, 20, 45);
		const wife = random_person(`${key}-esposa`, 'f', event_date, 20, 45);

		insert_person(husband, parish);
		insert_person(wife, parish);
		const { client_id } = insert_sacrament(key, 'matrimonio', parish, random_minister(), register_for(index), event_date);

		const baptism_date = (person) =>
		{
			if (!chance(0.7))
				return null;

			const year = Number((person.fecha_nacimiento ?? event_date).slice(0, 4));
			return random_date(year, true);
		};
		const witness = () => (chance(0.8) ? random_full_name(chance(0.5) ? 'm' : 'f') : null);

		statements.push(
			`INSERT INTO matrimonios (sacramento_id, conyuge_1_id, conyuge_2_id, lugar, testigo_1, testigo_2, testigo_3, testigo_4,
			                          conyuge_1_bautismo_parroquia, conyuge_1_bautismo_fecha, conyuge_2_bautismo_parroquia, conyuge_2_bautismo_fecha)
			 VALUES (${sacrament_id(client_id)}, ${person_id(husband.client_id)}, ${person_id(wife.client_id)},
			         ${sql_value(chance(0.7) ? `Templo de ${parish.nombre}` : null)}, ${sql_value(witness())}, ${sql_value(witness())},
			         ${sql_value(chance(0.4) ? witness() : null)}, ${sql_value(chance(0.3) ? witness() : null)},
			         ${sql_value(chance(0.7) ? pick(PARISHES).nombre : null)}, ${sql_value(baptism_date(husband))},
			         ${sql_value(chance(0.7) ? pick(PARISHES).nombre : null)}, ${sql_value(baptism_date(wife))});`,
		);
	}
}

// ---------------------------------------------------------------------------
// Ejecutar en la base local
// ---------------------------------------------------------------------------

const directory = mkdtempSync(path.join(tmpdir(), 'prelatura-demo-'));
const file = path.join(directory, 'demo.sql');
writeFileSync(file, statements.join('\n') + '\n');

const persist = options['persist-to'] ? `--persist-to "${options['persist-to']}"` : '';
const result = spawnSync(`npx wrangler d1 execute prelatura-db --local ${persist} --yes --file="${file}"`, {
	shell: true,
	encoding: 'utf8',
	input: '',
});
rmSync(directory, { recursive: true, force: true });

if (result.status !== 0)
{
	console.error(result.stdout, result.stderr);
	console.error('No se pudieron cargar los datos de demostración.');
	process.exit(1);
}

console.log(`Base local vaciada y cargada con los datos de demostración (${statements.length} sentencias).`);
console.log(`Cuentas: adminG, admin1..admin${PARISHES.length} (principales), admin1b..admin${PARISHES.length}b, usuario1..usuario${helper_number}. Contraseña: ${PASSWORD}.`);
console.log('Borre la base local de la app (prelatura-local.db y .key) para que baje los datos nuevos.');
