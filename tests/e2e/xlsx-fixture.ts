import { writeFileSync } from 'node:fs';
import { crc32 } from 'node:zlib';
import { RECORDS_HEADER } from '../../electron/main/import/legacy_excel';

// Arma un .xlsx mínimo (un zip con unos XML) para probar la importación sin usar datos reales.
// Las celdas de texto van como "inlineStr" y los números como números.

type Cell = string | number | null;

function column_name(index: number): string {
  let name = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
}

const xml_text = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function sheet_xml(rows: Cell[][]): string {
  const width = Math.max(...rows.map((row) => row.length));
  const body = rows
    .map((row, r) => {
      const cells = row
        .map((value, c) => {
          const ref = `${column_name(c)}${r + 1}`;
          if (value === null || value === '') return '';
          if (typeof value === 'number') return `<c r="${ref}"><v>${value}</v></c>`;
          return `<c r="${ref}" t="inlineStr"><is><t>${xml_text(value)}</t></is></c>`;
        })
        .join('');
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${column_name(width - 1)}${rows.length}"/><sheetData>${body}</sheetData></worksheet>`;
}

// Un zip sin compresión: alcanza para que read-excel-file lo lea.
function zip(files: { name: string; data: string }[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name);
    const data = Buffer.from(file.data);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += local.length + name.length + data.length;
  }
  const central_size = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(central_size, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}

export function write_xlsx(file: string, sheets: { name: string; rows: Cell[][] }[]): void {
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets
    .map((sheet, i) => `<sheet name="${sheet.name}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
    .join('')}</sheets></workbook>`;
  const workbook_rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets
    .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
    .join('')}</Relationships>`;
  const content_types = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets
    .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
    .join('')}</Types>`;
  const root_rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

  writeFileSync(
    file,
    zip([
      { name: '[Content_Types].xml', data: content_types },
      { name: '_rels/.rels', data: root_rels },
      { name: 'xl/workbook.xml', data: workbook },
      { name: 'xl/_rels/workbook.xml.rels', data: workbook_rels },
      ...sheets.map((sheet, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheet_xml(sheet.rows) })),
    ]),
  );
}

// ---------------------------------------------------------------------------
// El Excel del sistema anterior, con datos inventados
// ---------------------------------------------------------------------------

const BOOKS_HEADER_ROW: Cell[] = ['COD PARROQUIA', 'TIPO DE LIBRO', 'NUM LIBRO', 'NOMBRE DE LIBRO', 'RANGO DE AÑOS DEL LIBRO'];

function record_row(values: Record<number, Cell>): Cell[] {
  const row: Cell[] = new Array(RECORDS_HEADER.length).fill(null);
  for (const [column, value] of Object.entries(values)) row[Number(column)] = value;
  return row;
}

/** Dos bautismos, un matrimonio (en el libro "M61") y una fila sin nombre, que se salta. */
export function legacy_rows(code = 32): { feligres: Cell[][]; libros: Cell[][] } {
  const baptism = (numero: number, nombres: string) =>
    record_row({ 0: code, 1: 'B', 2: 21, 3: 5, 4: numero, 6: nombres, 7: 'MAMANI', 8: 'IMPORTADA', 9: '15/01/1959', 11: 'CRUCERO', 12: '11/10/1959', 16: 'JOSE MAMANI', 17: 'ROSA QUISPE', 23: 'Pbro. PEDRO RAMOS DIAZ', 24: 'NINGUNA', 25: 'DIONISIO QUISPE' });

  return {
    feligres: [
      [...RECORDS_HEADER],
      baptism(9001, 'JUANA'),
      baptism(9002, 'PEDRO'),
      record_row({ 0: code, 1: 'M', 2: 5, 3: 12, 4: 9003, 6: 'TOMAS', 7: 'CONDORI', 8: 'IMPORTADO', 10: '(27 AÑOS AL DIA DE BODA)', 12: '02/10/1980', 23: 'Pbro. PEDRO RAMOS DIAZ', 27: 'CARMEN', 28: 'HUAMAN', 29: 'IMPORTADA' }),
      record_row({ 0: code, 1: 'B', 2: 21, 3: 5, 4: 9004, 7: 'SIN', 8: 'NOMBRE' }),
    ],
    libros: [BOOKS_HEADER_ROW, [code, 'B', 21, '21', null], [code, 'M', 5, 'M61', '1961-2017']],
  };
}

export function write_legacy_excel(file: string): void {
  const rows = legacy_rows();
  write_xlsx(file, [
    { name: 'parroquialibros', rows: rows.libros },
    { name: 'feligres', rows: rows.feligres },
  ]);
}
