require('./rt/electron-rt');
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  generatePoToken: () => ipcRenderer.invoke('generate-po-token')
});
