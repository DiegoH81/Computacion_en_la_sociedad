import { useId, useState, type ReactNode } from 'react';
import { loadPrintAdjustment, MAX_ADJUSTMENT_MM, savePrintAdjustment, type PrintAdjustment } from '../../lib/printAdjustment';
import { FORM_LAYOUTS, type FormKind } from '../../lib/printLayouts';
import { A4Page, A4PrintPreview } from './A4PrintPreview';
import { FormOverlayPage } from './FormOverlayPage';

type PrintMode = 'formato' | 'completa';

interface CertificatePrintPreviewProps {
  kind: FormKind;
  /** Los datos de la partida, uno por cada lugar del formato (printFields.ts). */
  values: Record<string, string>;
  /** La constancia completa, con escudo y rótulos, para imprimir en una hoja en blanco. */
  fullCertificate: ReactNode;
  onClose: () => void;
}

const MODE_BUTTON = 'rounded-md px-3 py-1 text-[16px] font-semibold';
// Cada grupo de la barra va en su recuadro, como los botones de "Qué imprimir".
const CONTROL_GROUP = 'flex items-center gap-1 rounded-lg bg-white/10 p-1';
const STEP_BUTTON = 'h-7 w-7 rounded-md bg-white/15 text-[18px] font-bold leading-none hover:bg-white/30';
const STEP_MM = 0.5;

/**
 * Imprimir una constancia. Primero, solo los datos sobre el formato impreso de la prelatura; si no
 * hay formatos a mano, la constancia completa. Al imprimir sobre el formato se puede ajustar dónde
 * cae todo (Horizontal / Vertical, en mm), porque cada impresora corre la hoja un poco; el ajuste queda
 * guardado en esta PC.
 */
export function CertificatePrintPreview({ kind, values, fullCertificate, onClose }: CertificatePrintPreviewProps) {
  const [mode, setMode] = useState<PrintMode>('formato');
  const [adjustment, setAdjustment] = useState<PrintAdjustment>(loadPrintAdjustment);
  const [showForm, setShowForm] = useState(true);
  const xId = useId();
  const yId = useId();

  function changeAdjustment(changes: Partial<PrintAdjustment>) {
    setAdjustment(savePrintAdjustment({ ...adjustment, ...changes }));
  }

  const modeButton = (value: PrintMode, text: string) => (
    <button
      type="button"
      aria-pressed={mode === value}
      onClick={() => setMode(value)}
      className={`${MODE_BUTTON} ${mode === value ? 'bg-white text-black' : 'text-white hover:bg-white/15'}`}
    >
      {text}
    </button>
  );

  // Horizontal / Vertical: se escribe el número o se mueve de medio en medio milímetro con − y +.
  // Horizontal: + a la derecha, − a la izquierda. Vertical: + arriba, − abajo.
  const adjustmentInput = (id: string, label: string, axis: keyof PrintAdjustment, lessText: string, moreText: string) => (
    <div className={CONTROL_GROUP}>
      <label htmlFor={id} className="px-1 text-[15px] font-semibold">
        {label}
      </label>
      <button type="button" aria-label={lessText} title={lessText} onClick={() => changeAdjustment({ [axis]: adjustment[axis] - STEP_MM })} className={STEP_BUTTON}>
        −
      </button>
      <input
        id={id}
        type="number"
        step={STEP_MM}
        min={-MAX_ADJUSTMENT_MM}
        max={MAX_ADJUSTMENT_MM}
        value={adjustment[axis]}
        onChange={(event) => changeAdjustment({ [axis]: Number(event.target.value) })}
        className="w-14 [appearance:textfield] rounded-md bg-white py-0.5 text-center text-[15px] font-semibold text-black [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button type="button" aria-label={moreText} title={moreText} onClick={() => changeAdjustment({ [axis]: adjustment[axis] + STEP_MM })} className={STEP_BUTTON}>
        +
      </button>
      <span className="pr-1 text-[14px] text-white/70">mm</span>
    </div>
  );

  const controls = (
    <div className="flex flex-wrap items-center gap-3">
      <div role="group" aria-label="Qué imprimir" className={CONTROL_GROUP}>
        {modeButton('formato', 'Sobre el formato')}
        {modeButton('completa', 'Constancia completa')}
      </div>

      {/* Con la constancia completa estos controles no se usan: se ocultan pero ocupan su lugar, así
          los botones de la barra no se mueven al cambiar de opción. */}
      <fieldset disabled={mode !== 'formato'} aria-hidden={mode !== 'formato'} className={`flex flex-wrap items-center gap-3 ${mode === 'formato' ? '' : 'invisible'}`}>
        {adjustmentInput(xId, 'Horizontal', 'x', 'Mover a la izquierda', 'Mover a la derecha')}
        {adjustmentInput(yId, 'Vertical', 'y', 'Mover hacia abajo', 'Mover hacia arriba')}
        <label className={`${CONTROL_GROUP} cursor-pointer px-3 py-1.5 text-[15px] font-semibold hover:bg-white/15`}>
          <input type="checkbox" checked={showForm} onChange={(event) => setShowForm(event.target.checked)} className="h-5 w-5 cursor-pointer accent-white" />
          Ver el formato
        </label>
      </fieldset>
    </div>
  );

  const page =
    mode === 'formato' ? (
      <FormOverlayPage key="formato" layout={FORM_LAYOUTS[kind]} values={values} adjustment={adjustment} showForm={showForm} />
    ) : (
      <A4Page key="completa">{fullCertificate}</A4Page>
    );

  return <A4PrintPreview title="Imprimir constancia" controls={controls} pages={[page]} resetKey={mode} onClose={onClose} />;
}
