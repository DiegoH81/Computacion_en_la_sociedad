import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface A4PageProps {
  /** Si se indica, se muestra al pie de la hoja. */
  pageNumber?: number;
  children: ReactNode;
}

/** Una hoja A4. Dentro conviene usar mm y pt para que el tamaño sea el real. */
export function A4Page({ pageNumber, children }: A4PageProps) {
  return (
    <div className="a4-page">
      <div className="flex-1">{children}</div>
      {pageNumber !== undefined && (
        <p className="pt-[2mm] text-center text-[9pt] text-black">{pageNumber}</p>
      )}
    </div>
  );
}

interface A4PrintPreviewProps {
  title: string;
  /** Controles extra en la barra superior, como un selector. */
  controls?: ReactNode;
  /** Una hoja por elemento, normalmente cada una con A4Page. */
  pages: ReactNode[];
  /** Vuelve a la primera hoja cuando este valor cambia. */
  resetKey?: string;
  /** Se muestra en lugar de las hojas, por ejemplo al cargar o si no hay datos. */
  message?: string | null;
  onClose: () => void;
}

/**
 * Vista previa e impresión A4 a pantalla completa. En pantalla se ve una hoja a la vez;
 * al imprimir salen todas. Se monta fuera de #root para imprimir solo las hojas.
 */
export function A4PrintPreview({
  title,
  controls,
  pages,
  resetKey = '',
  message,
  onClose,
}: A4PrintPreviewProps) {
  const [page, setPage] = useState(0);
  const [previousResetKey, setPreviousResetKey] = useState(resetKey);

  if (resetKey !== previousResetKey) {
    setPreviousResetKey(resetKey);
    setPage(0);
  }

  useEffect(() => {
    document.documentElement.classList.add('print-preview-open');
    return () => document.documentElement.classList.remove('print-preview-open');
  }, []);

  const currentPage = Math.min(page, Math.max(pages.length - 1, 0));
  const canPrint = !message && pages.length > 0;

  return createPortal(
    <div className="a4-print-root fixed inset-0 z-50 flex flex-col bg-app">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 bg-black px-6 py-3 text-white print:hidden">
        <h1 className="text-[28px] font-bold uppercase">{title}</h1>

        <div className="flex flex-wrap items-center gap-3 text-[20px]">
          {controls}
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!canPrint}
            className="rounded-lg bg-solid-purple px-6 py-2 font-bold uppercase hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Imprimir
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-solid-red px-6 py-2 font-bold uppercase hover:opacity-90"
          >
            Volver
          </button>
        </div>
      </div>

      {canPrint && (
        <div className="flex shrink-0 items-center justify-center gap-4 bg-lighter-green px-6 py-2 text-[20px] text-black print:hidden">
          <button
            type="button"
            onClick={() => setPage(currentPage - 1)}
            disabled={currentPage === 0}
            aria-label="Hoja anterior"
            className="px-3 hover:opacity-70 disabled:opacity-30"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className="h-[22px] w-[22px]">
              <path d="M12 2v12L3 8z" />
            </svg>
          </button>
          <span aria-live="polite">
            Hoja {currentPage + 1} de {pages.length}
          </span>
          <button
            type="button"
            onClick={() => setPage(currentPage + 1)}
            disabled={currentPage >= pages.length - 1}
            aria-label="Hoja siguiente"
            className="px-3 hover:opacity-70 disabled:opacity-30"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className="h-[22px] w-[22px]">
              <path d="M4 2v12l9-6z" />
            </svg>
          </button>
        </div>
      )}

      <div className="a4-print-sheets flex-1 overflow-auto p-6">
        {message ? (
          <p role="status" className="mt-16 text-center text-[24px] font-semibold text-black">
            {message}
          </p>
        ) : (
          pages.map((page, index) => (
            <div
              key={index}
              className={`a4-print-sheet mx-auto w-fit shadow-xl ${
                index === currentPage ? '' : 'hidden print:block'
              }`}
            >
              {page}
            </div>
          ))
        )}
      </div>
    </div>,
    document.body,
  );
}
