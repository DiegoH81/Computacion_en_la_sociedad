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
      initialValues={{
        id: 7,
        username: 'ana.quispe',
        rol: 'usuario_parroquia',
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
    it('ofrece las parroquias existentes y la opción de crear una nueva', () => {
      renderCreate();

      const options = screen.getAllByRole('option').map((o) => o.textContent);

      expect(options).toContain('Parroquia 1');
      expect(options).toContain('Parroquia 2');
      expect(options).toContain('+ Crear parroquia nueva…');
    });

    it('no muestra el campo de parroquia nueva hasta elegir esa opción', () => {
      renderCreate();

      expect(screen.queryByLabelText('Nombre de la parroquia nueva')).toBeNull();

      fireEvent.change(screen.getByLabelText('Parroquia'), { target: { value: '__new__' } });

      expect(screen.getByLabelText('Nombre de la parroquia nueva')).toBeInTheDocument();
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

    it('entrega una parroquia nueva con el nombre escrito', () => {
      const { onSave } = renderCreate();

      fireEvent.change(screen.getByLabelText('Parroquia'), { target: { value: '__new__' } });
      type('Nombre de la parroquia nueva', 'Parroquia Nueva');
      submit();

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ parroquia_id: null, parroquia_nueva: 'Parroquia Nueva' }),
        '',
      );
    });

    it('sin elegir parroquia entrega parroquia_id null (el Controller lo rechaza)', () => {
      const { onSave } = renderCreate();

      submit();

      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ parroquia_id: null }), '');
    });

    it('solo ofrece crear administradores si se permite', () => {
      renderCreate();
      expect(screen.queryByLabelText('Tipo de cuenta')).toBeNull();
    });

    it('un administrador no lleva parroquia: se oculta el selector y se entrega parroquia_id null', () => {
      const { onSave } = renderCreate({ canCreateAdmin: true });

      fireEvent.change(screen.getByLabelText('Parroquia'), { target: { value: '2' } });
      fireEvent.change(screen.getByLabelText('Tipo de cuenta'), { target: { value: 'admin' } });

      expect(screen.queryByLabelText('Parroquia')).toBeNull();
      submit();
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ rol: 'admin', parroquia_id: null }), '');
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
