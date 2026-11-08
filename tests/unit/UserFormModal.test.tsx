import { render, screen, fireEvent } from '@testing-library/react';
import { UserFormModal } from '../../src/components/features/UserFormModal';

const PARISHES = [
  { id: 1, nombre: 'Parroquia 1' },
  { id: 2, nombre: 'Parroquia 2' },
];

function renderCreate(overrides: Partial<Parameters<typeof UserFormModal>[0]> = {}) {
  const onSave = vi.fn();
  const onCancel = vi.fn();
  render(
    <UserFormModal
      mode="create"
      parishes={PARISHES}
      actorRole="admin_general"
      onSave={onSave}
      onCancel={onCancel}
      isLoading={false}
      errorMessage={null}
      {...overrides}
    />,
  );
  return { onSave, onCancel };
}

function renderEdit() {
  const onSave = vi.fn();
  render(
    <UserFormModal
      mode="edit"
      parishes={PARISHES}
      actorRole="admin_general"
      initialValues={{
        id: 7,
        username: 'ana.quispe',
        rol: 'usuario',
        parroquia_id: 2,
        nombre: 'Ana',
        apellido_paterno: 'Quispe',
        apellido_materno: 'Mamani',
        parroquia_nombre: 'Parroquia 2',
      }}
      onSave={onSave}
      onCancel={vi.fn()}
      isLoading={false}
      errorMessage={null}
    />,
  );
  return { onSave };
}

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
}

