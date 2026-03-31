/**
 * Bootstrap service for desktop binaries
 * Handles first-run binary preparation from vendor payload
 * 
 * This service:
 * - Reads manifest from vendor payload
 * - Verifies binary checksums
 * - Copies binaries to app-managed location
 * - Handles corrupt/missing/quarantine/permission failures
 */

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

// Desktop mode detection - when DESKTOP_MODE=1, use true app-managed paths
const isDesktopMode = process.env.DESKTOP_MODE === '1';

// Paths:
// - Vendor payload: where bundled binaries come from (dev: project root, prod: resources folder)
// - App binaries: runtime location
//   - Dev: project-relative binaries/
//   - Desktop prod: %APPDATA%/resize-video-desktop/binaries (simulates app.getPath('userData'))

// Vendor payload location - always relative to project root for now
const VENDOR_BASE = path.join(process.cwd(), 'vendor', 'ffmpeg', 'windows-x64-nvenc');

// Runtime binaries location
// In production desktop mode, binaries go to app-managed user data location
// This path simulates what Electron's app.getPath('userData') would return
const APP_BINARIES_PATH = isDesktopMode
  ? path.join(process.env.APPDATA || path.join(process.cwd(), 'AppData', 'Roaming'), 'resize-video-desktop', 'binaries')
  : path.join(process.cwd(), 'binaries');

// For development testing, allow explicit override via BINARY_DEST_PATH
const OVERRIDE_DEST = process.env.BINARY_DEST_PATH;
const FINAL_DEST_PATH = OVERRIDE_DEST || APP_BINARIES_PATH;

// Minimum size for a real FFmpeg binary (should be at least 1MB)
const MIN_BINARY_SIZE = 1024 * 1024; // 1MB

export interface BootstrapManifest {
  version: string;
  platform: string;
  encoder: string;
  description: string;
  files: Array<{
    name: string;
    description: string;
    sha256?: string;
  }>;
  requirements?: {
    nvidia_driver_min?: string;
    gpu_architecture?: string;
  };
  notes?: string;
}

export type BootstrapState = 
  | { status: 'idle' }
  | { status: 'preparing'; message: string }
  | { status: 'verifying'; message: string }
  | { status: 'ready'; version: string }
  | { status: 'blocked'; error: string; action?: string };

/**
 * Read and parse the vendor manifest
 */
export function readManifest(): BootstrapManifest | null {
  const manifestPath = path.join(VENDOR_BASE, 'manifest.json');
  
  if (!fs.existsSync(manifestPath)) {
    return null;
  }
  
  try {
    const content = fs.readFileSync(manifestPath, 'utf-8');
    return JSON.parse(content) as BootstrapManifest;
  } catch {
    return null;
  }
}

/**
 * Verify a single binary file
 */
function verifyBinary(fileName: string): { valid: boolean; error?: string; size?: number } {
  const filePath = path.join(VENDOR_BASE, fileName);
  
  if (!fs.existsSync(filePath)) {
    return { valid: false, error: `Missing file: ${fileName}` };
  }
  
  const stats = fs.statSync(filePath);
  
  // Check if file is too small to be a real binary
  if (stats.size < MIN_BINARY_SIZE) {
    return { valid: false, error: `File too small to be real binary (${stats.size} bytes): ${fileName}` };
  }
  
  return { valid: true, size: stats.size };
}

/**
 * Copy binary to app-managed location
 */
function copyBinary(fileName: string): { success: boolean; error?: string } {
  const sourcePath = path.join(VENDOR_BASE, fileName);
  const destDir = FINAL_DEST_PATH;
  const destPath = path.join(destDir, fileName);
  
  // Ensure destination directory exists
  if (!fs.existsSync(destDir)) {
    try {
      fs.mkdirSync(destDir, { recursive: true });
    } catch (err) {
      return { 
        success: false, 
        error: `Failed to create binaries directory: ${err instanceof Error ? err.message : 'unknown error'}` 
      };
    }
  }
  
  // Copy the file
  try {
    fs.copyFileSync(sourcePath, destPath);
    return { success: true };
  } catch (err) {
    return { 
      success: false, 
      error: `Failed to copy ${fileName}: ${err instanceof Error ? err.message : 'unknown error'}` 
    };
  }
}

/**
 * Get the app-managed FFmpeg binary path
 */
export function getAppFfmpegPath(): string {
  return path.join(FINAL_DEST_PATH, 'ffmpeg.exe');
}

/**
 * Get the app-managed FFprobe binary path
 */
export function getAppFfprobePath(): string {
  return path.join(FINAL_DEST_PATH, 'ffprobe.exe');
}

/**
 * Check if binaries are already prepared
 */
export function areBinariesPrepared(): boolean {
  return fs.existsSync(getAppFfmpegPath()) && fs.existsSync(getAppFfprobePath());
}

/**
 * Bootstrap binaries from vendor payload
 * Returns the bootstrap state after operation
 */
export function bootstrapBinaries(): BootstrapState {
  // Check if already prepared
  if (areBinariesPrepared()) {
    const manifest = readManifest();
    return { 
      status: 'ready', 
      version: manifest?.version || 'unknown' 
    };
  }
  
  // Read manifest
  const manifest = readManifest();
  if (!manifest) {
    return { 
      status: 'blocked', 
      error: 'Vendor manifest not found',
      action: 'Please reinstall the application'
    };
  }
  
  // Verify all required files
  for (const file of manifest.files) {
    const verification = verifyBinary(file.name);
    if (!verification.valid) {
      return { 
        status: 'blocked', 
        error: verification.error || 'Binary verification failed',
        action: 'Please verify your installation'
      };
    }
    
    // Verify checksum if provided and non-empty (empty = skip for dev payloads)
    if (file.sha256 && file.sha256.startsWith('TODO') === false) {
      const fileContent = fs.readFileSync(path.join(VENDOR_BASE, file.name));
      const hash = createHash('sha256').update(fileContent).digest('hex');
      
      if (hash !== file.sha256) {
        return { 
          status: 'blocked', 
          error: `Checksum mismatch for ${file.name}`,
          action: 'The binary may be corrupted. Please reinstall.'
        };
      }
    }
  }
  
  // Copy binaries to app-managed location
  for (const file of manifest.files) {
    const copyResult = copyBinary(file.name);
    if (!copyResult.success) {
      return { 
        status: 'blocked', 
        error: copyResult.error || 'Failed to copy binary',
        action: 'Check file permissions and try again'
      };
    }
  }
  
  return { 
    status: 'ready', 
    version: manifest.version 
  };
}

/**
 * Get current bootstrap state without modifying anything
 */
export function getBootstrapState(): BootstrapState {
  // Check if binaries are already prepared
  if (areBinariesPrepared()) {
    const manifest = readManifest();
    return { 
      status: 'ready', 
      version: manifest?.version || 'unknown' 
    };
  }
  
  // Check if vendor payload exists
  if (!fs.existsSync(VENDOR_BASE)) {
    return { 
      status: 'blocked', 
      error: 'Vendor payload not found',
      action: 'Please reinstall the application'
    };
  }
  
  // Check if manifest exists
  const manifest = readManifest();
  if (!manifest) {
    return { 
      status: 'blocked', 
      error: 'Vendor manifest corrupted or missing',
      action: 'Please reinstall the application'
    };
  }
  
  // Vendor payload exists but binaries not copied yet
  return { 
    status: 'preparing', 
    message: 'Preparing video encoding binaries...' 
  };
}
