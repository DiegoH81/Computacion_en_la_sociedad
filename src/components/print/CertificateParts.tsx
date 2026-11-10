import type { ReactNode } from 'react';

/** Sin logo registrado se avisa en la vista previa, y en papel queda el espacio en blanco. */
export function CertificateLogo({ logo }: { logo: string | null }) {
  if (logo) {
    return <img src={logo} alt="Logo de la parroquia" className="h-[42mm] w-[36mm] object-contain" />;
  }
  return (
    <div className="flex h-[42mm] w-[36mm] items-center justify-center border border-dashed border-slate-400 p-[2mm] text-center text-[8pt] text-slate-500 print:invisible">
      Parroquia sin logo registrado
    </div>
  );
}

export function SerialNumber() {
  return (
    <span className="text-[13pt] text-[#b23a48]">
      Nº <span className="inline-block w-[24mm] border-b border-dotted border-[#b23a48]" />
    </span>
  );
}

/** Raya corta que tacha un dato vacío, para que se vea que no se dejó en blanco por olvido. */
export function EmptyMark() {
  return <span aria-label="vacío" className="inline-block w-[8mm] border-t-[0.3mm] border-black align-middle" />;
}

/** El dato, o la raya si está vacío. */
export function ValueOrMark({ value }: { value?: string | null }) {
  return value ? <>{value}</> : <EmptyMark />;
}

interface DottedFieldProps {
  label?: string;
  value?: string;
  labelClassName?: string;
  valueClassName?: string;
}

/** Rótulo seguido de una línea punteada con el dato encima, como en el formulario impreso. */
export function DottedField({ label, value, labelClassName = '', valueClassName = '' }: DottedFieldProps) {
  return (
    <div className="flex items-baseline gap-[1mm]">
      {label && <span className={`whitespace-nowrap ${labelClassName}`}>{label}</span>}
      <span className={`min-h-[5mm] min-w-0 flex-1 border-b border-dotted border-black px-[2mm] ${value ? valueClassName : 'text-center'}`}>
        <ValueOrMark value={value} />
      </span>
    </div>
  );
}

/** Línea de "__ de ____ de 20__" que se completa a mano. */
export function BlankDateLine({ className = '' }: { className?: string }) {
  const blank = 'inline-block border-b border-dotted border-black';
  return (
    <p className={className}>
      <span className={`${blank} w-[16mm]`} /> de <span className={`${blank} w-[26mm]`} /> de 20
      <span className={`${blank} w-[10mm]`} />
    </p>
  );
}

export function SignatureLine({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`border-t border-dotted border-black pt-[1mm] text-center ${className}`}>{children}</p>;
}
