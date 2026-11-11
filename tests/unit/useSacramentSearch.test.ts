import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import type { Baptism } from '../../shared/models';
import { searchSacraments, type SearchResult } from '../../src/controllers/SacramentController';
import { emptyBaptism } from '../../src/lib/emptyRecords';
import { useSacramentSearch } from '../../src/pages/useSacramentSearch';

vi.mock('../../src/controllers/SacramentController', () => ({ searchSacraments: vi.fn() }));
const search = vi.mocked(searchSacraments);

beforeEach(() => {
  search.mockReset();
  search.mockResolvedValue({ success: true, page: { resultados: [], total_paginas: 4 } });
});

it('conserva filtros al paginar, ordenar y recargar; limpiar vuelve a la primera página', async () => {
  const { result } = renderHook(() => useSacramentSearch<Baptism>('bautismo', 1));
  await waitFor(() => expect(result.current.totalPages).toBe(4));
  act(() => result.current.handleSearch({ nombres: 'Ana' }));
  act(() => result.current.setCurrentPage(2));
  act(() => { result.current.setSortBy('apellido_paterno'); result.current.setSortDirection('desc'); });
  act(() => result.current.reload());
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(search).toHaveBeenLastCalledWith('bautismo', {
    nombres: 'Ana', orden: 'apellido_paterno', direccion: 'desc', pagina: 2,
  });
  act(() => result.current.handleClear());
  await waitFor(() => expect(search).toHaveBeenLastCalledWith('bautismo', {
    orden: 'apellido_paterno', direccion: 'desc', pagina: 1,
  }));
});

it('ignora respuestas de búsquedas anteriores aunque lleguen después', async () => {
  let resolveOld!: (value: SearchResult<Baptism>) => void;
  search.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
  const { result } = renderHook(() => useSacramentSearch<Baptism>('bautismo', 1));
  const latest = emptyBaptism('bautismo');
  latest.persona.nombres = 'Resultado actual';
  search.mockResolvedValueOnce({ success: true, page: { resultados: [latest], total_paginas: 1 } });
  act(() => result.current.handleSearch({ nombres: 'Resultado actual' }));
  await waitFor(() => expect(result.current.records).toEqual([latest]));
  await act(async () => resolveOld({ success: false, errorMessage: 'Respuesta antigua' }));
  expect(result.current.records).toEqual([latest]);
  expect(result.current.errorMessage).toBeNull();
});

it('actualiza al cambiar sacramento o parroquia y permite recuperar una búsqueda fallida', async () => {
  search.mockResolvedValueOnce({ success: false, errorMessage: 'Sin conexión' });
  const { result, rerender } = renderHook(
    ({ tipo, parish }: { tipo: 'bautismo' | 'confirmacion'; parish: number }) => useSacramentSearch<Baptism>(tipo, parish),
    { initialProps: { tipo: 'bautismo', parish: 1 } },
  );
  await waitFor(() => expect(result.current.errorMessage).toBe('Sin conexión'));
  rerender({ tipo: 'confirmacion', parish: 2 });
  await waitFor(() => expect(result.current.errorMessage).toBeNull());
  expect(search).toHaveBeenLastCalledWith('confirmacion', { orden: 'nombres', direccion: 'asc', pagina: 1 });
  await waitFor(() => expect(result.current.totalPages).toBe(4));
  const calls = search.mock.calls.length;
  rerender({ tipo: 'confirmacion', parish: 3 });
  await waitFor(() => expect(search.mock.calls.length).toBe(calls + 1));
});
