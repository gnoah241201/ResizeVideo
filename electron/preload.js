import { contextBridge, ipcRenderer } from 'electron';

// Expose a safe API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Platform info
  platform: process.platform,
  
  // App version
  getVersion: () => process.versions.electron,
  
  // Invoke IPC for backend communication
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  
  // Listen for events from main process
  on: (channel, callback) => {
    const validChannels = ['backend-ready', 'backend-error', 'update-available'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args));
    }
  },
  
  // Remove event listener
  off: (channel, callback) => {
    ipcRenderer.removeListener(channel, callback);
  },
  
  // Get desktop-specific paths
  getPath: (name) => {
    return ipcRenderer.invoke('get-path', name);
  },
});

console.log('[preload] Preload script loaded');