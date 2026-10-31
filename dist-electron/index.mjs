let electron = require("electron");
//#region electron/preload/index.ts
electron.contextBridge.exposeInMainWorld("electronAPI", { getAppVersion: () => electron.ipcRenderer.invoke("app:get-version") });
//#endregion
