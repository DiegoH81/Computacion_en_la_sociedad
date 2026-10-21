import { render, screen, waitFor } from '@testing-library/react';
import { SystemHealthCheck } from '../../src/components/features/SystemHealthCheck';

describe('SystemHealthCheck', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('muestra el estado de carga inicialmente', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})), // promesa que nunca resuelve, para capturar el estado inicial
    );

    render(<SystemHealthCheck />);

    expect(screen.getByText('Consultando al Worker...')).toBeInTheDocument();
  });

  it('muestra el estado ok cuando el Worker responde correctamente', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: 'ok', dbCheck: 'ok (seed)' }),
        }),
      ),
    );

    render(<SystemHealthCheck />);

    await waitFor(() => {
      expect(screen.getByText('Worker: ok · D1: ok (seed)')).toBeInTheDocument();
    });
  });

  it('muestra el estado de error cuando el Worker no responde', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('Failed to fetch'))),
    );

    render(<SystemHealthCheck />);

    await waitFor(() => {
      expect(
        screen.getByText('No se pudo conectar al Worker: Failed to fetch'),
      ).toBeInTheDocument();
    });
  });
});