const { contextBridge, ipcRenderer } = require('electron');
require('./rt/electron-rt');

contextBridge.exposeInMainWorld('electronAPI', {
	generatePoToken: (requestKey: string, visitorData: string) =>
		ipcRenderer.invoke('generatePoToken', requestKey, visitorData),
	setAllowInsecureSSL: async (allow: boolean) => {
		return await ipcRenderer.invoke('setAllowInsecureSSL', allow);
	},
	doUpdateCheck: (disableAutoUpdate: boolean) =>
		ipcRenderer.invoke('doUpdateCheck', disableAutoUpdate)
});
