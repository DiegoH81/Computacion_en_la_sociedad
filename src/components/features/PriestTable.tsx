interface PriestRow {
  id: number;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  parroquiaNombre: string;
  parroquiaId: number;
  activo: boolean;
}

interface PriestTableProps {
  priests: PriestRow[];
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onEdit: (priestId: number) => void;
  onToggleActive: (priestId: number) => void;
  canManage: (parroquiaId: number) => boolean;
  isLoading: boolean;
}

export function PriestTable({
  priests,
  currentPage,
  totalPages,
  onPageChange,
  onEdit,
  onToggleActive,
  canManage,
  isLoading,
}: PriestTableProps) {
  if (isLoading) {
    return <p className="p-4 text-sm text-slate-500">Cargando...</p>;
  }

  if (priests.length === 0) {
    return <p className="p-4 text-sm text-slate-500">No se encontraron ministros.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Nombre</th>
              <th className="px-4 py-2">Apellido paterno</th>
              <th className="px-4 py-2">Apellido materno</th>
              <th className="px-4 py-2">Parroquia</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {priests.map((priest) => {
              const editable = canManage(priest.parroquiaId);
              return (
                <tr key={priest.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2">{priest.nombre}</td>
                  <td className="px-4 py-2">{priest.apellidoPaterno}</td>
                  <td className="px-4 py-2">{priest.apellidoMaterno}</td>
                  <td className="px-4 py-2">{priest.parroquiaNombre}</td>
                  <td className="px-4 py-2">
                    <span
                      className={
                        priest.activo
                          ? 'rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700'
                          : 'rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-500'
                      }
                    >
                      {priest.activo ? 'Activo' : 'Deshabilitado'}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {editable ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => onEdit(priest.id)}
                          className="rounded-md bg-teal-600 px-3 py-1 text-xs font-semibold text-white hover:bg-teal-500"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleActive(priest.id)}
                          className="rounded-md bg-red-700 px-3 py-1 text-xs font-semibold text-white hover:bg-red-600"
                        >
                          {priest.activo ? 'Deshabilitar' : 'Habilitar'}
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">Solo lectura</span>
                    )}
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
