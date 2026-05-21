'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  openFolder:  ()      => ipcRenderer.invoke('dialog:openFolder'),
  openPath:    (p)     => ipcRenderer.invoke('shell:openPath', p),
  fetchSheet:  (url)   => ipcRenderer.invoke('sheet:fetch', url),
  generate:    (cfg)   => ipcRenderer.invoke('generate:run', cfg),
  onProgress:  (cb) => {
    ipcRenderer.removeAllListeners('generate:progress');
    ipcRenderer.on('generate:progress', (_, data) => cb(data));
  },
});
