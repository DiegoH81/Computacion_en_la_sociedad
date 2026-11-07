/**
 * El ajuste de la impresora de esta PC para imprimir sobre los formatos: cada impresora corre la hoja
 * unos milímetros, y con este ajuste todos los datos se mueven juntos hasta caer en sus líneas.
 * Se guarda en esta PC (cada PC tiene su impresora); si no se puede leer, no hay ajuste.
 */

export interface PrintAdjustment {
  /** Milímetros hacia la derecha (negativo: hacia la izquierda). */
  x: number;
  /** Milímetros hacia arriba (negativo: hacia abajo). */
  y: number;
}

const STORAGE_KEY = 'impresion.ajuste';

/** Más que esto ya no es un corrimiento de la impresora: es otro formato. */
export const MAX_ADJUSTMENT_MM = 20;

export const NO_ADJUSTMENT: PrintAdjustment = { x: 0, y: 0 };

function clamp(value: unknown): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(-MAX_ADJUSTMENT_MM, Math.min(MAX_ADJUSTMENT_MM, number));
}

export function loadPrintAdjustment(): PrintAdjustment {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<PrintAdjustment> | null;
    return saved ? { x: clamp(saved.x), y: clamp(saved.y) } : NO_ADJUSTMENT;
  } catch {
    return NO_ADJUSTMENT;
  }
}

export function savePrintAdjustment(adjustment: PrintAdjustment): PrintAdjustment {
  const clean = { x: clamp(adjustment.x), y: clamp(adjustment.y) };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
  } catch {
    // Sin almacenamiento, el ajuste vale solo mientras la ventana esté abierta.
  }
  return clean;
}
