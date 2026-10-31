interface MarriagePrintData {
  parroquiaNombre: string;
  numeroLibro: string;
  numeroFolio: string;
  numeroRegistro: string;
  fechaSacramento: string;
  esposoNombreCompleto: string;
  esposaNombreCompleto: string;
  fechaMatrimonio: string;
  celebranteNombreCompleto: string;
  lugarMatrimonio: string;
  testigos: string[];
  notasMarginales: string;
}

interface MarriagePrintViewProps {
  data: MarriagePrintData;
}

export function MarriagePrintView({ data }: MarriagePrintViewProps) {
  return (
    <div className="mx-auto max-w-2xl bg-white p-8 text-sm text-slate-800 print:p-0">
      <h1 className="mb-1 text-center text-lg font-bold">PRELATURA DE AYAVIRI</h1>
      <p className="mb-4 text-center text-xs text-slate-500">{data.parroquiaNombre}</p>
      <h2 className="mb-4 text-center text-base font-semibold underline">
        CERTIFICADO DE PARTIDA DE MATRIMONIO
      </h2>

      <p className="mb-4">
        Libro N° {data.numeroLibro} | Folio N° {data.numeroFolio} | Registro N°{' '}
        {data.numeroRegistro} | Fecha del Sacramento: {data.fechaSacramento}
      </p>

      <h3 className="mb-1 font-semibold">I. DATOS DE LOS CONTRAYENTES</h3>
      <p className="mb-4">
        Esposo: {data.esposoNombreCompleto}
        <br />
        Esposa: {data.esposaNombreCompleto}
      </p>

      <h3 className="mb-1 font-semibold">II. DATOS DE LA CELEBRACIÓN</h3>
      <p className="mb-4">
        Fecha de matrimonio: {data.fechaMatrimonio} | Celebrante: {data.celebranteNombreCompleto}
        <br />
        Lugar: {data.lugarMatrimonio}
        <br />
        Testigos: {data.testigos.filter(Boolean).join(', ')}
      </p>

      {data.notasMarginales && (
        <>
          <h3 className="mb-1 font-semibold">III. ANOTACIONES MARGINALES</h3>
          <p className="mb-4">{data.notasMarginales}</p>
        </>
      )}

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
