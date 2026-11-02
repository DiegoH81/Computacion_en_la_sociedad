let electron = require("electron");
//#region electron/shared/index.ts
var LOCAL_REQUEST_CHANNEL = "local:request";
//#endregion
//#region electron/preload/index.ts
electron.contextBridge.exposeInMainWorld("electronAPI", {
	getAppVersion: () => electron.ipcRenderer.invoke("app:get-version"),
	localRequest: (method, payload) => electron.ipcRenderer.invoke(LOCAL_REQUEST_CHANNEL, method, payload)
});
//#endregion
