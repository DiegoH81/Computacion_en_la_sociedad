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
  // Un texto largo: empieza arriba con su propia letra y ocupa los renglones que necesite.
  if (slot.kind === 'area') {
    return {
      position: 'absolute',
      left: `${slot.x}mm`,
      top: `${slot.top}mm`,
      width: `${slot.width}mm`,
      maxHeight: `${slot.height}mm`,
      fontSize: `${slot.fontSize}pt`,
      lineHeight: 1.2,
      overflow: 'hidden',
      whiteSpace: 'pre-wrap',
      overflowWrap: 'anywhere',
    };
  }

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

// Ancho de la raya que tacha un dato vacío: corta, para que no parezca una línea más del formato.
const EMPTY_MARK_MM = 8;

/** Un dato vacío se tacha con una raya corta: así se ve que no se dejó en blanco por olvido. */
function EmptyMark({ slotKey, slot, fontSize }: { slotKey: string; slot: PrintSlot; fontSize: number }) {
  // Las anotaciones vacías se tachan en su primer renglón.
  const place: PrintSlot = slot.kind === 'area' ? { kind: 'line', x: slot.x, y: slot.top + DEFAULT_LINE_MM, width: slot.width } : slot;
  const style = { ...slotStyle(place, fontSize), textAlign: 'center' as const };

  return (
    <div data-slot={slotKey} data-empty="true" style={style}>
      <span style={{ display: 'inline-block', width: `${EMPTY_MARK_MM}mm`, borderTop: '0.3mm solid black', verticalAlign: 'middle' }} />
    </div>
  );
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
          if (value) {
            return (
              <div key={key} data-slot={key} style={slotStyle(slot, layout.fontSize)}>
                {value}
              </div>
            );
          }
          return <EmptyMark key={key} slotKey={key} slot={slot} fontSize={layout.fontSize} />;
        })}
      </div>
    </div>
  );
}
