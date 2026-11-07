import type { Baptism } from '../../../shared/models';
import { formatLongDate, todayLongDate } from '../../lib/dates';
import { birthValue, celebrantName, fullName, printText } from '../../lib/printFields';
import { BlankDateLine, CertificateLogo, DottedField, SerialNumber, SignatureLine } from '../print/CertificateParts';

const TITLES = {
  bautismo: { sacramento: 'Bautismo', libroDe: 'bautismos' },
  confirmacion: { sacramento: 'Confirmación', libroDe: 'confirmaciones' },
};

interface SinglePersonPrintViewProps {
  record: Baptism;
  logo: string | null;
}

/** La constancia de bautismo o de confirmación. La de bautismo trae además el nacimiento. */
export function SinglePersonPrintView({ record, logo }: SinglePersonPrintViewProps) {
  const { sacramento: partida, persona } = record;
  const tipo = partida.tipo === 'confirmacion' ? 'confirmacion' : 'bautismo';
  const { sacramento, libroDe } = TITLES[tipo];
  const sacramentoMinuscula = sacramento.toLowerCase();

  const fields = [
    { label: 'Nombres', value: persona.nombres },
    { label: 'Apellidos', value: fullName(persona.apellido_paterno, persona.apellido_materno) },
    { label: 'Padre', value: printText(persona.padre) },
    { label: 'Madre', value: printText(persona.madre) },
    ...(tipo === 'bautismo'
      ? [
          { label: 'Lugar de nacimiento', value: printText(persona.lugar_nacimiento) },
          { label: 'Fecha de nacimiento', value: birthValue(persona.fecha_nacimiento, persona.fecha_aproximada) },
        ]
      : []),
    { label: `Fecha de ${sacramento}`, value: formatLongDate(printText(partida.fecha_evento)) },
    { label: 'Celebrante', value: celebrantName(partida.ministro) },
    { label: 'Padrino', value: printText(record.padrino_1) },
    { label: 'Madrina', value: printText(record.padrino_2) },
  ];

  return (
    <div className="flex h-full min-h-[270mm] flex-col font-sans text-[10pt] text-black">
      <header className="grid grid-cols-[42mm_1fr] gap-[4mm]">
        <CertificateLogo logo={logo} />
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
              value={printText(partida.parroquia?.nombre)}
              labelClassName="text-[13pt] font-bold"
              valueClassName="text-[10pt] font-bold uppercase"
            />
          </div>
        </div>
      </header>

      <div className="mt-[10mm] grid grid-cols-[50mm_1fr] gap-[6mm]">
        <aside className="flex flex-col gap-[2mm]">
          <DottedField label="Libro:" value={partida.libro} valueClassName="text-center font-bold" />
          <DottedField label="Folio:" value={partida.folio} valueClassName="text-center font-bold" />
          <DottedField label="Número:" value={partida.numero} valueClassName="text-center font-bold" />

          <h3 className="mt-[10mm] text-[11pt] font-bold">Anotaciones marginales</h3>
          <p className="whitespace-pre-wrap break-words text-[9.5pt] leading-snug">{printText(partida.anotaciones)}</p>
        </aside>

        <section className="flex flex-col gap-[2.2mm]">
          <p className="leading-snug">
            El suscrito Certifica, que en el libro de {libroDe} cuyos datos indicamos al margen, se encuentra una partida
            de {sacramentoMinuscula} cuyos datos son:
          </p>
          {fields.map((field) => (
            <DottedField key={field.label} label={`${field.label}:`} value={field.value} valueClassName="font-bold uppercase" />
          ))}
        </section>
      </div>

      <p className="mt-[14mm] text-right">
        {partida.parroquia?.ubicacion ? `${partida.parroquia.ubicacion}, ` : ''}
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
