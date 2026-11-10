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

// ---------------------------------------------------------------------------
// Números al azar, pero siempre los mismos: así cada corrida genera exactamente los mismos datos.
// ---------------------------------------------------------------------------

let random_state = 20261105;

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

// Un client_id con forma de UUID que depende solo del texto: "seed-bautismo-1-12" da siempre el mismo.
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

const parish_id = (name) => `(SELECT id FROM parroquias WHERE nombre = ${sql_value(name)})`;
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
const PLACES = ['Juli', 'Puno', 'Pomata', 'Ilave', 'Yunguyo', 'Desaguadero', 'Zepita', 'Kelluyo', 'Pilcuyo', 'Arequipa', 'Lima', 'Tacna'];
const MINISTER_TITLES = ['Pbro.', 'Pbro.', 'Pbro.', 'Mons.', 'Fr.', 'Diác.'];

// Las parroquias del esquema de desarrollo (schema.sql) más unas nuevas. "activa: 0" es una deshabilitada.
const NEW_PARISHES = [
	{ nombre: 'San Pedro Mártir', ubicacion: 'Juli, Chucuito' },
	{ nombre: 'Santa Cruz de Jerusalén', ubicacion: 'Juli, Chucuito' },
	{ nombre: 'Nuestra Señora de la Asunción', ubicacion: 'Pomata' },
	{ nombre: 'San Juan Bautista', ubicacion: 'Ilave' },
	{ nombre: 'Santiago Apóstol', ubicacion: 'Pilcuyo' },
	{ nombre: 'Virgen de la Candelaria', ubicacion: 'Yunguyo' },
	{ nombre: 'San Miguel Arcángel', ubicacion: 'Zepita', activa: 0 },
];

// Cuántas partidas de cada sacramento lleva cada parroquia. Con 20 por página, Parroquia 1 tiene
// varias páginas en las tres pantallas.
const RECORDS_PER_PARISH = [
	{ parroquia: 'Parroquia 1', bautismo: 72, confirmacion: 46, matrimonio: 31, ministros: 23, usuarios: 9 },
	{ parroquia: 'Parroquia 2', bautismo: 24, confirmacion: 12, matrimonio: 9, ministros: 6, usuarios: 5 },
	{ parroquia: 'Parroquia 3', bautismo: 11, confirmacion: 5, matrimonio: 4, ministros: 3, usuarios: 3 },
	{ parroquia: 'San Pedro Mártir', bautismo: 8, confirmacion: 4, matrimonio: 3, ministros: 2, usuarios: 2 },
	{ parroquia: 'Nuestra Señora de la Asunción', bautismo: 6, confirmacion: 3, matrimonio: 2, ministros: 2, usuarios: 2 },
];

const ADMIN_USER_ID = 1;    // admin, del esquema de desarrollo: anula las partidas anuladas.
const PARISH_USER_ID = 2;   // parroco1: escribe las notas marginales.

// La contraseña de parroco1 (parroco123): así se entra con cualquier cuenta nueva.
const PARISH_PASSWORD_HASH = '(SELECT password_hash FROM usuarios WHERE username = \'parroco1\')';

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
		apellido_materno: chance(0.95) ? pick(SURNAMES) : '',
	};
}

function random_full_name(sex)
{
	const name = random_person_name(sex);
	return `${name.nombres} ${name.apellido_paterno} ${name.apellido_materno}`.trim();
}

// Una fecha AAAA-MM-DD válida. A veces sale incompleta (solo año, o año y mes), como en los libros
// viejos que no traen el día.
function random_date(from_year, to_year, allow_partial)
{
	const year = random_int(from_year, to_year);
	const month = random_int(1, 12);
	const day = random_int(1, new Date(year, month, 0).getDate());

	if (allow_partial && chance(0.06))
		return String(year);

	if (allow_partial && chance(0.1))
		return `${year}-${two_digits(month)}`;

	return `${year}-${two_digits(month)}-${two_digits(day)}`;
}

// Una fecha completa que no pase de hoy: las del año en curso caen antes de hoy.
function clamp_to_today(date)
{
	const today = new Date();
	const today_text = `${today.getFullYear()}-${two_digits(today.getMonth() + 1)}-${two_digits(today.getDate())}`;
	return date > today_text ? today_text : date;
}

// Más partidas en los años recientes, para que la tendencia de estadísticas se vea con forma.
function random_event_year()
{
	const current_year = new Date().getFullYear();
	if (chance(0.55))
		return random_int(current_year - 3, current_year);

	return random_int(1985, current_year - 4);
}

