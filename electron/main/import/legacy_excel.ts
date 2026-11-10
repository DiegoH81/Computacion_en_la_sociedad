import type { SacramentType } from '../../../shared/sync';

// Excel columns
export const COLUMNS =
{
	codigo_parroquia: 0,
	tipo_libro: 1,
	num_libro: 2,
	folio: 3,
	numero_registro: 4,
	nombres: 6,
	apellido_paterno: 7,
	apellido_materno: 8,
	fecha_nacimiento: 9,
	fecha_nacimiento_aprox: 10,
	lugar_nacimiento: 11,
	fecha_sacramento: 12,
	fecha_sacramento_aprox: 13,
	lugar_matrimonio: 14,
	dni: 15,
	padre: 16,
	madre: 17,
	fecha_bautizo_novio: 20,
	fecha_bautizo_novio_aprox: 21,
	parroquia_bautizo_novio: 22,
	celebrante: 23,
	anotacion_marginal: 24,
	padrino: 25,
	madrina: 26,
	novia_nombres: 27,
	novia_apellido_paterno: 28,
	novia_apellido_materno: 29,
	novia_fecha_nacimiento: 30,
	novia_fecha_nacimiento_aprox: 31,
	novia_lugar_nacimiento: 32,
	novia_padre: 33,
	novia_madre: 34,
	novia_dni: 35,
	fecha_bautizo_novia: 36,
	fecha_bautizo_novia_aprox: 37,
	parroquia_bautizo_novia: 38,
	testigo_3: 39,
	testigo_4: 40,
	fecha_ingreso: 42,
} as const;

export const RECORDS_SHEET = 'feligres';
export const BOOKS_SHEET = 'parroquialibros';

// Temp header
export const RECORDS_HEADER: readonly (string | null)[] = [
	'COD PARROQUIA', 'TIPO LIBRO', 'NUM LIBRO', 'FOLIO', 'NUMERO REGISTRO', null,
	'NOMBRES', 'APELLIDO PATERNO', 'APELLIDO MATERNO', 'FECHA NACIMIENTO', 'FECHA NAC APROX', 'LUGAR NACIMIENTO',
	'FECHA DE SACRAMENTO', 'FECHA SACRAMENTO APROX', 'LUGAR DE MATRIMONIO', 'DNI', 'PADRE', 'MADRE', null, null,
	'FECHA DE BAUTIZO NOVIO', 'FECHA DE BAUTIZO NOVIO APROX', 'PARROQUIA DE BAUTIZO', 'CELEBRANTE', 'ANOTACION MARGINAL',
	'PADRINO (TESTIGO 1)', 'MADRINA (TESTIGO 2)', 'NOMBRES DE LA NOVIA', 'APELLIDO PATERNO NOVIA', 'APELLIDO MATERNO NOVIA',
	'FECHA NACIMIENTO NOVIA', 'FECHA NACIMIENTO NOVIA APROX', 'LUGAR DE NACIMIENTO NOVIA', 'PAPA DE LA NOVIA', 'MAMA DE LA NOVIA',
	'DNI NOVIA', 'FECHA BAUTIZO NOVIA', 'FECHA BAUTIZO NOVIA APROX', 'PARROQUIA DE BAUTIZO NOVIA', 'TESTIGO 3', 'TESTIGO 4', null,
	'FECHA INGRESO DATOS', 'ULTIMA MODIFICACION', 'ULTIMA IMPRESION',
];

export const BOOKS_HEADER: readonly (string | null)[] = ['COD PARROQUIA', 'TIPO DE LIBRO', 'NUM LIBRO', 'NOMBRE DE LIBRO', 'RANGO DE AÑOS DEL LIBRO'];

const BOOK_COLUMNS = { codigo_parroquia: 0, tipo_libro: 1, num_libro: 2, nombre_libro: 3 } as const;



// Error
export class FormatError extends Error {}

const TYPES: Record<string, SacramentType> = { B: 'bautismo', C: 'confirmacion', M: 'matrimonio' };

export interface ImportedPerson
{
	dni: string | null;
	nombres: string;
	apellido_paterno: string;
	apellido_materno: string;
	fecha_nacimiento: string | null;
	fecha_aproximada: string | null;
	lugar_nacimiento: string | null;
	padre: string | null;
	madre: string | null;
}

export interface ImportedMinister
{
	titulo: string | null;
	nombre: string;
	apellido_paterno: string;
	apellido_materno: string;
}

export interface ImportedRecord
{
	fila: number;
	codigo_parroquia: string | null;
	tipo: SacramentType;
	libro: string;
	folio: string;
	numero: string;
	fecha_emision: string | null;
	fecha_evento: string | null;
	anotaciones: string | null;
	celebrante: ImportedMinister | null;
	personas: ImportedPerson[];
	detalle: Record<string, string | null>;
}

