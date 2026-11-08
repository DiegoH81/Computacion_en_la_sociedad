import { useId, useState } from 'react';
import type { User } from '../../../shared/models';
import type { Role } from '../../../shared/sync';
import { ROLE_LABELS } from '../../lib/permissions';
import { FormDialog } from '../ui/FormDialog';
import { FormPanel } from '../ui/FormPanel';
import { FormInput, FORM_CONTROL_CLASS } from '../ui/FormInput';
import { Field } from '../ui/Field';
import { PasswordInput } from '../ui/PasswordInput';

const EMPTY_USER: User = {
  username: '',
  rol: 'usuario',
  parroquia_id: null,
  nombre: '',
  apellido_paterno: '',
  apellido_materno: '',
};

const ROLE_HELP: Record<Role, string> = {
  admin_general: 'Gestiona parroquias y cuentas, y consulta todas las parroquias. No registra ni modifica partidas.',
  admin_parroquia: 'Registra y corrige las partidas de su parroquia, aprueba los cambios pedidos y crea usuarios. El principal de la parroquia también gestiona a los demás administradores.',
  usuario: 'Registra partidas. En una ya guardada, pide los cambios y un administrador de la parroquia los aprueba.',
};

interface UserFormModalProps {
  mode: 'create' | 'edit';
  parishes: Array<{ id: number; nombre: string }>;
  /** La cuenta que se edita, tal como llegó de Electron. */
  initialValues?: User;
  /** Quién crea la cuenta: el admin general elige rol y parroquia; el de parroquia solo crea usuarios de la suya. */
  actorRole: Role;
  /** La parroquia de quien crea, si es el administrador de una parroquia. */
  actorParishName?: string;
  /** Solo el administrador general principal puede crear otros administradores generales. */
  canCreateGeneralAdmin?: boolean;
  /** El principal de una parroquia también crea administradores de ella; los demás, solo usuarios. */
  canCreateParishAdmin?: boolean;
  /** confirmPassword solo sirve para validar: no es parte de la cuenta. */
  onSave: (user: User, confirmPassword: string) => void;
  onCancel: () => void;
  isLoading: boolean;
  errorMessage: string | null;
}

const LABEL = 'mb-1 block text-xs font-bold text-slate-800';
const SELECT = `w-full px-3 py-1.5 ${FORM_CONTROL_CLASS}`;

export function UserFormModal({
  mode,
  parishes,
  initialValues,
  actorRole,
  actorParishName = '',
  canCreateGeneralAdmin = false,
  canCreateParishAdmin = false,
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

  const parishSelectId = useId();
  const roleSelectId = useId();
  const isGeneralAdminAccount = user.rol === 'admin_general';
  const isGeneralActor = actorRole === 'admin_general';
  const choosesRole = mode === 'create' && (isGeneralActor || canCreateParishAdmin);

  const roles: Role[] = isGeneralActor && canCreateGeneralAdmin ? ['usuario', 'admin_parroquia', 'admin_general'] : ['usuario', 'admin_parroquia'];

  function handleSave() {
    // Al crear: el admin general elige la parroquia; para el de parroquia la pone Electron (la suya).
    // Un administrador general no es de ninguna parroquia.
    const parish =
      mode === 'edit' || actorRole !== 'admin_general'
        ? {}
        : { parroquia_id: isGeneralAdminAccount || !parishSelection ? null : Number(parishSelection) };

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

          {choosesRole ? (
            <div>
              <label htmlFor={roleSelectId} className={LABEL}>
                Tipo de cuenta
              </label>
              <select
                id={roleSelectId}
                value={user.rol}
                onChange={(e) => update({ rol: e.target.value as Role })}
                className={SELECT}
              >
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-600">{ROLE_HELP[user.rol]}</p>
            </div>
          ) : (
            <ReadOnlyField label="Tipo de cuenta" value={ROLE_LABELS[user.rol]} />
          )}

          {mode === 'create' && actorRole === 'admin_general' && !isGeneralAdminAccount && (
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
              </select>
              <p className="mt-1 text-xs text-slate-600">Una parroquia nueva se crea en Configuración → Parroquias.</p>
            </div>
          )}

          {mode === 'create' && actorRole !== 'admin_general' && <ReadOnlyField label="Parroquia" value={actorParishName} />}

          {mode === 'edit' && (
            <ReadOnlyField label="Parroquia" value={isGeneralAdminAccount ? 'Todas (administrador general)' : (user.parroquia_nombre ?? '—')} />
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
// y el otro es una contraseña nueva (con el botón para verla).

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
      <PasswordInput
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="new-password"
        inputClassName={`w-full px-3 py-1.5 ${FORM_CONTROL_CLASS}`}
      />
    </div>
  );
}
