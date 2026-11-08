import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainMenuLayout } from '../components/features/MainMenuLayout';
import { AgeCharts, MinisterChart } from '../components/features/stats/BarCharts';
import { MonthlyChart } from '../components/features/stats/MonthlyChart';
import { RegisterFacts, StatsSummary } from '../components/features/stats/StatsSummary';
import { TrendChart } from '../components/features/stats/TrendChart';
import { SACRAMENT_SERIES } from '../lib/statisticsConfig';
import { StatisticsService, type Statistics } from '../services/StatisticsService';
import { useSessionStore } from '../store/sessionStore';

export function StatisticsPage() {
  const navigate = useNavigate();
  const usuarioNombre = useSessionStore((state) => state.usuarioNombre);
  const parroquiaActivaId = useSessionStore((state) => state.parroquiaActivaId);
  const parroquiaActivaNombre = useSessionStore((state) => state.parroquiaActivaNombre);

  const [selectedYear, setSelectedYear] = useState<number | undefined>();
  const [data, setData] = useState<Statistics | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (parroquiaActivaId === null) return;
    let isCurrent = true;
    StatisticsService.get(parroquiaActivaId, selectedYear)
      .then((result) => {
        if (!isCurrent) return;
        setData(result);
        setErrorMessage(null);
      })
      .catch(() => {
        if (isCurrent) setErrorMessage('No se pudieron calcular las estadísticas.');
      });
    return () => {
      isCurrent = false;
    };
  }, [parroquiaActivaId, selectedYear]);

  // Mientras llega el año elegido se conserva lo anterior atenuado, sin que salte la página.
  const isRefreshing = data !== null && selectedYear !== undefined && data.anio !== selectedYear;
  const yearTotal = data ? SACRAMENT_SERIES.reduce((sum, series) => sum + data.totales[series.key].anio, 0) : 0;

  return (
    <MainMenuLayout
      title="Estadísticas"
      parroquiaActivaNombre={parroquiaActivaNombre ?? ''}
      usuarioNombre={usuarioNombre ?? ''}
      onBack={() => navigate('/dashboard')}
    >
      <div className="flex flex-col gap-4">
        {errorMessage && (
          <p role="alert" className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-solid-red">
            {errorMessage}
          </p>
        )}

        {data && (
          <div className={`flex flex-col gap-4 transition-opacity ${isRefreshing ? 'opacity-50' : ''}`}>
            <StatsSummary data={data} selectedYear={selectedYear ?? data.anio} onYearChange={setSelectedYear} />

            {yearTotal === 0 ? (
              <p className="rounded-xl bg-white p-5 text-sm text-slate-700 shadow-sm">
                No hay partidas vigentes en {data.anio}. Elija otro año para ver sus gráficos.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                  <MonthlyChart data={data.mensual} year={data.anio} />
                  <MinisterChart ministers={data.ministros} year={data.anio} />
                </div>
                <AgeCharts bands={data.bandasEdad} ages={data.edades} />
              </>
            )}

            <TrendChart byYear={data.tendencia} byMonth={data.mensual} year={data.anio} isCurrentYear={data.esAnioActual} />

            <RegisterFacts data={data} />
          </div>
        )}
      </div>
    </MainMenuLayout>
  );
}
