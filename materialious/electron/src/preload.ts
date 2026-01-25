const { contextBridge, ipcRenderer } = require('electron');
require('./rt/electron-rt');

contextBridge.exposeInMainWorld('electronAPI', {
	generatePoToken: (requestKey: string, visitorData: string, challenge: any) =>
		ipcRenderer.invoke('generatePoToken', requestKey, visitorData, challenge),
	setAllowInsecureSSL: async (allow: boolean) => {
		return await ipcRenderer.invoke('setAllowInsecureSSL', allow);
	},
	doUpdateCheck: (disableAutoUpdate: boolean) =>
		ipcRenderer.invoke('doUpdateCheck', disableAutoUpdate)
});
