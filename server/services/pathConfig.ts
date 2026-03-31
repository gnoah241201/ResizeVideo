import path from 'node:path';
import fs from 'node:fs/promises';

// Runtime mode detection - check DESKTOP_MODE env var
const isDesktopRuntime = (): boolean => {
  return process.env.DESKTOP_MODE === '1';
};

// Get app data directory for desktop mode
const getAppDataDir = (): string => {
  if (isDesktopRuntime()) {
    // Use platform-specific app data location
    if (process.platform === 'win32') {
      return path.join(process.env.APPDATA || '', 'ResizeVideo');
    } else if (process.platform === 'darwin') {
      return path.join(process.env.HOME || '', 'Library', 'Application Support', 'ResizeVideo');
    } else {
      return path.join(process.env.HOME || '', '.config', 'ResizeVideo');
    }
  }
  // Fallback when not in desktop mode (web/server mode)
  return process.cwd();
};

// Cache for runtime paths to avoid recalculating
let _cachedPaths: { tempRoot: string; outputRoot: string; stateRoot: string } | null = null;

// Runtime paths - resolved based on mode
export const getRuntimePaths = (): { tempRoot: string; outputRoot: string; stateRoot: string } => {
  // Return cached paths if already computed
  if (_cachedPaths) {
    return _cachedPaths;
  }
  
  const isDesktop = isDesktopRuntime();
  const appData = getAppDataDir();
  
  if (isDesktop) {
    // Desktop: use app-managed directories in userData
    _cachedPaths = {
      tempRoot: path.join(appData, 'temp'),
      outputRoot: path.join(appData, 'output'),
      stateRoot: path.join(appData, 'state'),
    };
  } else {
    // Web/Server: use cwd-based paths for dev compatibility
    _cachedPaths = {
      tempRoot: path.resolve(process.cwd(), 'temp_superpowers', 'native-renders'),
      outputRoot: path.resolve(process.cwd(), 'temp_superpowers', 'native-renders'),
      stateRoot: path.resolve(process.cwd(), 'temp_superpowers', 'native-renders'),
    };
  }
  
  return _cachedPaths;
};

// Export runtime mode helpers
export const getRuntimeMode = (): 'web' | 'desktop' => {
  return isDesktopRuntime() ? 'desktop' : 'web';
};

export const isDesktopMode = (): boolean => {
  return isDesktopRuntime();
};

// Ensure runtime directories exist
export const ensureRuntimePaths = async (): Promise<void> => {
  const paths = getRuntimePaths();
  
  await fs.mkdir(paths.tempRoot, { recursive: true });
  await fs.mkdir(paths.outputRoot, { recursive: true });
  await fs.mkdir(paths.stateRoot, { recursive: true });
  
  console.log('[pathConfig] Runtime paths:', paths);
};
