import { useEffect, useState } from 'react';

interface HealthStatus {
  status: 'loading' | 'ok' | 'error';
  message: string;
}

const WORKER_HEALTH_URL = 'http://localhost:8787/api/health';

export function SystemHealthCheck() {
  const [health, setHealth] = useState<HealthStatus>({
    status: 'loading',
    message: 'Consultando al Worker...',
  });

  useEffect(() => {
    fetch(WORKER_HEALTH_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: { status: string; dbCheck: string }) => {
        setHealth({
          status: 'ok',
          message: `Worker: ${data.status} · D1: ${data.dbCheck}`,
        });
      })
      .catch((err: Error) => {
        setHealth({
          status: 'error',
          message: `No se pudo conectar al Worker: ${err.message}`,
        });
      });
  }, []);

  return (
    <div className="rounded-lg border border-slate-300 p-4">
      <p className="text-sm font-medium text-slate-500">Estado del sistema</p>
      <p
        className={
          health.status === 'ok'
            ? 'text-green-600'
            : health.status === 'error'
              ? 'text-red-600'
              : 'text-slate-400'
        }
      >
        {health.message}
      </p>
    </div>
  );
}