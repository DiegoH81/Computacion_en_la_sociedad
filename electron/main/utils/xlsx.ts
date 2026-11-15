import { deflateRawSync } from 'node:zlib';

export type Cell = string | number | null | undefined;

export interface Sheet
{
	name: string;
	rows: Cell[][]; // la primera fila son los títulos
}

const COLUMN_WIDTH = 22;

function escape_xml(in_text: string): string
{
	const clean = in_text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
	return clean.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** 0 -> "A", 25 -> "Z", 26 -> "AA". */
function column_name(in_index: number): string
{
	let name = '';
	let index = in_index + 1;
	while (index > 0)
	{
		const rest = (index - 1) % 26;
		name = String.fromCharCode(65 + rest) + name;
		index = Math.floor((index - 1) / 26);
	}

	return name;
}

function cell_xml(in_value: Cell, in_reference: string, in_is_title: boolean): string
{
	if (in_value === null || in_value === undefined || in_value === '')
		return '';

	const style = in_is_title ? ' s="1"' : '';
	if (typeof in_value === 'number')
		return `<c r="${in_reference}"${style}><v>${in_value}</v></c>`;

	return `<c r="${in_reference}" t="inlineStr"${style}><is><t xml:space="preserve">${escape_xml(in_value)}</t></is></c>`;
}

function sheet_xml(in_sheet: Sheet): string
{
	const column_count = Math.max(1, ...in_sheet.rows.map((row) => row.length));
	const columns = `<cols><col min="1" max="${column_count}" width="${COLUMN_WIDTH}" customWidth="1"/></cols>`;
	const freeze = '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>';

	const rows = in_sheet.rows.map((row, row_index) =>
	{
		const cells = row.map((value, column_index) => cell_xml(value, `${column_name(column_index)}${row_index + 1}`, row_index === 0)).join('');
		return `<row r="${row_index + 1}">${cells}</row>`;
	});

	return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
		+ '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
		+ `${freeze}${columns}<sheetData>${rows.join('')}</sheetData></worksheet>`;
}

function workbook_files(in_sheets: Sheet[]): Record<string, string>
{
	const files: Record<string, string> = {};
	const xml_header = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

	const sheet_types = in_sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('');
	files['[Content_Types].xml'] = xml_header
		+ '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
		+ '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
		+ '<Default Extension="xml" ContentType="application/xml"/>'
		+ '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
		+ '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
		+ `${sheet_types}</Types>`;

	files['_rels/.rels'] = xml_header
		+ '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
		+ '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
		+ '</Relationships>';

	// Los nombres de hoja no pueden pasar de 31 caracteres.
	const sheet_list = in_sheets.map((sheet, index) => `<sheet name="${escape_xml(sheet.name.slice(0, 31))}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('');
	files['xl/workbook.xml'] = xml_header
		+ '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
		+ `<sheets>${sheet_list}</sheets></workbook>`;

	const sheet_links = in_sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('');
	const styles_link = `<Relationship Id="rId${in_sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`;
	files['xl/_rels/workbook.xml.rels'] = xml_header
		+ `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheet_links}${styles_link}</Relationships>`;

	// Estilo 0: normal. Estilo 1: negrita, para los títulos.
	files['xl/styles.xml'] = xml_header
		+ '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
		+ '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
		+ '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
		+ '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
		+ '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
		+ '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>'
		+ '</styleSheet>';

	in_sheets.forEach((sheet, index) =>
	{
		files[`xl/worksheets/sheet${index + 1}.xml`] = sheet_xml(sheet);
	});

	return files;
}


const CRC_TABLE = Array.from({ length: 256 }, (_, index) =>
{
	let value = index;
	for (let bit = 0; bit < 8; bit++)
		value = value & 1 ? 0xEDB88320 ^ (value >>> 1) : value >>> 1;

	return value >>> 0;
});

function crc32(in_data: Buffer): number
{
	let crc = 0xFFFFFFFF;
	for (const byte of in_data)
		crc = CRC_TABLE[(crc ^ byte) & 0xFF] ^ (crc >>> 8);

	return (crc ^ 0xFFFFFFFF) >>> 0;
}

function zip(in_files: Record<string, string>): Buffer
{
	const parts: Buffer[] = [];
	const index: Buffer[] = [];
	let offset = 0;

	for (const [name, text] of Object.entries(in_files))
	{
		const file_name = Buffer.from(name, 'utf8');
		const data = Buffer.from(text, 'utf8');
		const packed = deflateRawSync(data);
		const crc = crc32(data);

		const local = Buffer.alloc(30);
		local.writeUInt32LE(0x04034B50, 0);
		local.writeUInt16LE(20, 4);
		local.writeUInt16LE(0x0800, 6);
		local.writeUInt16LE(8, 8);
		local.writeUInt32LE(0, 10);
		local.writeUInt32LE(crc, 14);
		local.writeUInt32LE(packed.length, 18);
		local.writeUInt32LE(data.length, 22);
		local.writeUInt16LE(file_name.length, 26);
		local.writeUInt16LE(0, 28);

		const entry = Buffer.alloc(46);
		entry.writeUInt32LE(0x02014B50, 0);
		entry.writeUInt16LE(20, 4);
		entry.writeUInt16LE(20, 6);
		entry.writeUInt16LE(0x0800, 8);
		entry.writeUInt16LE(8, 10);
		entry.writeUInt32LE(0, 12);
		entry.writeUInt32LE(crc, 16);
		entry.writeUInt32LE(packed.length, 20);
		entry.writeUInt32LE(data.length, 24);
		entry.writeUInt16LE(file_name.length, 28);
		entry.writeUInt32LE(offset, 42);

		parts.push(local, file_name, packed);
		index.push(entry, file_name);
		offset += local.length + file_name.length + packed.length;
	}

	const index_size = index.reduce((total, part) => total + part.length, 0);
	const count = Object.keys(in_files).length;

	const end = Buffer.alloc(22);
	end.writeUInt32LE(0x06054B50, 0);
	end.writeUInt16LE(count, 8);
	end.writeUInt16LE(count, 10);
	end.writeUInt32LE(index_size, 12);
	end.writeUInt32LE(offset, 16);

	return Buffer.concat([...parts, ...index, end]);
}

export function build_xlsx(in_sheets: Sheet[]): Buffer
{
	return zip(workbook_files(in_sheets));
}
