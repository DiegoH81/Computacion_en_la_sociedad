import { todayLongDate } from '../../lib/dates';
import { BlankDateLine, CertificateLogo, DottedField, SerialNumber, SignatureLine } from '../print/CertificateParts';

export interface MarriagePrintSpouse {
  apellidos: string;
  nombres: string;
  lugarNacimiento: string;
  /** Fecha larga o, si la partida solo trae la edad, "30 años". */
  fechaNacimiento: string;
  dni: string;
  parroquiaBautismo: string;
  fechaBautismo: string;
  padre: string;
  madre: string;
}

export interface MarriagePrintData {
  logo: string | null;
  parroquiaNombre: string;
  ubicacion: string;
  numeroLibro: string;
  numeroFolio: string;
  numeroRegistro: string;
  esposo: MarriagePrintSpouse;
  esposa: MarriagePrintSpouse;
  fechaMatrimonio: string;
  celebrante: string;
  lugarMatrimonio: string;
  testigos: string[];
  notasMarginales: string;
}

const ROWS: { label: string; key: keyof MarriagePrintSpouse }[] = [
  { label: 'Apellidos', key: 'apellidos' },
  { label: 'Nombres', key: 'nombres' },
  { label: 'Lugar de Nacimiento', key: 'lugarNacimiento' },
  { label: 'Fecha de Nacimiento', key: 'fechaNacimiento' },
  { label: 'Documento de identidad', key: 'dni' },
  { label: 'Parroquia de Bautismo', key: 'parroquiaBautismo' },
  { label: 'Fecha de Bautismo', key: 'fechaBautismo' },
  { label: 'Padre', key: 'padre' },
  { label: 'Madre', key: 'madre' },
];

const CELL = 'border border-black px-[2mm] py-[1.2mm] align-middle';
const HEAD = `a4-table-head ${CELL} bg-[#a8a8a8] text-center font-bold`;

export function MarriagePrintView({ data }: { data: MarriagePrintData }) {
  const celebrationRows = [
    { label: 'Fecha del Matrimonio:', value: data.fechaMatrimonio },
    { label: 'Ministro celebrante:', value: data.celebrante },
    { label: 'Lugar del Matrimonio:', value: data.lugarMatrimonio },
    // La partida no registra padrinos de matrimonio: se completa a mano.
    { label: 'Padrinos:', value: '' },
    { label: 'Testigos:', value: data.testigos.filter(Boolean).join(', ') },
  ];

  return (
    <div className="font-sans text-[9.5pt] text-black">
      <header className="grid grid-cols-[40mm_1fr] gap-[4mm]">
        <CertificateLogo logo={data.logo} />
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
              value={data.parroquiaNombre}
              labelClassName="text-[13pt] font-bold"
              valueClassName="text-[10pt] font-bold uppercase"
            />
            <div className="grid grid-cols-3 gap-[3mm]">
              <DottedField label="Libro:" value={data.numeroLibro} valueClassName="text-center font-bold" />
              <DottedField label="Folio:" value={data.numeroFolio} valueClassName="text-center font-bold" />
              <DottedField label="Número:" value={data.numeroRegistro} valueClassName="text-center font-bold" />
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
          {ROWS.map(({ label, key }) => (
            <tr key={key}>
              <td className={`${CELL} font-semibold uppercase`}>{data.esposo[key]}</td>
              <td className={`${CELL} text-center`}>{label}</td>
              <td className={`${CELL} font-semibold uppercase`}>{data.esposa[key]}</td>
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
                  <p className="mt-[1mm] text-[9pt] leading-snug break-words whitespace-pre-wrap">{data.notasMarginales}</p>
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
          {data.ubicacion ? `${data.ubicacion}, ` : ''}
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
