import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronAPI } from '../shared/ipc-types';

const electronAPI: ElectronAPI = {
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);