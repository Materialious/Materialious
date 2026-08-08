const { contextBridge, ipcRenderer } = require('electron');
require('./rt/electron-rt');

contextBridge.exposeInMainWorld('electronAPI', {
	generatePoToken: (requestKey: string, visitorData: string) =>
		ipcRenderer.invoke('generatePoToken', requestKey, visitorData),
	setAllowInsecureSSL: async (allow: boolean) => {
		return await ipcRenderer.invoke('setAllowInsecureSSL', allow);
	},
	doUpdateCheck: (disableAutoUpdate: boolean) =>
		ipcRenderer.invoke('doUpdateCheck', disableAutoUpdate),
	getDownloadFormats: (videoId: string) => ipcRenderer.invoke('getDownloadFormats', videoId),
	downloadVideo: (payload: unknown) => ipcRenderer.invoke('downloadVideo', payload),
	onDownloadProgress: (callback: (videoId: string, progress: number) => void) => {
		ipcRenderer.on('download-progress', (_event: unknown, data: { videoId: string; progress: number }) => {
			callback(data.videoId, data.progress);
		});
	},
	removeDownloadProgressListener: () => {
		ipcRenderer.removeAllListeners('download-progress');
	}
});
