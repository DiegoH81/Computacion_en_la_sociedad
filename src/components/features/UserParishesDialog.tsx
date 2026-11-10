import { useId, useState } from 'react';
import type { User } from '../../../shared/models';
import type { ParishRole } from '../../../shared/sync';
import { ROLE_LABELS } from '../../lib/permissions';
import { FORM_CONTROL_CLASS } from '../ui/FormInput';

// Las parroquias donde trabaja una cuenta. La de origen no cambia; las adicionales las agrega, cambia
// y quita el administrador general. Cada acción se hace en el servidor al momento (necesita internet).

interface UserParishesDialogProps {
  user: User;
  parishes: Array<{ id: number; nombre: string }>;
  onSetParish: (parishId: number, rol: ParishRole) => Promise<string | null>;
  onRemoveParish: (parishId: number) => Promise<string | null>;
  onMakePrincipal: (parishId: number) => Promise<string | null>;
  onClose: () => void;
}

const PARISH_ROLES: ParishRole[] = ['usuario', 'admin_parroquia'];
const SELECT = `px-2 py-1 ${FORM_CONTROL_CLASS}`;
const BUTTON = 'rounded-md px-3 py-1 text-xs font-bold uppercase text-white hover:opacity-90 disabled:opacity-50';

export function UserParishesDialog({ user, parishes, onSetParish, onRemoveParish, onMakePrincipal, onClose }: UserParishesDialogProps) {
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [newParish, setNewParish] = useState('');
  const [newRole, setNewRole] = useState<ParishRole>('usuario');
  const parishSelectId = useId();
  const roleSelectId = useId();

  const additional = user.parroquias_adicionales ?? [];
  const originId = user.parroquia_origen_id ?? user.parroquia_id;
  const originName = parishes.find((parish) => parish.id === originId)?.nombre ?? user.parroquia_nombre ?? '—';
  const taken = new Set([originId, ...additional.map((row) => row.parroquia_id)]);
  const available = parishes.filter((parish) => !taken.has(parish.id));

  async function run(action: () => Promise<string | null>) {
    setIsBusy(true);
    setErrorMessage(null);
    const error = await action();
    setIsBusy(false);
    setErrorMessage(error);
    return error === null;
  }

  async function handleAdd() {
    if (!newParish) return;
    if (await run(() => onSetParish(Number(newParish), newRole))) {
      setNewParish('');
      setNewRole('usuario');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Parroquias de ${user.username}`}
        className="flex max-h-[92vh] w-full max-w-xl flex-col gap-3 rounded-2xl bg-app p-5 shadow-2xl"
      >
        <header className="flex items-center justify-between gap-3 rounded-xl bg-black px-5 py-2">
          <h2 className="font-bold uppercase text-white">Parroquias de {user.username}</h2>
          <button type="button" onClick={onClose} disabled={isBusy} className={`${BUTTON} bg-solid-red`}>
            Cerrar
          </button>
        </header>

        {errorMessage && (
          <p role="alert" className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-solid-red">
            {errorMessage}
          </p>
        )}

        <div className="flex flex-col gap-2 overflow-y-auto rounded-xl bg-white p-4 text-sm text-slate-800">
          <p className="text-xs text-slate-600">
            La cuenta trabaja en cada parroquia con el rol que se indica. Al entrar elige en cuál trabajar; las demás
            solo las consulta. Estos cambios se hacen en el servidor: necesitan internet.
          </p>

          <ul className="flex flex-col divide-y divide-slate-200">
            <li className="flex items-center justify-between gap-2 py-2">
              <span>
                <span className="font-semibold">{originName}</span> <span className="text-xs text-slate-600">(parroquia de origen, no cambia)</span>
              </span>
            </li>

            {additional.map((row) => (
              <li key={row.parroquia_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="font-semibold">
                  {row.parroquia_nombre}
                  {row.principal === 1 && <span className="ml-2 rounded bg-amber-600 px-1.5 py-0.5 text-[10px] uppercase text-white">Principal</span>}
                </span>
                <span className="flex items-center gap-2">
                  <select
                    aria-label={`Rol en ${row.parroquia_nombre}`}
                    value={row.rol}
                    disabled={isBusy || row.principal === 1}
                    onChange={(e) => run(() => onSetParish(row.parroquia_id, e.target.value as ParishRole))}
                    className={SELECT}
                  >
                    {PARISH_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
                  {row.rol === 'admin_parroquia' && row.principal !== 1 && (
                    <button type="button" disabled={isBusy} onClick={() => run(() => onMakePrincipal(row.parroquia_id))} className={`${BUTTON} bg-amber-600`}>
                      Hacer principal
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={isBusy || row.principal === 1}
                    title={row.principal === 1 ? 'Primero pase la marca de principal a otro administrador.' : undefined}
                    onClick={() => run(() => onRemoveParish(row.parroquia_id))}
                    className={`${BUTTON} bg-solid-red`}
                  >
                    Quitar
                  </button>
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-2 flex flex-wrap items-end gap-2 border-t border-slate-200 pt-3">
            <div className="flex flex-col">
              <label htmlFor={parishSelectId} className="mb-1 text-xs font-bold">
                Agregar parroquia
              </label>
              <select id={parishSelectId} value={newParish} onChange={(e) => setNewParish(e.target.value)} disabled={isBusy} className={SELECT}>
                <option value="">Seleccione una parroquia</option>
                {available.map((parish) => (
                  <option key={parish.id} value={parish.id}>
                    {parish.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col">
              <label htmlFor={roleSelectId} className="mb-1 text-xs font-bold">
                Rol
              </label>
              <select id={roleSelectId} value={newRole} onChange={(e) => setNewRole(e.target.value as ParishRole)} disabled={isBusy} className={SELECT}>
                {PARISH_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" onClick={handleAdd} disabled={isBusy || !newParish} className={`${BUTTON} bg-solid-green`}>
              {isBusy ? 'Guardando...' : 'Agregar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
