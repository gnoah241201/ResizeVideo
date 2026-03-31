import { app, BrowserWindow, protocol, net } from 'electron';
import path from 'path';
import { spawn, execSync } from 'child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';

const isDev = process.env.NODE_ENV === 'development';

// Use env token if set (enables smoke testing), otherwise generate a unique session token
const desktopSessionToken = process.env.DESKTOP_AUTH_TOKEN || randomUUID();

// Find NVENC-capable FFmpeg for desktop runtime
function findNvencFfmpeg(): string | null {
  try {
    // Try to find ffmpeg in PATH
    const ffmpegPath = execSync('where ffmpeg 2>nul || which ffmpeg 2>/dev/null', {
      encoding: 'utf-8',
      timeout: 5000,
    }).trim().split('\n')[0];
    
    if (!ffmpegPath) return null;
    
    // Check if it supports NVENC
    const encoders = execSync(`"${ffmpegPath}" -hide_banner -encoders 2>&1`, {
      encoding: 'utf-8',
      timeout: 10000,
    });
    
    if (encoders.includes('h264_nvenc')) {
      console.log('[main] Found NVENC-capable FFmpeg:', ffmpegPath);
      return ffmpegPath;
    }
  } catch {
    // FFmpeg not in PATH or doesn't support NVENC
  }
  return null;
}

// __dirname will be defined at build time to the dist-electron directory

let mainWindow = null;
let backendProcess = null;
let nvencFfmpegPath: string | null = null;

// Start the Express backend
async function startBackend() {
  console.log('[main] Starting local backend...');
  
  const port = process.env.PORT || '3001';
  
  // In desktop mode, try to find NVENC-capable FFmpeg
  const desktopEnv: Record<string, string> = {
    ...process.env,
    PORT: port,
    NODE_ENV: isDev ? 'development' : 'production',
    DESKTOP_MODE: '1',  // Flag to enable desktop-safe paths
    DESKTOP_AUTH_TOKEN: desktopSessionToken,  // Auth token for local API
  };
  
  // Try to find NVENC FFmpeg for desktop runtime
  nvencFfmpegPath = findNvencFfmpeg();
  if (nvencFfmpegPath) {
    desktopEnv.FFMPEG_BINARY_PATH = nvencFfmpegPath;
    desktopEnv.FFMPEG_ENCODER = 'h264_nvenc';
    console.log('[main] Desktop mode: using NVENC FFmpeg at', nvencFfmpegPath);
  } else {
    console.warn('[main] Desktop mode: NVENC FFmpeg not found in PATH');
    console.warn('[main] Desktop mode may fail if bundled FFmpeg lacks NVENC support');
  }
  
  // Start the backend server using tsx
  // Pass DESKTOP_MODE=1 and session token to indicate desktop runtime
  backendProcess = spawn('node', ['--import', 'tsx', 'server/index.ts'], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    env: desktopEnv,
  });
  
  backendProcess.on('error', (err) => {
    console.error('[main] Backend failed to start:', err.message);
    mainWindow?.webContents.send('backend-error', err.message);
  });
  
  backendProcess.on('close', (code) => {
    console.log('[main] Backend exited with code:', code);
  });
  
  // Wait for backend to be ready
  await new Promise((resolve) => {
    setTimeout(resolve, 2000);
  });
  
  // Notify renderer that backend is ready with the session token
  mainWindow?.webContents.on('did-finish-load', () => {
    mainWindow?.webContents.send('backend-ready', { port, token: desktopSessionToken });
  });
  
  console.log('[main] Backend started on port', port);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
    show: false,
  });

  // Show window when ready to avoid flicker
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Load the app
  if (isDev) {
    // In development, load from Vite dev server
    mainWindow.loadURL('http://localhost:3000').catch((err) => {
      console.error('[main] Failed to load dev URL:', err.message);
      // Fall back to loading from dist
      mainWindow?.loadFile(path.join(__dirname, '../dist/index.html'));
    });
    // Open DevTools in development
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load from built files
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('[main] Uncaught exception:', error);
  app.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[main] Unhandled rejection:', reason);
});

app.whenReady().then(async () => {
  console.log('[main] Starting desktop app...');
  
  // Register custom protocol for loading local files
  protocol.registerFileProtocol('local-file', (request, callback) => {
    const filePath = request.url.replace('local-file://', '');
    callback({ path: decodeURIComponent(filePath) });
  });
  
  // Start the backend
  await startBackend();
  
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Kill backend when window closes
  if (backendProcess) {
    backendProcess.kill();
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});