export interface RowError
{
	fila: number;
	motivo: string;
}

export type BookNames = Map<string, string>;

function book_key(type_letter: string, number: string): string
{
	return `${type_letter.trim().toUpperCase()}|${number.trim()}`;
}


export function clean_cell(value: unknown): string | null
{
	if (value === null || value === undefined)
		return null;

	const text = String(value).trim();
	if (text === '' || /^-+$/.test(text))
		return null;

	return text;
}


function pad(number: number): string
{
	return String(number).padStart(2, '0');
}

export function date_cell(value: unknown): string | null
{
	if (value instanceof Date && !Number.isNaN(value.getTime()))
		return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;

	const text = clean_cell(value);
	if (!text)
		return null;

	const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
	if (iso)
		return `${iso[1]}-${iso[2]}-${iso[3]}`;

	const local = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
	if (local)
		return `${local[3]}-${pad(Number(local[2]))}-${pad(Number(local[1]))}`;

	return null;
}

function date_or_text(value: unknown): { date: string | null; text: string | null }
{
	const date = date_cell(value);
	if (date)
		return { date: date, text: null };

	return { date: null, text: clean_cell(value) };
}

const TITLES_WITHOUT_DOT = ['PBRO', 'P', 'RP', 'MONS', 'FR', 'FRAY', 'HNO', 'HNA', 'PADRE', 'DIAC', 'OBISPO'];

function is_title(word: string): boolean
{
	if (/\.$/.test(word))
		return true;

	return TITLES_WITHOUT_DOT.includes(word.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase());
}


export function split_minister(value: unknown): ImportedMinister | null
{
	const text = clean_cell(value);
	if (!text)
		return null;

	const words = text.split(/\s+/);
	let title: string | null = null;

	if (words.length > 1 && is_title(words[0]))
		title = words.shift() as string;

	if (words.length === 1)
		return { titulo: title, nombre: words[0], apellido_paterno: '', apellido_materno: '' };

	if (words.length === 2)
		return { titulo: title, nombre: words[0], apellido_paterno: words[1], apellido_materno: '' };

	return {
		titulo: title,
		nombre: words.slice(0, -2).join(' '),
		apellido_paterno: words[words.length - 2],
		apellido_materno: words[words.length - 1],
	};
}

export function is_header(row: unknown[]): boolean
{
	const code = row[COLUMNS.codigo_parroquia];
	return typeof code === 'string' && !/^\d+$/.test(code.trim());
}

function header_text(value: unknown): string
{
	return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
}

function data_rows(rows: unknown[][], sheet: string, header: readonly (string | null)[]): { row: unknown[]; fila: number }[]
{
	if (rows.length === 0)
		throw new FormatError(`La hoja "${sheet}" está vacía.`);

	const result: { row: unknown[]; fila: number }[] = [];
	rows.forEach((row, index) =>
	{
		if (row.length !== header.length)
			throw new FormatError(`La hoja "${sheet}" debe tener ${header.length} columnas y tiene ${row.length}. El archivo no es el exportado por el sistema anterior.`);

		if (index === 0 && is_header(row))
		{
			header.forEach((name, column) =>
			{
				if (header_text(row[column]) !== header_text(name))
					throw new FormatError(`El encabezado de la hoja "${sheet}" no es el del sistema anterior: la columna ${column + 1} dice "${row[column] ?? ''}" y debería decir "${name ?? ''}".`);
			});
			return;
		}

		if (row.every((cell) => clean_cell(cell) === null))
			return;

		result.push({ row: row, fila: index + 1 });
	});

	return result;
}

function check_parish_code(row: unknown[], column: number, sheet: string, file_row: number, expected: string | null): string
{
	const code = clean_cell(row[column]);
	if (!code || !/^\d+$/.test(code))
		throw new FormatError(`La fila ${file_row} de la hoja "${sheet}" no tiene un código de parroquia válido.`);

	if (expected !== null && code !== expected)
		throw new FormatError(`El archivo trae partidas de más de una parroquia (códigos ${expected} y ${code}). Debe ser el de una sola parroquia.`);

	return code;
}

function check_type_letter(row: unknown[], column: number, sheet: string, file_row: number): string
{
	const letter = String(row[column] ?? '').trim().toUpperCase();
	if (!TYPES[letter])
		throw new FormatError(`En la fila ${file_row} de la hoja "${sheet}" el tipo de libro no es B, C ni M: las columnas no son las del sistema anterior.`);

	return letter;
}

