import { useId, useState } from 'react';
import type { User } from '../../../shared/models';
import { FormDialog } from '../ui/FormDialog';
import { FormPanel } from '../ui/FormPanel';
import { FormInput, FORM_CONTROL_CLASS } from '../ui/FormInput';
import { Field } from '../ui/Field';

const EMPTY_USER: User = {
  username: '',
  rol: 'usuario_parroquia',
  parroquia_id: null,
  nombre: '',
  apellido_paterno: '',
  apellido_materno: '',
};

interface UserFormModalProps {
  mode: 'create' | 'edit';
  parishes: Array<{ id: number; nombre: string }>;
  /** La cuenta que se edita, tal como llegó del Worker. */
  initialValues?: User;
  /** Solo el administrador principal puede crear otros administradores. */
  canCreateAdmin?: boolean;
  /** confirmPassword solo sirve para validar: no es parte de la cuenta. */
  onSave: (user: User, confirmPassword: string) => void;
  onCancel: () => void;
  isLoading: boolean;
  errorMessage: string | null;
}

// Valor reservado del <select> para la opción "crear parroquia nueva".
// No colisiona con ids reales, que son números.
const NEW_PARISH_OPTION = '__new__';

const LABEL = 'mb-1 block text-xs font-bold text-slate-800';
const SELECT = `w-full px-3 py-1.5 ${FORM_CONTROL_CLASS}`;

export function UserFormModal({
  mode,
  parishes,
  initialValues,
  canCreateAdmin = false,
  onSave,
  onCancel,
  isLoading,
  errorMessage,
}: UserFormModalProps) {
  const [user, setUser] = useState<User>(initialValues ?? EMPTY_USER);
  const update = (changes: Partial<User>) => setUser((prev) => ({ ...prev, ...changes }));
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [parishSelection, setParishSelection] = useState<string>('');
  const [newParishName, setNewParishName] = useState('');

  const parishSelectId = useId();
  const roleSelectId = useId();
  const isCreating = parishSelection === NEW_PARISH_OPTION;
  const isAdminAccount = user.rol === 'admin';

  function handleSave() {
    // Al crear se elige una parroquia existente (parroquia_id) o se escribe una nueva (parroquia_nueva).
    // Un administrador no es de ninguna parroquia.
    const parish =
      mode === 'edit'
        ? {}
        : isAdminAccount
          ? { parroquia_id: null }
          : isCreating
            ? { parroquia_id: null, parroquia_nueva: newParishName }
            : { parroquia_id: parishSelection ? Number(parishSelection) : null };

    onSave({ ...user, ...parish, password }, confirmPassword);
  }

  return (
    <FormDialog
      title={mode === 'create' ? 'Añadir nuevo usuario' : 'Editar usuario'}
      onSave={handleSave}
      onCancel={onCancel}
      isLoading={isLoading}
      errorMessage={errorMessage}
      size="medium"
    >
      <div className="grid grid-cols-2 gap-4">
        <FormPanel title="Datos personales">
          <Field variant="panel" label="Nombre" value={user.nombre} onChange={(v) => update({ nombre: v })} />
          <Field
            variant="panel"
            label="Apellido paterno"
            value={user.apellido_paterno}
            onChange={(v) => update({ apellido_paterno: v })}
          />
          <Field
            variant="panel"
            label="Apellido materno"
            value={user.apellido_materno}
            onChange={(v) => update({ apellido_materno: v })}
          />
        </FormPanel>

        <FormPanel title="Cuenta">
          {mode === 'create' ? (
            <Field variant="panel" label="Nombre de usuario" value={user.username} onChange={(v) => update({ username: v })} />
          ) : (
            <ReadOnlyField label="Nombre de usuario" value={user.username} />
          )}

          {mode === 'create' && canCreateAdmin && (
            <div>
              <label htmlFor={roleSelectId} className={LABEL}>
                Tipo de cuenta
              </label>
              <select
                id={roleSelectId}
                value={user.rol}
                onChange={(e) => update({ rol: e.target.value as User['rol'] })}
                className={SELECT}
              >
                <option value="usuario_parroquia">Usuario de parroquia</option>
                <option value="admin">Administrador</option>
              </select>
              {isAdminAccount && (
                <p className="mt-1 text-xs text-slate-600">
                  Un administrador ve todas las parroquias y gestiona cuentas y parroquias.
                </p>
              )}
            </div>
          )}

          {mode === 'create' && isAdminAccount ? null : mode === 'create' ? (
            <div>
              <label htmlFor={parishSelectId} className={LABEL}>
                Parroquia
              </label>
              <select
                id={parishSelectId}
                value={parishSelection}
                onChange={(e) => setParishSelection(e.target.value)}
                className={SELECT}
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
                  <Field variant="panel" label="Nombre de la parroquia nueva" value={newParishName} onChange={setNewParishName} />
                </div>
              )}
            </div>
          ) : (
            <ReadOnlyField
              label="Parroquia"
              value={isAdminAccount ? 'Administrador (todas)' : (user.parroquia_nombre ?? '—')}
            />
          )}

          <PasswordField
            label={mode === 'create' ? 'Contraseña' : 'Contraseña nueva (opcional)'}
            value={password}
            onChange={setPassword}
          />
          <PasswordField label="Repetir contraseña" value={confirmPassword} onChange={setConfirmPassword} />

          {mode === 'edit' && (
            <p className="text-xs text-slate-600">Si deja la contraseña vacía, se conserva la actual.</p>
          )}
        </FormPanel>
      </div>
    </FormDialog>
  );
}

// Campos auxiliares privados: solo tienen sentido dentro de este formulario.
// `Field` genérico (ui/) no sirve para estos dos casos: uno está deshabilitado
// y el otro necesita type="password" con autocomplete de contraseña nueva.

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  const id = useId();

  return (
    <div>
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <FormInput id={id} type="text" value={value} readOnly disabled />
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
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <FormInput
        id={id}
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="new-password"
      />
    </div>
  );
}
