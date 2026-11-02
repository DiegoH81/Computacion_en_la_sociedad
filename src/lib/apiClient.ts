const WORKER_BASE_URL = import.meta.env.VITE_WORKER_URL ?? 'http://localhost:8787';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
}

/**
 * Wrapper delgado sobre fetch: centraliza la URL base del Worker,
 * el manejo de errores HTTP, y la inyección del header Authorization.
 * No contiene lógica de negocio — eso vive en los Services que lo usan.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${WORKER_BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('No se pudo conectar con el servidor. Verifique su conexión.', 0);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message =
      data && typeof data === 'object' && 'message' in data
        ? String((data as { message: unknown }).message)
        : 'Ocurrió un error inesperado.';
    throw new ApiError(message, response.status);
  }

  return data as T;
}
