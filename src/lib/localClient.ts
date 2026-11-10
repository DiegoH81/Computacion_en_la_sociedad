import type { ElectronAPI } from '../../electron/shared';
import { ApiError } from './apiClient';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export const LOCAL_CHANGE_EVENT = 'prelatura:cambio-local';
const CHANGES_QUEUE = /\.(create|update|annul|restore|toggleActive|review|confirm)$/;

export async function localRequest<T>(method: string, payload?: unknown): Promise<T> {
  const response = await window.electronAPI.localRequest(method, payload);
  if (!response.ok) {
    throw new ApiError(response.message, response.status);
  }
  if (CHANGES_QUEUE.test(method)) window.dispatchEvent(new Event(LOCAL_CHANGE_EVENT));
  return response.data as T;
}
