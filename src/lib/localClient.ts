import type { ElectronAPI } from '../../electron/shared';
import { ApiError } from './apiClient';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

/** Llama a la lógica que corre en Electron sobre la base local. */
export async function localRequest<T>(method: string, payload?: unknown): Promise<T> {
  const response = await window.electronAPI.localRequest(method, payload);
  if (!response.ok) {
    throw new ApiError(response.message, response.status);
  }
  return response.data as T;
}
