import { DescrambledChallenge } from 'bgutils-js';

const { contextBridge, ipcRenderer } = require('electron');
require('./rt/electron-rt');

contextBridge.exposeInMainWorld('electronAPI', {
	generatePoToken: (bgChallenge: DescrambledChallenge, requestKey: string, visitorData: string) =>
		ipcRenderer.invoke('generatePoToken', bgChallenge, requestKey, visitorData),
	setAllowInsecureSSL: async (allow: boolean) => {
		return await ipcRenderer.invoke('setAllowInsecureSSL', allow);
	},
	doUpdateCheck: (disableAutoUpdate) => ipcRenderer.invoke('doUpdateCheck', disableAutoUpdate)
});
