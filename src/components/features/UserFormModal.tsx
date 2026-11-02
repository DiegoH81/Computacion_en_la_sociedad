import { useId, useState, type FormEvent } from 'react';
import { ConfirmCancelDialog } from '../ui/ConfirmCancelDialog';
import { Field } from '../ui/Field';

export interface UserFormValues {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  username: string; // solo se captura en alta
  password: string; // en edición, vacío = no cambiar
  confirmPassword: string;
  parroquia: // solo se usa en alta
    | { kind: 'existing'; parroquiaId: number | null }
    | { kind: 'new'; nombre: string };
}

interface UserFormModalProps {
  mode: 'create' | 'edit';
  parishes: Array<{ id: number; nombre: string }>;
  initialValues?: {
    nombre: string;
    apellidoPaterno: string;
    apellidoMaterno: string;
    username: string;
    parroquiaNombre: string | null;
  };
  onSave: (values: UserFormValues) => void;
  onCancel: () => void;
  isLoading: boolean;
  errorMessage: string | null;
}

// Valor reservado del <select> para la opción "crear parroquia nueva".
// No colisiona con ids reales, que son números.
const NEW_PARISH_OPTION = '__new__';

export function UserFormModal({
  mode,
  parishes,
  initialValues,
  onSave,
  onCancel,
  isLoading,
  errorMessage,
}: UserFormModalProps) {
  const [nombre, setNombre] = useState(initialValues?.nombre ?? '');
  const [apellidoPaterno, setApellidoPaterno] = useState(initialValues?.apellidoPaterno ?? '');
  const [apellidoMaterno, setApellidoMaterno] = useState(initialValues?.apellidoMaterno ?? '');
  const [username, setUsername] = useState(initialValues?.username ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [parishSelection, setParishSelection] = useState<string>('');
  const [newParishName, setNewParishName] = useState('');
  const [isConfirmingCancel, setIsConfirmingCancel] = useState(false);

  const parishSelectId = useId();
  const isCreating = parishSelection === NEW_PARISH_OPTION;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    onSave({
      nombre,
      apellidoPaterno,
      apellidoMaterno,
      username,
      password,
      confirmPassword,
      parroquia: isCreating
        ? { kind: 'new', nombre: newParishName }
        : { kind: 'existing', parroquiaId: parishSelection ? Number(parishSelection) : null },
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-form-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-lg bg-white shadow-lg">
        <h2
          id="user-form-title"
          className="border-b border-slate-200 px-6 py-4 text-lg font-semibold text-slate-800"
        >
          {mode === 'create' ? 'Añadir nuevo usuario' : 'Editar usuario'}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
          <div className="flex flex-col gap-3 overflow-y-auto px-6 py-4">
            <Field label="Nombre" value={nombre} onChange={setNombre} />
            <Field
              label="Apellido paterno"
              value={apellidoPaterno}
              onChange={setApellidoPaterno}
            />
            <Field
              label="Apellido materno"
              value={apellidoMaterno}
              onChange={setApellidoMaterno}
            />

            {mode === 'create' ? (
              <Field label="Nombre de usuario" value={username} onChange={setUsername} />
            ) : (
              <ReadOnlyField label="Nombre de usuario" value={initialValues?.username ?? ''} />
            )}

            {mode === 'create' ? (
              <div>
                <label
                  htmlFor={parishSelectId}
                  className="mb-1 block text-xs font-medium text-slate-600"
                >
                  Parroquia
                </label>
                <select
                  id={parishSelectId}
                  value={parishSelection}
                  onChange={(e) => setParishSelection(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
                >
                  <option value="" disabled>
                    Seleccione una parroquia
                  </option>
                  {parishes.map((parish) => (
                    <option key={parish.id} value={parish.id}>
                      {parish.nombre}
                    </option>
                  ))}
                  <option value={NEW_PARISH_OPTION}>+ Crear parroquia nueva…</option>
                </select>

                {isCreating && (
                  <div className="mt-2">
                    <Field
                      label="Nombre de la parroquia nueva"
                      value={newParishName}
                      onChange={setNewParishName}
                    />
                  </div>
                )}
              </div>
            ) : (
              <ReadOnlyField
                label="Parroquia"
                value={initialValues?.parroquiaNombre ?? '—'}
              />
            )}

            <PasswordField
              label={mode === 'create' ? 'Contraseña' : 'Contraseña nueva (opcional)'}
              value={password}
              onChange={setPassword}
            />
            <PasswordField
              label="Repetir contraseña"
              value={confirmPassword}
              onChange={setConfirmPassword}
            />

            {mode === 'edit' && (
              <p className="text-xs text-slate-500">
                Si deja la contraseña vacía, se conserva la actual.
              </p>
            )}

            {errorMessage && (
              <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {errorMessage}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
            <button
              type="button"
              onClick={() => setIsConfirmingCancel(true)}
              disabled={isLoading}
              className="rounded-md bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="rounded-md bg-emerald-900 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {isLoading ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>

      {isConfirmingCancel && (
        <ConfirmCancelDialog onConfirm={onCancel} onDismiss={() => setIsConfirmingCancel(false)} />
      )}
    </div>
  );
}

// Campos auxiliares privados: solo tienen sentido dentro de este formulario.
// `Field` genérico (ui/) no sirve para estos dos casos: uno es de solo lectura
// y el otro necesita type="password" con autocomplete de contraseña nueva.

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  const id = useId();

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-slate-600">
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        readOnly
        disabled
        className="w-full rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500"
      />
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-slate-600">
        {label}
      </label>
      <input
        id={id}
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="new-password"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
      />
    </div>
  );
}
