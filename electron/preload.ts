import { contextBridge, ipcRenderer } from 'electron';

// Store session token received from main process
let sessionToken: string | null = null;

// Expose a safe API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Platform info
  platform: process.platform,
  
  // App version
  getVersion: () => process.versions.electron,
  
  // Store session token for API auth
  setSessionToken: (token: string) => {
    sessionToken = token;
  },
  
  // Get session token
  getSessionToken: () => sessionToken,
  
  // Check if running in desktop mode
  isDesktopMode: () => process.env.NODE_ENV !== 'development',
  
  // Invoke IPC for backend communication
  invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
  
  // Listen for events from main process
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const validChannels = ['backend-ready', 'backend-error', 'update-available'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args));
    }
  },
  
  // Remove event listener
  off: (channel: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.removeListener(channel, callback);
  },
  
  // Get desktop-specific paths
  getPath: (name: 'userData' | 'appData' | 'temp' | 'documents') => {
    return ipcRenderer.invoke('get-path', name);
  },
});

console.log('[preload] Preload script loaded');