// Una fecha completa de celebración, nunca después de hoy.
function random_event_date()
{
	const year = random_event_year();
	return clamp_to_today(random_date(year, year, false));
}

function random_dni()
{
	return chance(0.6) ? String(random_int(10000000, 79999999)) : null;
}

// Una persona: fecha de nacimiento, solo una fecha aproximada, o ninguna de las dos.
function random_person(key, sex, event_date, typical_age)
{
	const name = random_person_name(sex);
	const event_year = Number(event_date.slice(0, 4));
	const birth_year = Math.max(1900, event_year - typical_age());

	let fecha_nacimiento = null;
	let fecha_aproximada = null;
	const roll = next_random();
	if (roll < 0.75)
		fecha_nacimiento = clamp_to_today(random_date(birth_year, birth_year, true));
	else if (roll < 0.9)
		fecha_aproximada = `${Math.max(0, event_year - birth_year)} años`;

	return {
		client_id: seed_uuid(key),
		dni: random_dni(),
		...name,
		fecha_nacimiento,
		fecha_aproximada,
		lugar_nacimiento: chance(0.8) ? pick(PLACES) : null,
		padre: chance(0.85) ? random_full_name('m') : null,
		madre: chance(0.9) ? random_full_name('f') : null,
	};
}

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------

const statements = [];

function insert_person(person, parish_name)
{
	statements.push(
		`INSERT OR IGNORE INTO personas (client_id, parroquia_id, dni, nombres, apellido_paterno, apellido_materno, fecha_nacimiento, fecha_aproximada, lugar_nacimiento, padre, madre)
		 VALUES (${sql_value(person.client_id)}, ${parish_id(parish_name)}, ${sql_value(person.dni)}, ${sql_value(person.nombres)}, ${sql_value(person.apellido_paterno)},
		         ${sql_value(person.apellido_materno)}, ${sql_value(person.fecha_nacimiento)}, ${sql_value(person.fecha_aproximada)}, ${sql_value(person.lugar_nacimiento)},
		         ${sql_value(person.padre)}, ${sql_value(person.madre)});`,
	);
}

// El sacramento común a las tres partidas. Devuelve su client_id.
function insert_sacrament(key, type, parish_name, minister_client_id, register, event_date)
{
	const client_id = seed_uuid(key);
	const is_annulled = chance(0.05);

	// El registro en el libro suele ser el mismo día o unos días después; si la fecha de la
	// celebración está incompleta, se usa el primer día que cubre.
	const register_date = clamp_to_today(event_date.length === 10 ? event_date : `${event_date}-01-01`.slice(0, 10));

	statements.push(
		`INSERT OR IGNORE INTO sacramentos (client_id, tipo, parroquia_id, ministro_id, libro, folio, numero, fecha_emision, fecha_evento, anotaciones,
		                                    estado, anulado_por_usuario_id, anulado_en, motivo_anulacion)
		 VALUES (${sql_value(client_id)}, ${sql_value(type)}, ${parish_id(parish_name)}, ${minister_client_id ? minister_id(minister_client_id) : 'NULL'},
		         ${sql_value(register.libro)}, ${sql_value(register.folio)}, ${sql_value(register.numero)}, ${sql_value(register_date)}, ${sql_value(event_date)},
		         ${sql_value(chance(0.15) ? 'Partida transcrita del libro original.' : null)},
		         ${sql_value(is_annulled ? 'anulado' : 'vigente')}, ${is_annulled ? ADMIN_USER_ID : 'NULL'},
		         ${is_annulled ? "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')" : 'NULL'}, ${sql_value(is_annulled ? 'Partida duplicada por error.' : null)});`,
	);

	return client_id;
}