export function read_books(rows: unknown[][]): { codigo_parroquia: string | null; libros: BookNames }
{
	const books: BookNames = new Map();
	let code: string | null = null;

	for (const { row, fila } of data_rows(rows, BOOKS_SHEET, BOOKS_HEADER))
	{
		code = check_parish_code(row, BOOK_COLUMNS.codigo_parroquia, BOOKS_SHEET, fila, code);
		const letter = check_type_letter(row, BOOK_COLUMNS.tipo_libro, BOOKS_SHEET, fila);

		const number = clean_cell(row[BOOK_COLUMNS.num_libro]);
		if (!number)
			throw new FormatError(`La fila ${fila} de la hoja "${BOOKS_SHEET}" no tiene el número del libro.`);

		books.set(book_key(letter, number), clean_cell(row[BOOK_COLUMNS.nombre_libro]) ?? number);
	}

	return { codigo_parroquia: code, libros: books };
}


function read_person(row: unknown[], columns: { dni: number; nombres: number; apellido_paterno: number; apellido_materno: number; fecha_nacimiento: number; fecha_aproximada: number; lugar_nacimiento: number; padre: number; madre: number }): ImportedPerson
{
	const birth = date_or_text(row[columns.fecha_nacimiento]);
	const approximate = clean_cell(row[columns.fecha_aproximada]);

	return {
		dni: clean_cell(row[columns.dni]),
		nombres: clean_cell(row[columns.nombres]) ?? '',
		apellido_paterno: clean_cell(row[columns.apellido_paterno]) ?? '',
		apellido_materno: clean_cell(row[columns.apellido_materno]) ?? '',
		fecha_nacimiento: birth.date,
		fecha_aproximada: approximate ?? birth.text,
		lugar_nacimiento: clean_cell(row[columns.lugar_nacimiento]),
		padre: clean_cell(row[columns.padre]),
		madre: clean_cell(row[columns.madre]),
	};
}

const GROOM = {
	dni: COLUMNS.dni,
	nombres: COLUMNS.nombres,
	apellido_paterno: COLUMNS.apellido_paterno,
	apellido_materno: COLUMNS.apellido_materno,
	fecha_nacimiento: COLUMNS.fecha_nacimiento,
	fecha_aproximada: COLUMNS.fecha_nacimiento_aprox,
	lugar_nacimiento: COLUMNS.lugar_nacimiento,
	padre: COLUMNS.padre,
	madre: COLUMNS.madre,
};

const BRIDE = {
	dni: COLUMNS.novia_dni,
	nombres: COLUMNS.novia_nombres,
	apellido_paterno: COLUMNS.novia_apellido_paterno,
	apellido_materno: COLUMNS.novia_apellido_materno,
	fecha_nacimiento: COLUMNS.novia_fecha_nacimiento,
	fecha_aproximada: COLUMNS.novia_fecha_nacimiento_aprox,
	lugar_nacimiento: COLUMNS.novia_lugar_nacimiento,
	padre: COLUMNS.novia_padre,
	madre: COLUMNS.novia_madre,
};

function notes_of(row: unknown[], extra: string[]): string | null
{
	const notes: string[] = [];

	const marginal = clean_cell(row[COLUMNS.anotacion_marginal]);
	if (marginal && marginal.toUpperCase() !== 'NINGUNA')
		notes.push(marginal);

	notes.push(...extra);

	if (notes.length === 0)
		return null;

	return notes.join('\n');
}

