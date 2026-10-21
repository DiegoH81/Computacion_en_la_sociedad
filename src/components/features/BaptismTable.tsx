interface BaptismRow {
  id: number;
  parroquiaId: number;
  parroquiaNombre: string;
  numeroLibro: string;
  numeroFolio: string;
  numeroRegistro: string;
  nombreCompleto: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  estado: 'vigente' | 'anulado';
}

interface BaptismTableProps {
  baptisms: BaptismRow[];
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onEdit: (id: number) => void;
  onPrint: (id: number) => void;
  onAnnul: (id: number) => void;
  onPrintAllResults: () => void;
  canManage: (parroquiaId: number) => boolean;
  isLoading: boolean;
}

export function BaptismTable({
  baptisms,
  currentPage,
  totalPages,
  onPageChange,
  onEdit,
  onPrint,
  onAnnul,
  onPrintAllResults,
  canManage,
  isLoading,
}: BaptismTableProps) {
  if (isLoading) {
    return <p className="p-4 text-sm text-slate-500">Cargando...</p>;
  }

  if (baptisms.length === 0) {
    return <p className="p-4 text-sm text-slate-500">No se encontraron partidas.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onPrintAllResults}
          className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600"
        >
          Imprimir toda la lista
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Parroquia</th>
              <th className="px-4 py-2">Libro</th>
              <th className="px-4 py-2">Folio</th>
              <th className="px-4 py-2">Registro</th>
              <th className="px-4 py-2">Nombres</th>
              <th className="px-4 py-2">Apellido paterno</th>
              <th className="px-4 py-2">Apellido materno</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {baptisms.map((baptism) => {
              const editable = canManage(baptism.parroquiaId);
              return (
                <tr key={baptism.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2">{baptism.parroquiaNombre}</td>
                  <td className="px-4 py-2">{baptism.numeroLibro}</td>
                  <td className="px-4 py-2">{baptism.numeroFolio}</td>
                  <td className="px-4 py-2">{baptism.numeroRegistro}</td>
                  <td className="px-4 py-2">{baptism.nombreCompleto}</td>
                  <td className="px-4 py-2">{baptism.apellidoPaterno}</td>
                  <td className="px-4 py-2">{baptism.apellidoMaterno}</td>
                  <td className="px-4 py-2">
                    <span
                      className={
                        baptism.estado === 'vigente'
                          ? 'rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700'
                          : 'rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700'
                      }
                    >
                      {baptism.estado === 'vigente' ? 'Vigente' : 'Anulado'}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-2">
                      {editable && (
                        <button
                          type="button"
                          onClick={() => onEdit(baptism.id)}
                          className="rounded-md bg-teal-600 px-3 py-1 text-xs font-semibold text-white hover:bg-teal-500"
                        >
                          Editar
                        </button>
                      )}
                      {editable && baptism.estado === 'vigente' && (
                        <button
                          type="button"
                          onClick={() => onAnnul(baptism.id)}
                          className="rounded-md bg-red-700 px-3 py-1 text-xs font-semibold text-white hover:bg-red-600"
                        >
                          Anular
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onPrint(baptism.id)}
                        className="rounded-md bg-blue-700 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-600"
                      >
                        Imprimir
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-center gap-2 text-sm">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="rounded-md px-3 py-1 disabled:opacity-30"
        >
          ← Previous
        </button>
        <span className="text-slate-600">
          Página {currentPage} de {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="rounded-md px-3 py-1 disabled:opacity-30"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
