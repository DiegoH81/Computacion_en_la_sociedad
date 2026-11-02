import { useEffect, useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainMenuLayout } from '../components/features/MainMenuLayout';
import { AgeCharts, MinisterChart } from '../components/features/stats/BarCharts';
import { StatTile } from '../components/features/stats/ChartParts';
import { MonthlyChart } from '../components/features/stats/MonthlyChart';
import { TrendChart } from '../components/features/stats/TrendChart';
import { SACRAMENT_SERIES } from '../lib/statisticsConfig';
import { StatisticsService, type Statistics } from '../services/StatisticsService';
import { useSessionStore } from '../store/sessionStore';

function comparison(current: number, previous: number, year: number, isCurrentYear: boolean): string {
  const period = isCurrentYear ? `el mismo periodo de ${year - 1}` : String(year - 1);
  if (current === previous) return `Igual que ${period}`;
  const difference = current - previous;
  return `${difference > 0 ? '+' : '−'}${Math.abs(difference)} frente a ${period}`;
}

export function StatisticsPage() {
  const navigate = useNavigate();
  const usuarioNombre = useSessionStore((state) => state.usuarioNombre);
  const parroquiaActivaId = useSessionStore((state) => state.parroquiaActivaId);
  const parroquiaActivaNombre = useSessionStore((state) => state.parroquiaActivaNombre);

  const [selectedYear, setSelectedYear] = useState<number | undefined>();
  const [data, setData] = useState<Statistics | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const yearSelectId = useId();

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
          <>
            <div className="flex items-center gap-3">
              <label htmlFor={yearSelectId} className="text-sm font-semibold text-slate-900">
                Año
              </label>
              <select
                id={yearSelectId}
                value={selectedYear ?? data.anio}
                onChange={(event) => setSelectedYear(Number(event.target.value))}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-teal-600"
              >
                {data.anios.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
              <span className="text-xs text-slate-700">Partidas vigentes de {parroquiaActivaNombre}, registradas en esta PC.</span>
            </div>

            <div className={`flex flex-col gap-4 transition-opacity ${isRefreshing ? 'opacity-50' : ''}`}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {SACRAMENT_SERIES.map((series) => {
                  const total = data.totales[series.key];
                  return (
                    <StatTile
                      key={series.key}
                      label={series.label}
                      value={total.anio}
                      testId={`stat-${series.key}`}
                      color={series.color}
                      details={[
                        comparison(total.anio, total.anterior, data.anio, data.esAnioActual),
                        ...(data.esAnioActual ? [`${total.mes} en este mes`] : []),
                        `${total.historico.toLocaleString('es-PE')} en total, todos los años`,
                      ]}
                    />
                  );
                })}
              </div>

              {yearTotal === 0 ? (
                <p className="rounded-xl bg-white p-5 text-sm text-slate-700 shadow-sm">
                  No hay partidas vigentes en {data.anio}. Elija otro año para ver sus gráficos.
                </p>
              ) : (
                <>
                  <MonthlyChart data={data.mensual} year={data.anio} />
                  <AgeCharts bands={data.bandasEdad} ages={data.edades} />
                  <MinisterChart ministers={data.ministros} year={data.anio} />
                </>
              )}

              <TrendChart byYear={data.tendencia} byMonth={data.mensual} year={data.anio} isCurrentYear={data.esAnioActual} />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatTile label="Partidas anuladas" value={data.registro.anuladas} testId="stat-anuladas" details={[`En ${data.anio}`]} />
                <StatTile label="Con nota marginal que corrige datos" value={data.registro.conCorrecciones} details={[`Vigentes, en ${data.anio}`]} />
                <StatTile label="Sin celebrante registrado" value={data.registro.sinCelebrante} details={[`Vigentes, en ${data.anio}`]} />
              </div>
            </div>
          </>
        )}
      </div>
    </MainMenuLayout>
  );
}