export function read_row(row: unknown[], file_row: number, books: BookNames): ImportedRecord | RowError
{
	const type_letter = String(row[COLUMNS.tipo_libro] ?? '').trim().toUpperCase();
	const type = TYPES[type_letter];
	if (!type)
		return { fila: file_row, motivo: 'El tipo de libro no es B, C ni M.' };

	const book = clean_cell(row[COLUMNS.num_libro]);
	const page = clean_cell(row[COLUMNS.folio]);
	const number = clean_cell(row[COLUMNS.numero_registro]);
	if (!book || !page || !number)
		return { fila: file_row, motivo: 'Falta el libro, el folio o el número de registro.' };

	const book_name = books.get(book_key(type_letter, book));
	if (!book_name)
		return { fila: file_row, motivo: `El libro ${type_letter} ${book} no está en la hoja "${BOOKS_SHEET}".` };

	const groom = read_person(row, GROOM);
	if (!groom.nombres)
		return { fila: file_row, motivo: 'Falta el nombre.' };

	const extra: string[] = [];
	const event = date_or_text(row[COLUMNS.fecha_sacramento]);
	const event_approximate = clean_cell(row[COLUMNS.fecha_sacramento_aprox]) ?? event.text;
	if (!event.date && event_approximate)
		extra.push(`Fecha aproximada del sacramento: ${event_approximate}`);

	const people = [groom];
	let detail: Record<string, string | null> = {
		padrino_1: clean_cell(row[COLUMNS.padrino]),
		padrino_2: clean_cell(row[COLUMNS.madrina]),
	};

	if (type === 'matrimonio')
	{
		const bride = read_person(row, BRIDE);
		if (!bride.nombres)
			return { fila: file_row, motivo: 'Falta el nombre de la novia.' };

		people.push(bride);

		const groom_baptism = date_or_text(row[COLUMNS.fecha_bautizo_novio]);
		const bride_baptism = date_or_text(row[COLUMNS.fecha_bautizo_novia]);
		const groom_approximate = clean_cell(row[COLUMNS.fecha_bautizo_novio_aprox]) ?? groom_baptism.text;
		const bride_approximate = clean_cell(row[COLUMNS.fecha_bautizo_novia_aprox]) ?? bride_baptism.text;

		if (!groom_baptism.date && groom_approximate)
			extra.push(`Fecha aproximada del bautizo del esposo: ${groom_approximate}`);

		if (!bride_baptism.date && bride_approximate)
			extra.push(`Fecha aproximada del bautizo de la esposa: ${bride_approximate}`);

		detail = {
			lugar: clean_cell(row[COLUMNS.lugar_matrimonio]),
			testigo_1: clean_cell(row[COLUMNS.padrino]),
			testigo_2: clean_cell(row[COLUMNS.madrina]),
			testigo_3: clean_cell(row[COLUMNS.testigo_3]),
			testigo_4: clean_cell(row[COLUMNS.testigo_4]),
			conyuge_1_bautismo_parroquia: clean_cell(row[COLUMNS.parroquia_bautizo_novio]),
			conyuge_1_bautismo_fecha: groom_baptism.date,
			conyuge_2_bautismo_parroquia: clean_cell(row[COLUMNS.parroquia_bautizo_novia]),
			conyuge_2_bautismo_fecha: bride_baptism.date,
		};
	}

	return {
		fila: file_row,
		codigo_parroquia: clean_cell(row[COLUMNS.codigo_parroquia]),
		tipo: type,
		libro: book_name,
		folio: page,
		numero: number,
		// La fecha de la partida es la del sacramento, o ninguna. "FECHA INGRESO DATOS" es cuándo se
		// escribió en el sistema anterior, no la fecha de la partida.
		fecha_emision: event.date,
		fecha_evento: event.date,
		anotaciones: notes_of(row, extra),
		celebrante: split_minister(row[COLUMNS.celebrante]),
		personas: people,
		detalle: detail,
	};
}

export function register_key(record: Pick<ImportedRecord, 'tipo' | 'libro' | 'folio' | 'numero'>): string
{
	return [record.tipo, record.libro, record.folio, record.numero].map((part) => part.trim().toUpperCase()).join('|');
}

export function read_rows(rows: unknown[][], books: { codigo_parroquia: string | null; libros: BookNames }): { partidas: ImportedRecord[]; errores: RowError[] }
{
	const records: ImportedRecord[] = [];
	const errors: RowError[] = [];
	const seen = new Map<string, number>();
	const rows_with_data = data_rows(rows, RECORDS_SHEET, RECORDS_HEADER);

	let code = books.codigo_parroquia;
	for (const { row, fila } of rows_with_data)
	{
		code = check_parish_code(row, COLUMNS.codigo_parroquia, RECORDS_SHEET, fila, code);
		check_type_letter(row, COLUMNS.tipo_libro, RECORDS_SHEET, fila);
	}

	for (const { row, fila } of rows_with_data)
	{
		const result = read_row(row, fila, books.libros);
		if ('motivo' in result)
		{
			errors.push(result);
			continue;
		}

		const key = register_key(result);
		const first = seen.get(key);
		if (first !== undefined)
		{
			errors.push({ fila: fila, motivo: `Repite la partida de la fila ${first}.` });
			continue;
		}

		seen.set(key, fila);
		records.push(result);
	}

	return { partidas: records, errores: errors };
}

function find_sheet(sheets: { sheet: string; data: unknown[][] }[], name: string): unknown[][]
{
	const found = sheets.find((item) => item.sheet.trim().toLowerCase() === name);
	if (!found)
		throw new FormatError(`El archivo no tiene la hoja "${name}". Debe ser el Excel exportado por el sistema anterior, sin cambios.`);

	return found.data;
}

export function read_workbook(sheets: { sheet: string; data: unknown[][] }[]): { partidas: ImportedRecord[]; errores: RowError[] }
{
	const books = read_books(find_sheet(sheets, BOOKS_SHEET));
	return read_rows(find_sheet(sheets, RECORDS_SHEET), books);
}