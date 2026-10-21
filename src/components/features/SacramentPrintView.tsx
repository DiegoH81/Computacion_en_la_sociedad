interface PrintSection {
  title: string;
  lines: string[];
}

interface SacramentPrintViewProps {
  certificateTitle: string; // ej. "CERTIFICADO DE PARTIDA DE BAUTISMO"
  parroquiaNombre: string;
  numeroLibro: string;
  numeroFolio: string;
  numeroRegistro: string;
  fechaSacramento: string;
  sections: PrintSection[];
}

export function SacramentPrintView({
  certificateTitle,
  parroquiaNombre,
  numeroLibro,
  numeroFolio,
  numeroRegistro,
  fechaSacramento,
  sections,
}: SacramentPrintViewProps) {
  return (
    <div className="mx-auto max-w-2xl bg-white p-8 text-sm text-slate-800 print:p-0">
      <h1 className="mb-1 text-center text-lg font-bold">PRELATURA DE AYAVIRI</h1>
      <p className="mb-4 text-center text-xs text-slate-500">{parroquiaNombre}</p>
      <h2 className="mb-4 text-center text-base font-semibold underline">{certificateTitle}</h2>

      <p className="mb-4">
        Libro N° {numeroLibro} | Folio N° {numeroFolio} | Registro N° {numeroRegistro} | Fecha del
        Sacramento: {fechaSacramento}
      </p>

      {sections.map((section, index) => (
        <div key={section.title}>
          <h3 className="mb-1 font-semibold">
            {['I', 'II', 'III', 'IV'][index] ?? index + 1}. {section.title}
          </h3>
          <p className="mb-4">
            {section.lines.map((line, lineIndex) => (
              <span key={lineIndex}>
                {line}
                {lineIndex < section.lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        </div>
      ))}

      <div className="mt-12 flex justify-between text-xs">
        <div className="text-center">
          <div className="mb-1 h-12 w-40 border-b border-slate-400" />
          Firma Responsable
        </div>
        <div className="text-center">
          <div className="mb-1 h-12 w-40 border-b border-slate-400" />
          Sello de la parroquia
        </div>
      </div>
    </div>
  );
}
