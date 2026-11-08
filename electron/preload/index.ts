import { contextBridge, ipcRenderer } from 'electron';
import { LOCAL_REQUEST_CHANNEL, type ElectronAPI } from '../shared';

const electronAPI: ElectronAPI = {
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),
  localRequest: (method, payload) => ipcRenderer.invoke(LOCAL_REQUEST_CHANNEL, method, payload),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
