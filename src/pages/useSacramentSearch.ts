import { useEffect, useState } from 'react';
import type { NameColumn, SacramentRecord } from '../../shared/models';
import type { SacramentType } from '../../shared/sync';
import type { SacramentSearchValues } from '../components/features/sacramentSearchValues';
import { searchSacraments } from '../controllers/SacramentController';

/** Lista de partidas: conserva filtros al ordenar, paginar o recargar e ignora respuestas antiguas. */
export function useSacramentSearch<T extends SacramentRecord>(tipo: SacramentType, parroquiaActivaId: number | null) {
  const [records, setRecords] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState<NameColumn>('nombres');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filters, setFilters] = useState<SacramentSearchValues>({});
  // Se incrementa tras guardar o anular para volver a pedir la lista.
  const [reloadCounter, setReloadCounter] = useState(0);

  // Una sola fuente de carga: cualquier cambio de filtros, página, orden o el contador de recarga
  // vuelve a pedir la lista. Así paginar u ordenar no pierde los filtros activos.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setErrorMessage(null);

      const result = await searchSacraments<T>(tipo, { ...filters, orden: sortBy, direccion: sortDirection, pagina: currentPage });

      // Si mientras tanto cambió algún filtro, esta respuesta ya está vieja.
      if (cancelled) return;

      setIsLoading(false);

      if (!result.success || !result.page) {
        setErrorMessage(result.errorMessage ?? 'Error al buscar partidas.');
        return;
      }

      setRecords(result.page.resultados);
      setTotalPages(result.page.total_paginas);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [tipo, filters, currentPage, sortBy, sortDirection, parroquiaActivaId, reloadCounter]);

  function handleSearch(newFilters: SacramentSearchValues) {
    setFilters(newFilters);
    setCurrentPage(1);
  }

  function handleClear() {
    setFilters({});
    setCurrentPage(1);
  }

  return {
    records, isLoading, setIsLoading, errorMessage, setErrorMessage,
    currentPage, setCurrentPage, totalPages, sortBy, setSortBy,
    sortDirection, setSortDirection, handleSearch, handleClear,
    reload: () => setReloadCounter((count) => count + 1),
  };
}
