import type { Marriage } from '../../../shared/models';
import { formatLongDate, todayLongDate } from '../../lib/dates';
import { birthValue, celebrantName, fullName, printText } from '../../lib/printFields';
import { BlankDateLine, CertificateLogo, DottedField, SerialNumber, SignatureLine } from '../print/CertificateParts';

type Spouse = 'conyuge_1' | 'conyuge_2';

/** Cada fila de la tabla de los cónyuges: qué dato se imprime de cada uno. */
const ROWS: { label: string; value: (record: Marriage, spouse: Spouse) => string }[] = [
  { label: 'Apellidos', value: (m, s) => fullName(m[s].apellido_paterno, m[s].apellido_materno) },
  { label: 'Nombres', value: (m, s) => m[s].nombres },
  { label: 'Lugar de Nacimiento', value: (m, s) => printText(m[s].lugar_nacimiento) },
  // Fecha larga o, si la partida solo trae la edad, "30 años".
  { label: 'Fecha de Nacimiento', value: (m, s) => birthValue(m[s].fecha_nacimiento, m[s].edad) },
  { label: 'Documento de identidad', value: (m, s) => printText(m[s].dni) },
  { label: 'Parroquia de Bautismo', value: (m, s) => printText(m[`${s}_bautismo_parroquia` as const]) },
  { label: 'Fecha de Bautismo', value: (m, s) => formatLongDate(printText(m[`${s}_bautismo_fecha` as const])) },
  { label: 'Padre', value: (m, s) => printText(m[s].padre) },
  { label: 'Madre', value: (m, s) => printText(m[s].madre) },
];

const CELL = 'border border-black px-[2mm] py-[1.2mm] align-middle';
const HEAD = `a4-table-head ${CELL} bg-[#a8a8a8] text-center font-bold`;

export function MarriagePrintView({ record, logo }: { record: Marriage; logo: string | null }) {
  const partida = record.sacramento;
  const testigos = [record.testigo_1, record.testigo_2, record.testigo_3, record.testigo_4];
  const celebrationRows = [
    { label: 'Fecha del Matrimonio:', value: formatLongDate(printText(partida.fecha_evento)) },
    { label: 'Ministro celebrante:', value: celebrantName(partida.ministro) },
    { label: 'Lugar del Matrimonio:', value: printText(record.lugar) },
    // La partida no registra padrinos de matrimonio: se completa a mano.
    { label: 'Padrinos:', value: '' },
    { label: 'Testigos:', value: testigos.filter(Boolean).join(', ') },
  ];

  return (
    <div className="font-sans text-[9.5pt] text-black">
      <header className="grid grid-cols-[40mm_1fr] gap-[4mm]">
        <CertificateLogo logo={logo} />
        <div className="flex flex-col">
          <div className="text-right">
            <SerialNumber />
          </div>
          <h1 className="text-center text-[20pt] leading-tight font-bold">PRELATURA DE AYAVIRI</h1>
          <h2 className="text-center text-[15pt] leading-tight">Constancia de Matrimonio</h2>
          <p className="text-right text-[9pt] font-bold italic">N.A</p>
          <div className="mt-auto flex flex-col gap-[1.5mm]">
            <DottedField
              label="Parroquia:"
              value={printText(partida.parroquia?.nombre)}
              labelClassName="text-[13pt] font-bold"
              valueClassName="text-[10pt] font-bold uppercase"
            />
            <div className="grid grid-cols-3 gap-[3mm]">
              <DottedField label="Libro:" value={partida.libro} valueClassName="text-center font-bold" />
              <DottedField label="Folio:" value={partida.folio} valueClassName="text-center font-bold" />
              <DottedField label="Número:" value={partida.numero} valueClassName="text-center font-bold" />
            </div>
          </div>
        </div>
      </header>

      <p className="mt-[6mm] mb-[2mm]">
        El suscrito Certifica, que en el libro de matrimonios arriba indicado, se encuentra una partida con los siguientes
        datos:
      </p>

      <table className="w-full table-fixed border-collapse">
        <thead>
          <tr>
            <th className={`${HEAD} w-[38%]`}>El Esposo</th>
            <th className={`${HEAD} w-[24%]`}>Datos personales</th>
            <th className={`${HEAD} w-[38%]`}>La Esposa</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map(({ label, value }) => (
            <tr key={label}>
              <td className={`${CELL} font-semibold uppercase`}>{value(record, 'conyuge_1')}</td>
              <td className={`${CELL} text-center`}>{label}</td>
              <td className={`${CELL} font-semibold uppercase`}>{value(record, 'conyuge_2')}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="mt-[5mm] w-full table-fixed border-collapse">
        <thead>
          <tr>
            <th colSpan={2} className={HEAD}>
              Datos del Matrimonio
            </th>
          </tr>
        </thead>
        <tbody>
          {celebrationRows.map((row, index) => (
            <tr key={row.label}>
              <td className={`${CELL} h-[10mm] w-1/2`}>
                <span>{row.label}</span> <span className="font-semibold uppercase">{row.value}</span>
              </td>
              {index === 0 && (
                <td rowSpan={celebrationRows.length} className={`${CELL} align-top`}>
                  <p>Anotaciones marginales</p>
                  <p className="mt-[1mm] text-[9pt] leading-snug break-words whitespace-pre-wrap">{printText(partida.anotaciones)}</p>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-[6mm] grid grid-cols-2 gap-[10mm]">
        <div>
          <p className="leading-snug">
            El suscrito certifica la autenticidad de la firma y sello de la presente constancia de Matrimonio
          </p>
          <BlankDateLine className="mt-[2mm] text-[9pt]" />
        </div>
        <p className="text-right">
          {partida.parroquia?.ubicacion ? `${partida.parroquia.ubicacion}, ` : ''}
          {todayLongDate()}
        </p>
      </div>

      <div className="mt-[14mm] ml-auto w-[70mm]">
        <SignatureLine>Párroco</SignatureLine>
      </div>

      <div className="mt-[4mm] grid grid-cols-[70mm_1fr_1fr] items-end gap-[6mm]">
        <SignatureLine>Notario Eclesiástico</SignatureLine>
        <p className="text-center text-[8pt]">Sello de la Curia</p>
        <p className="text-right text-[8pt]">Sello parroquial</p>
      </div>
    </div>
  );
}
