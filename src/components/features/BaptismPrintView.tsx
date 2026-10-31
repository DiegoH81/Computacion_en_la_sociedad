interface BaptismPrintData {
  parroquiaNombre: string;
  numeroLibro: string;
  numeroFolio: string;
  numeroRegistro: string;
  fechaSacramento: string;
  nombreCompleto: string;
  fechaNacimiento: string;
  lugarNacimiento: string;
  padreNombre: string;
  madreNombre: string;
  fechaBautizo: string;
  celebranteNombreCompleto: string;
  padrino: string;
  madrina: string;
  anotaciones: string;
}

interface BaptismPrintViewProps {
  data: BaptismPrintData;
}

export function BaptismPrintView({ data }: BaptismPrintViewProps) {
  return (
    <div className="mx-auto max-w-2xl bg-white p-8 text-sm text-slate-800 print:p-0">
      <h1 className="mb-1 text-center text-lg font-bold">PRELATURA DE AYAVIRI</h1>
      <p className="mb-4 text-center text-xs text-slate-500">{data.parroquiaNombre}</p>
      <h2 className="mb-4 text-center text-base font-semibold underline">
        CERTIFICADO DE PARTIDA DE BAUTISMO
      </h2>

      <p className="mb-4">
        Libro N° {data.numeroLibro} | Folio N° {data.numeroFolio} | Registro N°{' '}
        {data.numeroRegistro} | Fecha del Sacramento: {data.fechaSacramento}
      </p>

      <h3 className="mb-1 font-semibold">I. DATOS DEL BAUTIZADO</h3>
      <p className="mb-4">
        Nombres: {data.nombreCompleto}
        <br />
        Fecha de nacimiento: {data.fechaNacimiento} | Lugar: {data.lugarNacimiento}
        <br />
        Padre: {data.padreNombre}
        <br />
        Madre: {data.madreNombre}
      </p>

      <h3 className="mb-1 font-semibold">II. DATOS DE LA CELEBRACIÓN</h3>
      <p className="mb-4">
        Fecha del bautizo: {data.fechaBautizo} | Celebrante: {data.celebranteNombreCompleto}
        <br />
        Padrino: {data.padrino}
        <br />
        Madrina: {data.madrina}
      </p>

      {data.anotaciones && (
        <>
          <h3 className="mb-1 font-semibold">III. ANOTACIONES MARGINALES</h3>
          <p className="mb-4">{data.anotaciones}</p>
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
