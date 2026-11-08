// Clases de Tailwind de las tablas de búsqueda (partidas, ministros, usuarios, parroquias).
// Van aparte de SearchPanelParts.tsx porque un archivo de componentes no debe exportar funciones.

export const PANEL_ACTION_BUTTON =
  'w-full rounded-lg px-3 py-2 text-base font-bold text-white uppercase hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50';
// La tabla blanca dentro del bloque verde: mide lo que sus filas, hasta un máximo, y después se desplaza.
export const PANEL_TABLE_BOX = 'max-h-72 overflow-auto rounded-md bg-white';
export const PANEL_HEADER_CELL =
  'sticky top-0 z-10 border-b-2 border-darker-app bg-lighter-green px-3 py-2 text-xs font-bold tracking-wide text-dark-app uppercase';
export const PANEL_CELL = 'border-b border-slate-200 px-3 py-2 text-sm';
/** Libro, folio y número: alineados a la derecha, con cifras del mismo ancho. */
export const PANEL_NUMBER = 'text-right tabular-nums';
/** El dato principal de la fila, como el nombre. */
export const PANEL_MAIN = 'font-semibold';

/** Clases de una fila: la marcada se pinta, y al pasar el mouse se aclara. */
export function panelRowClass(isSelectable: boolean, isSelected: boolean, isMuted = false): string {
  const color = isMuted ? 'text-slate-500' : 'text-black';
  if (!isSelectable) return color;
  if (isSelected) return `${color} cursor-pointer bg-lighter-green`;
  return `${color} cursor-pointer transition-colors hover:bg-slate-50`;
}

/** La celda del check, primera columna. Con la fila marcada lleva una franja a la izquierda. */
export function panelCheckCellClass(isSelected: boolean): string {
  return `w-11 border-b border-slate-200 px-3 py-2 ${isSelected ? 'shadow-[inset_4px_0_var(--color-darker-app)]' : ''}`;
}