describe('UserFormModal', () => {
  describe('modo alta', () => {
    it('ofrece las parroquias existentes; una parroquia nueva se crea en otra pantalla', () => {
      renderCreate();

      const options = screen.getAllByRole('option').map((o) => o.textContent);

      expect(options).toContain('Parroquia 1');
      expect(options).toContain('Parroquia 2');
      expect(options.some((option) => option?.includes('nueva'))).toBe(false);
    });

    it('entrega una parroquia existente con su id', () => {
      const { onSave } = renderCreate();

      type('Nombre', 'Ana');
      type('Apellido paterno', 'Quispe');
      type('Nombre de usuario', 'ana.quispe');
      type('Contraseña', 'passwordNueva123');
      type('Repetir contraseña', 'passwordNueva123');
      fireEvent.change(screen.getByLabelText('Parroquia'), { target: { value: '2' } });
      submit();

      expect(onSave).toHaveBeenCalledTimes(1);
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          nombre: 'Ana',
          username: 'ana.quispe',
          password: 'passwordNueva123',
          parroquia_id: 2,
        }),
        'passwordNueva123',
      );
      expect(onSave.mock.calls[0][0]).not.toHaveProperty('parroquia_nueva');
    });

    it('sin elegir parroquia entrega parroquia_id null (el Controller lo rechaza)', () => {
      const { onSave } = renderCreate();

      submit();

      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ parroquia_id: null }), '');
    });

    it('el admin general elige el rol; solo el principal puede crear otro admin general', () => {
      renderCreate();
      const roles = () => Array.from((screen.getByLabelText('Tipo de cuenta') as HTMLSelectElement).options).map((o) => o.value);
      expect(roles()).toEqual(['usuario', 'admin_parroquia']);
    });

    it('un administrador general no lleva parroquia: se oculta el selector y se entrega parroquia_id null', () => {
      const { onSave } = renderCreate({ canCreateGeneralAdmin: true });

      fireEvent.change(screen.getByLabelText('Parroquia'), { target: { value: '2' } });
      fireEvent.change(screen.getByLabelText('Tipo de cuenta'), { target: { value: 'admin_general' } });

      expect(screen.queryByLabelText('Parroquia')).toBeNull();
      submit();
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ rol: 'admin_general', parroquia_id: null }), '');
    });

    it('el administrador de una parroquia solo crea usuarios de la suya: no elige rol ni parroquia', () => {
      const { onSave } = renderCreate({ actorRole: 'admin_parroquia', actorParishName: 'Parroquia 1' });

      expect(screen.getByLabelText('Tipo de cuenta')).toHaveValue('Usuario');
      expect(screen.getByLabelText('Parroquia')).toHaveValue('Parroquia 1');
      submit();
      expect(onSave.mock.calls[0][0]).toMatchObject({ rol: 'usuario' });
      expect(onSave.mock.calls[0][0]).not.toHaveProperty('parroquia_nueva');
    });

    it('el principal de una parroquia elige entre usuario y administrador, sin elegir parroquia', () => {
      const { onSave } = renderCreate({ actorRole: 'admin_parroquia', actorParishName: 'Parroquia 1', canCreateParishAdmin: true });
      const roles = Array.from((screen.getByLabelText('Tipo de cuenta') as HTMLSelectElement).options).map((o) => o.value);

      expect(roles).toEqual(['usuario', 'admin_parroquia']);
      expect(screen.getByLabelText('Parroquia')).toHaveValue('Parroquia 1');
      fireEvent.change(screen.getByLabelText('Tipo de cuenta'), { target: { value: 'admin_parroquia' } });
      submit();
      expect(onSave.mock.calls[0][0]).toMatchObject({ rol: 'admin_parroquia' });
    });

    it('el campo de contraseña oculta lo escrito y evita el autocompletado de contraseñas viejas', () => {
      renderCreate();

      const password = screen.getByLabelText('Contraseña');

      expect(password).toHaveAttribute('type', 'password');
      expect(password).toHaveAttribute('autocomplete', 'new-password');
    });
  });

  describe('modo edición', () => {
    it('precarga nombre y apellidos', () => {
      renderEdit();

      expect(screen.getByLabelText('Nombre')).toHaveValue('Ana');
      expect(screen.getByLabelText('Apellido paterno')).toHaveValue('Quispe');
      expect(screen.getByLabelText('Apellido materno')).toHaveValue('Mamani');
    });

    it('muestra username y parroquia bloqueados', () => {
      renderEdit();

      const username = screen.getByLabelText('Nombre de usuario');
      const parish = screen.getByLabelText('Parroquia');

      expect(username).toHaveValue('ana.quispe');
      expect(username).toBeDisabled();
      expect(parish).toHaveValue('Parroquia 2');
      expect(parish).toBeDisabled();
    });

    it('no ofrece cambiar de parroquia', () => {
      renderEdit();

      expect(screen.queryByRole('option', { name: '+ Crear parroquia nueva…' })).toBeNull();
    });

    it('aclara que la contraseña es opcional y se conserva si se deja vacía', () => {
      renderEdit();

      expect(screen.getByLabelText('Contraseña nueva (opcional)')).toBeInTheDocument();
      expect(screen.getByText('Si deja la contraseña vacía, se conserva la actual.')).toBeInTheDocument();
    });

    it('entrega la contraseña vacía si no se escribe una nueva', () => {
      const { onSave } = renderEdit();

      type('Nombre', 'Ana María');
      submit();

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ id: 7, nombre: 'Ana María', parroquia_id: 2, password: '' }),
        '',
      );
    });
  });

  describe('errores y estado', () => {
    it('muestra el error dentro del modal como alerta', () => {
      renderCreate({ errorMessage: 'Ese nombre de usuario ya existe.' });

      expect(screen.getByRole('alert')).toHaveTextContent('Ese nombre de usuario ya existe.');
    });

    it('no muestra ninguna alerta cuando no hay error', () => {
      renderCreate();

      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('deshabilita los botones y avisa mientras guarda', () => {
      renderCreate({ isLoading: true });

      expect(screen.getByRole('button', { name: 'Guardando...' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    });

    it('Cancelar pide confirmación y solo entonces avisa al padre', () => {
      const { onCancel } = renderCreate();

      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      expect(onCancel).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: 'Seguir editando' }));
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(onCancel).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
      fireEvent.click(screen.getByRole('button', { name: 'Sí, cancelar' }));
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('es un diálogo modal accesible con título', () => {
      renderCreate();

      const dialog = screen.getByRole('dialog');

      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAccessibleName('Añadir nuevo usuario');
    });
  });
});
