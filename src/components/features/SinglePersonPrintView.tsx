import { todayLongDate } from '../../lib/dates';
import { BlankDateLine, CertificateLogo, DottedField, SerialNumber, SignatureLine } from '../print/CertificateParts';

export interface SinglePersonPrintData {
  logo: string | null;
  parroquiaNombre: string;
  ubicacion: string;
  numeroLibro: string;
  numeroFolio: string;
  numeroRegistro: string;
  fields: { label: string; value: string }[];
  anotaciones: string;
}

interface SinglePersonPrintViewProps {
  /** "Bautismo" o "Confirmación", tal como va en el título. */
  sacramento: string;
  /** Plural para el texto de certificación, ej. "bautismos". */
  libroDe: string;
  data: SinglePersonPrintData;
}

export function SinglePersonPrintView({ sacramento, libroDe, data }: SinglePersonPrintViewProps) {
  const sacramentoMinuscula = sacramento.toLowerCase();

  return (
    <div className="flex h-full min-h-[270mm] flex-col font-sans text-[10pt] text-black">
      <header className="grid grid-cols-[42mm_1fr] gap-[4mm]">
        <CertificateLogo logo={data.logo} />
        <div className="flex flex-col">
          <h1 className="text-[20pt] font-bold">PRELATURA DE AYAVIRI</h1>
          <div className="flex flex-wrap items-baseline justify-between gap-[4mm]">
            <h2 className="text-[15pt] font-bold">Constancia de {sacramento}</h2>
            <SerialNumber />
          </div>
          <p className="mt-[2mm] text-right text-[9pt] font-bold italic">N.A</p>
          <div className="mt-auto">
            <DottedField
              label="Parroquia:"
              value={data.parroquiaNombre}
              labelClassName="text-[13pt] font-bold"
              valueClassName="text-[10pt] font-bold uppercase"
            />
          </div>
        </div>
      </header>

      <div className="mt-[10mm] grid grid-cols-[50mm_1fr] gap-[6mm]">
        <aside className="flex flex-col gap-[2mm]">
          <DottedField label="Libro:" value={data.numeroLibro} valueClassName="text-center font-bold" />
          <DottedField label="Folio:" value={data.numeroFolio} valueClassName="text-center font-bold" />
          <DottedField label="Número:" value={data.numeroRegistro} valueClassName="text-center font-bold" />

          <h3 className="mt-[10mm] text-[11pt] font-bold">Anotaciones marginales</h3>
          <p className="whitespace-pre-wrap break-words text-[9.5pt] leading-snug">{data.anotaciones}</p>
        </aside>

        <section className="flex flex-col gap-[2.2mm]">
          <p className="leading-snug">
            El suscrito Certifica, que en el libro de {libroDe} cuyos datos indicamos al margen, se encuentra una partida
            de {sacramentoMinuscula} cuyos datos son:
          </p>
          {data.fields.map((field) => (
            <DottedField key={field.label} label={`${field.label}:`} value={field.value} valueClassName="font-bold uppercase" />
          ))}
        </section>
      </div>

      <p className="mt-[14mm] text-right">
        {data.ubicacion ? `${data.ubicacion}, ` : ''}
        {todayLongDate()}
      </p>

      <div className="mt-[20mm] grid grid-cols-2 items-end gap-[10mm]">
        <p className="text-center text-[8pt]">Sello parroquial</p>
        <SignatureLine className="text-[10pt]">Párroco</SignatureLine>
      </div>

      <div className="mt-[8mm] ml-auto w-[105mm] text-[10pt] leading-snug">
        <p>El suscrito certifica la autenticidad de la firma y sello de la presente constancia de {sacramento}.</p>
        <BlankDateLine className="mt-[3mm] text-[9pt]" />
      </div>

      <div className="mt-auto grid grid-cols-[1fr_auto] items-end gap-[16mm] pt-[18mm] pl-[35mm]">
        <SignatureLine>Notario Eclesiástico</SignatureLine>
        <p className="text-[8pt]">Sello de la Curia</p>
      </div>
    </div>
  );
}
