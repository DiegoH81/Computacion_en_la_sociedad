export const LOCAL_REQUEST_CHANNEL = 'local:request';

export type LocalResponse =
  | { ok: true; data: unknown }
  | { ok: false; message: string; status: number };

export interface ElectronAPI {
  getAppVersion: () => Promise<string>;
  localRequest: (method: string, payload?: unknown) => Promise<LocalResponse>;
}
