export const LOCAL_REQUEST_CHANNEL = 'local:request';

/** Marca una sesión iniciada sin internet: aún no hay token del servidor. */
export const OFFLINE_TOKEN = 'sin-conexion';

export type LocalResponse =
  | { ok: true; data: unknown }
  | { ok: false; message: string; status: number };

export interface ElectronAPI {
  getAppVersion: () => Promise<string>;
  localRequest: (method: string, payload?: unknown) => Promise<LocalResponse>;
}