// Una nota marginal: corrige un dato de la persona y deja el valor anterior.
function insert_correction(key, person, sacrament_client_id)
{
	const field = pick(['nombres', 'apellido_paterno', 'apellido_materno']);
	const old_value = person[field];
	const new_value = field === 'nombres' ? `${old_value} ${pick(FEMALE_NAMES.concat(MALE_NAMES))}` : pick(SURNAMES);
	if (!old_value || old_value === new_value)
		return;

	statements.push(
		`INSERT OR IGNORE INTO cambios_persona (client_id, persona_id, sacramento_id, usuario_id, campo_cambio, valor_anterior, valor_nuevo)
		 VALUES (${sql_value(seed_uuid(key))}, ${person_id(person.client_id)}, ${sacrament_id(sacrament_client_id)}, ${PARISH_USER_ID},
		         ${sql_value(field)}, ${sql_value(old_value)}, ${sql_value(new_value)});`,
	);
	// La persona queda con el valor nuevo, como hace la app al guardar la nota.
	statements.push(`UPDATE personas SET ${field} = ${sql_value(new_value)} WHERE client_id = ${sql_value(person.client_id)} AND ${field} = ${sql_value(old_value)};`);
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

// --- Parroquias ---
for (const parish of NEW_PARISHES)
{
	statements.push(
		`INSERT OR IGNORE INTO parroquias (nombre, ubicacion, activa) VALUES (${sql_value(parish.nombre)}, ${sql_value(parish.ubicacion)}, ${parish.activa ?? 1});`,
	);
}

// --- Ministros, usuarios y partidas de cada parroquia ---
for (const plan of RECORDS_PER_PARISH)
{
	const parish_key = plan.parroquia.replaceAll(' ', '-').toLowerCase();

	const minister_ids = [];
	for (let index = 0; index < plan.ministros; index++)
	{
		const client_id = seed_uuid(`seed-ministro-${parish_key}-${index}`);
		const name = random_person_name(chance(0.9) ? 'm' : 'f');
		const is_active = chance(0.85) ? 1 : 0;
		statements.push(
			`INSERT OR IGNORE INTO ministros (client_id, titulo, nombre, apellido_paterno, apellido_materno, parroquia_id, activo)
			 VALUES (${sql_value(client_id)}, ${sql_value(pick(MINISTER_TITLES))}, ${sql_value(name.nombres)}, ${sql_value(name.apellido_paterno)},
			         ${sql_value(name.apellido_materno || pick(SURNAMES))}, ${parish_id(plan.parroquia)}, ${is_active});`,
		);
		if (is_active)
			minister_ids.push(client_id);
	}

	for (let index = 0; index < plan.usuarios; index++)
	{
		const name = random_person_name(chance(0.5) ? 'm' : 'f');
		const username = `${name.nombres.split(' ')[0]}.${name.apellido_paterno}`
			.normalize('NFD')
			.replace(/[̀-ͯ]/g, '')
			.toLowerCase() + `.${parish_key.slice(-1)}${index}`;
		statements.push(
			`INSERT OR IGNORE INTO usuarios (client_id, username, password_hash, rol, parroquia_id, nombre, apellido_paterno, apellido_materno, activo)
			 VALUES (${sql_value(seed_uuid(`seed-usuario-${parish_key}-${index}`))}, ${sql_value(username)}, ${PARISH_PASSWORD_HASH}, ${index === 0 ? "'admin_parroquia'" : "'usuario'"}, ${parish_id(plan.parroquia)}, ${sql_value(name.nombres)},
			         ${sql_value(name.apellido_paterno)}, ${sql_value(name.apellido_materno)}, ${chance(0.85) ? 1 : 0});`,
		);
	}

	// Celebrante: casi siempre uno de la parroquia; a veces la partida no lo registra.
	const random_minister = () => (minister_ids.length > 0 && chance(0.9) ? pick(minister_ids) : null);

	// Bautismos: casi todos de bebés o niños.
	for (let index = 0; index < plan.bautismo; index++)
	{
		const key = `seed-bautismo-${parish_key}-${index}`;
		const event_date = random_event_date();
		const event = chance(0.12) ? event_date.slice(0, chance(0.5) ? 4 : 7) : event_date;
		const person = random_person(`${key}-persona`, chance(0.5) ? 'm' : 'f', event_date, () => (chance(0.85) ? random_int(0, 2) : random_int(3, 30)));

		insert_person(person, plan.parroquia);
		const client_id = insert_sacrament(key, 'bautismo', plan.parroquia, random_minister(), register_for(index), event);
		statements.push(
			`INSERT OR IGNORE INTO bautismos (sacramento_id, persona_id, padrino_1, padrino_2)
			 VALUES (${sacrament_id(client_id)}, ${person_id(person.client_id)}, ${sql_value(chance(0.85) ? random_full_name('m') : null)},
			         ${sql_value(chance(0.9) ? random_full_name('f') : null)});`,
		);
		if (chance(0.08))
			insert_correction(`${key}-nota`, person, client_id);
	}

	// Confirmaciones: adolescentes casi siempre.
	for (let index = 0; index < plan.confirmacion; index++)
	{
		const key = `seed-confirmacion-${parish_key}-${index}`;
		const event_date = random_event_date();
		const event = chance(0.1) ? event_date.slice(0, 7) : event_date;
		const person = random_person(`${key}-persona`, chance(0.5) ? 'm' : 'f', event_date, () => (chance(0.8) ? random_int(12, 17) : random_int(18, 45)));

		insert_person(person, plan.parroquia);
		const client_id = insert_sacrament(key, 'confirmacion', plan.parroquia, random_minister(), register_for(index), event);
		statements.push(
			`INSERT OR IGNORE INTO confirmaciones (sacramento_id, persona_id, padrino_1, padrino_2)
			 VALUES (${sacrament_id(client_id)}, ${person_id(person.client_id)}, ${sql_value(chance(0.6) ? random_full_name('m') : null)},
			         ${sql_value(chance(0.6) ? random_full_name('f') : null)});`,
		);
		if (chance(0.06))
			insert_correction(`${key}-nota`, person, client_id);
	}

	// Matrimonios: dos personas nuevas, con datos de su bautismo y testigos.
	for (let index = 0; index < plan.matrimonio; index++)
	{
		const key = `seed-matrimonio-${parish_key}-${index}`;
		const event_date = random_event_date();
		const event = chance(0.08) ? event_date.slice(0, 7) : event_date;
		const adult_age = () => random_int(20, 45);
		const husband = random_person(`${key}-esposo`, 'm', event_date, adult_age);
		const wife = random_person(`${key}-esposa`, 'f', event_date, adult_age);

		insert_person(husband, plan.parroquia);
		insert_person(wife, plan.parroquia);
		const client_id = insert_sacrament(key, 'matrimonio', plan.parroquia, random_minister(), register_for(index), event);

		const baptism_date = (person) =>
		{
			if (!chance(0.7))
				return null;
			const year = Number((person.fecha_nacimiento ?? event_date).slice(0, 4));
			return clamp_to_today(random_date(year, year + 1, true));
		};
		const witness = () => (chance(0.8) ? random_full_name(chance(0.5) ? 'm' : 'f') : null);

		statements.push(
			`INSERT OR IGNORE INTO matrimonios (sacramento_id, conyuge_1_id, conyuge_2_id, lugar, testigo_1, testigo_2, testigo_3, testigo_4,
			                                    conyuge_1_bautismo_parroquia, conyuge_1_bautismo_fecha, conyuge_2_bautismo_parroquia, conyuge_2_bautismo_fecha)
			 VALUES (${sacrament_id(client_id)}, ${person_id(husband.client_id)}, ${person_id(wife.client_id)},
			         ${sql_value(chance(0.7) ? `Templo de ${plan.parroquia}` : null)}, ${sql_value(witness())}, ${sql_value(witness())},
			         ${sql_value(chance(0.4) ? witness() : null)}, ${sql_value(chance(0.3) ? witness() : null)},
			         ${sql_value(chance(0.7) ? pick(RECORDS_PER_PARISH).parroquia : null)}, ${sql_value(baptism_date(husband))},
			         ${sql_value(chance(0.7) ? pick(RECORDS_PER_PARISH).parroquia : null)}, ${sql_value(baptism_date(wife))});`,
		);
		if (chance(0.06))
			insert_correction(`${key}-nota`, wife, client_id);
	}
}

// --- Cuentas en varias parroquias (migración 0019) ---
// parroco1 también trabaja en Parroquia 2 (administrador común) y es el principal de Parroquia 3,
// que hasta aquí no tenía administrador principal.
statements.push(
	`INSERT OR IGNORE INTO usuario_parroquias (usuario_id, parroquia_id, rol, principal)
	 SELECT u.id, p.id, 'admin_parroquia', 0 FROM usuarios u, parroquias p WHERE u.username = 'parroco1' AND p.nombre = 'Parroquia 2';`,
	`INSERT OR IGNORE INTO usuario_parroquias (usuario_id, parroquia_id, rol, principal)
	 SELECT u.id, p.id, 'admin_parroquia',
	        CASE WHEN EXISTS (SELECT 1 FROM membresias m WHERE m.parroquia_id = p.id AND m.principal = 1) THEN 0 ELSE 1 END
	 FROM usuarios u, parroquias p WHERE u.username = 'parroco1' AND p.nombre = 'Parroquia 3';`,
);

// ---------------------------------------------------------------------------
// Ejecutar en la base local
// ---------------------------------------------------------------------------

const directory = mkdtempSync(path.join(tmpdir(), 'prelatura-seed-'));
const file = path.join(directory, 'seed.sql');
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
	console.error('No se pudieron cargar los datos de prueba.');
	process.exit(1);
}

console.log(`Datos de prueba cargados en la base local (${statements.length} sentencias).`);
console.log('Las cuentas nuevas entran con la contraseña de parroco1: parroco123.');
console.log('parroco1 también trabaja en Parroquia 2 y Parroquia 3 (en la 3 es el principal si no había otro).');
console.log('Las PCs reciben las partidas nuevas en su próxima sincronización.');
