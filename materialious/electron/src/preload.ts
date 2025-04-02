const { contextBridge, ipcRenderer } = require('electron');
require('./rt/electron-rt');

contextBridge.exposeInMainWorld('electronAPI', {
  generatePoToken: (challengeResponse: any,
    requestKey: string,
    visitorData: string,
    videoId: string) => ipcRenderer.invoke(
      'generatePoToken',
      challengeResponse,
      requestKey,
      visitorData,
      videoId
    )
});