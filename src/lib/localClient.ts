import type { ElectronAPI } from '../../electron/shared';
import { ApiError } from './apiClient';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

/** Avisa que cambió algo por subir, para que el indicador de sincronización no espere a su próxima revisión. */
export const LOCAL_CHANGE_EVENT = 'prelatura:cambio-local';
const CHANGES_QUEUE = /\.(create|update|annul|toggleActive)$/;

/** Llama a la lógica que corre en Electron sobre la base local. */
export async function localRequest<T>(method: string, payload?: unknown): Promise<T> {
  const response = await window.electronAPI.localRequest(method, payload);
  if (!response.ok) {
    throw new ApiError(response.message, response.status);
  }
  if (CHANGES_QUEUE.test(method)) window.dispatchEvent(new Event(LOCAL_CHANGE_EVENT));
  return response.data as T;
}
