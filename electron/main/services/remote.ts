import { ServiceError } from './common';

const WORKER_BASE_URL =
  process.env.PRELATURA_API_URL ?? import.meta.env.VITE_WORKER_URL ?? 'http://localhost:8787';

const DEFAULT_TIMEOUT_MS = 30_000;

export interface RemoteOptions {
  method?: 'GET' | 'POST' | 'PUT';
  body?: unknown;
  token?: string;
  timeoutMs?: number;
}

export type RemoteRequest = <T>(path: string, options?: RemoteOptions) => Promise<T>;

const CONNECTION_ERROR = 'No se pudo conectar con el servidor. Verifique su conexión.';

export const remoteRequest: RemoteRequest = async <T>(path: string, options: RemoteOptions = {}): Promise<T> => {
  const { method = 'GET', body, token, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  let response: Response;
  let data: { message?: unknown } | null;
  try {
    response = await fetch(`${WORKER_BASE_URL}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    data = (await response.json().catch(() => null)) as { message?: unknown } | null;
  } catch {
    throw new ServiceError(CONNECTION_ERROR, 0);
  }

  if (!response.ok) {
    throw new ServiceError(data?.message ? String(data.message) : 'Ocurrió un error inesperado.', response.status);
  }
  
  if (data === null) {
    throw new ServiceError(CONNECTION_ERROR, 0);
  }
  return data as T;
};

export function isConnectivityError(error: unknown): boolean {
  return error instanceof ServiceError && (error.status === 0 || error.status >= 500);
}
