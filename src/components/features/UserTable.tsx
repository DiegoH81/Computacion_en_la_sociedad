import { Pagination } from '../ui/Pagination';

export interface UserRow {
  id: number;
  username: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  parroquiaNombre: string | null; // null en cuentas admin
  activo: boolean;
}

interface UserTableProps {
  users: UserRow[];
  currentUserId: number | null;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onEdit: (userId: number) => void;
  onToggleActive: (userId: number) => void;
  isLoading: boolean;
}

export function UserTable({
  users,
  currentUserId,
  currentPage,
  totalPages,
  onPageChange,
  onEdit,
  onToggleActive,
  isLoading,
}: UserTableProps) {
  if (isLoading) {
    return <p className="p-4 text-sm text-slate-500">Cargando...</p>;
  }

  if (users.length === 0) {
    return <p className="p-4 text-sm text-slate-500">No se encontraron usuarios.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Usuario</th>
              <th className="px-4 py-2">Nombre</th>
              <th className="px-4 py-2">Apellido paterno</th>
              <th className="px-4 py-2">Apellido materno</th>
              <th className="px-4 py-2">Parroquia</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isOwnAccount = user.id === currentUserId;
              return (
                <tr key={user.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2 font-medium">{user.username}</td>
                  <td className="px-4 py-2">{user.nombre}</td>
                  <td className="px-4 py-2">{user.apellidoPaterno}</td>
                  <td className="px-4 py-2">{user.apellidoMaterno}</td>
                  <td className="px-4 py-2">{user.parroquiaNombre ?? '—'}</td>
                  <td className="px-4 py-2">
                    <span
                      className={
                        user.activo
                          ? 'rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700'
                          : 'rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-500'
                      }
                    >
                      {user.activo ? 'Activo' : 'Deshabilitado'}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onEdit(user.id)}
                        className="rounded-md bg-teal-600 px-3 py-1 text-xs font-semibold text-white hover:bg-teal-500"
                      >
                        Editar
                      </button>
                      {isOwnAccount ? (
                        <span className="text-xs text-slate-400">Tu cuenta</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onToggleActive(user.id)}
                          className="rounded-md bg-red-700 px-3 py-1 text-xs font-semibold text-white hover:bg-red-600"
                        >
                          {user.activo ? 'Deshabilitar' : 'Habilitar'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
      />
    </div>
  );
}
