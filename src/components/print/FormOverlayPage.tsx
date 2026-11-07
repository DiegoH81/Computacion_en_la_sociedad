import type { CSSProperties } from 'react';
import type { PrintAdjustment } from '../../lib/printAdjustment';
import type { FormLayout, PrintSlot } from '../../lib/printLayouts';

const MM_PER_POINT = 25.4 / 72;
// El renglón del texto queda un poco por encima de la línea punteada, como escrito a máquina.
const ABOVE_LINE_MM = 0.7;
// Alto de un renglón cuando el lugar no dice otro.
const DEFAULT_LINE_MM = 5;

interface FormOverlayPageProps {
  layout: FormLayout;
  values: Record<string, string>;
  adjustment: PrintAdjustment;
  /** Ver el formato de fondo en la vista previa (nunca se imprime). */
  showForm: boolean;
}

// Un renglón o varios, cortados con "…" si el texto no cabe.
function clampStyle(lines: number): CSSProperties {
  if (lines <= 1) return { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
  return { display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: lines, overflow: 'hidden', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' };
}

function slotStyle(slot: PrintSlot, fontSize: number): CSSProperties {
  const lines = slot.lines ?? 1;
  const textAlign = slot.align ?? 'left';

  if (slot.kind === 'line') {
    const lineHeight = slot.gap ?? DEFAULT_LINE_MM;
    // La línea de base del texto cae en el centro del renglón más ~0,3 del tamaño de la letra.
    const baselineInLine = lineHeight / 2 + 0.3 * fontSize * MM_PER_POINT;
    return {
      position: 'absolute',
      left: `${slot.x}mm`,
      top: `${slot.y - ABOVE_LINE_MM - baselineInLine}mm`,
      width: `${slot.width}mm`,
      lineHeight: `${lineHeight}mm`,
      maxHeight: `${lineHeight * lines}mm`,
      textAlign,
      ...clampStyle(lines),
    };
  }

  if (lines > 1) {
    const lineHeight = slot.height / lines;
    return {
      position: 'absolute',
      left: `${slot.x}mm`,
      top: `${slot.top}mm`,
      width: `${slot.width}mm`,
      lineHeight: `${lineHeight}mm`,
      maxHeight: `${slot.height}mm`,
      textAlign,
      ...clampStyle(lines),
    };
  }

  // Una casilla de un renglón: el texto va centrado en su altura.
  return {
    position: 'absolute',
    left: `${slot.x}mm`,
    top: `${slot.top}mm`,
    width: `${slot.width}mm`,
    height: `${slot.height}mm`,
    lineHeight: `${slot.height}mm`,
    textAlign,
    ...clampStyle(1),
  };
}

/**
 * Una hoja A4 con solo los datos, cada uno en su lugar del formato impreso (ver printLayouts.ts).
 * En la vista previa se ve el formato de fondo para comprobar que coinciden; al imprimir, el fondo
 * no sale.
 */
export function FormOverlayPage({ layout, values, adjustment, showForm }: FormOverlayPageProps) {
  return (
    <div className="a4-overlay font-sans text-black">
      {showForm && <img src={layout.background} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full opacity-60 print:hidden" />}

      {/* En la pantalla el eje vertical crece hacia abajo; el ajuste, hacia arriba: por eso el signo menos. */}
      <div className="absolute inset-0" style={{ transform: `translate(${adjustment.x}mm, ${-adjustment.y}mm)`, fontSize: `${layout.fontSize}pt` }}>
        {Object.entries(layout.slots).map(([key, slot]) => {
          const value = values[key];
          if (!value) return null;

          return (
            <div key={key} data-slot={key} style={slotStyle(slot, layout.fontSize)}>
              {value}
            </div>
          );
        })}
      </div>
    </div>
  );
}
