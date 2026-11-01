import { useEffect, useId, useState } from 'react';
import { A4Page, A4PrintPreview } from '../print/A4PrintPreview';
import { loadIndexBooks, loadIndexEntries } from '../../controllers/SacramentIndexController';
import type { SacramentIndexEntry, SacramentType } from '../../services/SacramentIndexService';

const ROWS_PER_PAGE = 39;
const ALL_BOOKS = '__todos__';
const CELL = 'h-[6mm] overflow-hidden border border-black px-[1.5mm] align-middle whitespace-nowrap';
const NUMBER_CELL = `${CELL} text-center`;

type Loaded<T> = { key: string; data: T } | { key: string; error: string };

function formatName(entry: SacramentIndexEntry): string {
  const apellidos = `${entry.apellidoPaterno} ${entry.apellidoMaterno}`.trim();
  return `${apellidos}, ${entry.nombres}`;
}

function toPages<T>(items: T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    pages.push(items.slice(i, i + size));
  }
  return pages;
}

interface SacramentIndexPreviewProps {
  tipo: SacramentType;
  sacramentName: string;
  parroquiaNombre: string;
  onClose: () => void;
}

export function SacramentIndexPreview({
  tipo,
  sacramentName,
  parroquiaNombre,
  onClose,
}: SacramentIndexPreviewProps) {
  const bookFieldId = useId();
  const [books, setBooks] = useState<Loaded<string[]> | null>(null);
  const [selectedBook, setSelectedBook] = useState<string | null>(null);
  const [entries, setEntries] = useState<Loaded<SacramentIndexEntry[]> | null>(null);

  useEffect(() => {
    let isCurrent = true;
    loadIndexBooks(tipo).then((result) => {
      if (!isCurrent) return;
      setBooks(
        result.success ? { key: tipo, data: result.data } : { key: tipo, error: result.errorMessage },
      );
    });
    return () => {
      isCurrent = false;
    };
  }, [tipo]);

  const bookList = books && 'data' in books ? books.data : [];
  const book = selectedBook ?? bookList[0] ?? null;

  useEffect(() => {
    if (book === null) return;

    let isCurrent = true;
    loadIndexEntries(tipo, book === ALL_BOOKS ? null : book).then((result) => {
      if (!isCurrent) return;
      setEntries(
        result.success ? { key: book, data: result.data } : { key: book, error: result.errorMessage },
      );
    });
    return () => {
      isCurrent = false;
    };
  }, [tipo, book]);

  const current = entries?.key === book ? entries : null;

  let message: string | null = null;
  if (!books) message = 'Cargando...';
  else if ('error' in books) message = books.error;
  else if (bookList.length === 0) message = 'No hay partidas vigentes en esta parroquia.';
  else if (!current) message = 'Cargando...';
  else if ('error' in current) message = current.error;
  else if (current.data.length === 0) message = 'No hay partidas vigentes en este libro.';

  const rows = current && 'data' in current ? current.data : [];
  const subtitle = book === ALL_BOOKS || book === null ? parroquiaNombre : `${parroquiaNombre} · Libro ${book}`;

  const pages = toPages(rows, ROWS_PER_PAGE).map((pageRows, pageIndex) => (
    <A4Page key={pageIndex} pageNumber={pageIndex + 1}>
      <h2 className="text-center text-[14pt] font-bold text-black uppercase">
        Índice alfabético de {sacramentName}
      </h2>
      <p className="mb-[3mm] text-center text-[10pt] font-semibold text-black">{subtitle}</p>

      <table className="w-full table-fixed border-collapse text-[9pt] text-black">
        <thead>
          <tr className="a4-table-head bg-slate-300 text-[8pt] uppercase">
            <th className={`${CELL} text-center`}>Apellidos y nombres</th>
            <th className={`${NUMBER_CELL} w-[20mm]`}>N° libro</th>
            <th className={`${NUMBER_CELL} w-[20mm]`}>Folio</th>
            <th className={`${NUMBER_CELL} w-[20mm]`}>Registro</th>
          </tr>
        </thead>
        <tbody>
          {pageRows.map((entry, rowIndex) => {
            const name = formatName(entry);
            return (
              <tr key={rowIndex}>
                <td className={`${CELL} uppercase ${name.length > 48 ? 'text-[7.5pt]' : ''}`}>{name}</td>
                <td className={NUMBER_CELL}>{entry.libro}</td>
                <td className={NUMBER_CELL}>{entry.folio}</td>
                <td className={NUMBER_CELL}>{entry.registro}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </A4Page>
  ));

  return (
    <A4PrintPreview
      title="Imprimir índice"
      resetKey={book ?? ''}
      pages={pages}
      message={message}
      onClose={onClose}
      controls={
        bookList.length > 0 && (
          <div className="flex items-center">
            <label
              htmlFor={bookFieldId}
              className="rounded-l-lg bg-solid-blue px-4 py-2 font-bold uppercase"
            >
              Libro:
            </label>
            <select
              id={bookFieldId}
              value={book ?? ''}
              onChange={(event) => setSelectedBook(event.target.value)}
              className="rounded-r-lg bg-white px-3 py-2 font-semibold text-black outline-none"
            >
              {bookList.map((libro) => (
                <option key={libro} value={libro}>
                  {libro}
                </option>
              ))}
              <option value={ALL_BOOKS}>Todos</option>
            </select>
          </div>
        )
      }
    />
  );
}
