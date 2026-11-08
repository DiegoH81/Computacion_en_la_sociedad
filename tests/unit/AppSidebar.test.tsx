import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppSidebar } from '../../src/components/features/AppSidebar';

const handleLogout = vi.fn(async () => undefined);

vi.mock('../../src/controllers/AuthController', () => ({
  handleLogout: () => handleLogout(),
}));

function renderSidebar() {
  return render(
    <MemoryRouter initialEntries={['/bautismos']}>
      <Routes>
        <Route path="/login" element={<p>Pantalla de login</p>} />
        <Route path="*" element={<AppSidebar />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AppSidebar', () => {
  beforeEach(() => {
    handleLogout.mockClear();
  });

  it('muestra el botón "Cerrar sesión" con su texto dentro del menú lateral', () => {
    renderSidebar();

    const menu = screen.getByRole('navigation', { name: 'Menú lateral', hidden: true });
    const button = within(menu).getByRole('button', { name: 'Cerrar sesión', hidden: true });
    expect(button).toHaveTextContent('Cerrar sesión');
  });

  it('al pulsarlo cierra la sesión y vuelve al login', async () => {
    renderSidebar();

    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú lateral' }));
    const menu = screen.getByRole('navigation', { name: 'Menú lateral' });
    fireEvent.click(within(menu).getByRole('button', { name: 'Cerrar sesión' }));

    await waitFor(() => expect(screen.getByText('Pantalla de login')).toBeInTheDocument());
    expect(handleLogout).toHaveBeenCalledTimes(1);
  });

  it('marca la opción de la pantalla actual', () => {
    renderSidebar();

    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú lateral' }));
    expect(screen.getByRole('button', { name: /Partida de bautismo/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: /Partida de matrimonio/ })).not.toHaveAttribute('aria-current');
  });
});
