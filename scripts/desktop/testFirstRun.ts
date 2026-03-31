/**
 * First-run verification script
 * Tests the bootstrap service for desktop binaries
 * 
 * This script simulates a first-run by:
 * 1. Checking vendor payload exists
 * 2. Running bootstrap to copy binaries
 * 3. Verifying binaries are in app-managed location
 * 4. Testing binary executability
 * 
 * Exit codes:
 * - 0: First-run successful, app is ready
 * - 1: First-run failed, app is blocked
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

// Paths - must match server/services/bootstrap.ts
const VENDOR_BASE = path.join(projectRoot, 'vendor', 'ffmpeg', 'windows-x64-nvenc');
const APP_BINARIES_PATH = path.join(projectRoot, 'binaries');

interface BootstrapManifest {
  version: string;
  platform: string;
  encoder: string;
  description: string;
  files: Array<{
    name: string;
    description: string;
    sha256?: string;
  }>;
}

function log(level: 'info' | 'error' | 'ok', message: string) {
  const prefix = {
    info: '[desktop:test-first-run]',
    error: '[desktop:test-first-run] FAIL',
    ok: '[desktop:test-first-run] OK',
  };
  console.log(`${prefix[level]} ${message}`);
}

function readManifest(): BootstrapManifest | null {
  const manifestPath = path.join(VENDOR_BASE, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  } catch {
    return null;
  }
}

function areBinariesPrepared(): boolean {
  const ffmpegPath = path.join(APP_BINARIES_PATH, 'ffmpeg.exe');
  const ffprobePath = path.join(APP_BINARIES_PATH, 'ffprobe.exe');
  return fs.existsSync(ffmpegPath) && fs.existsSync(ffprobePath);
}

function copyBinary(fileName: string): { success: boolean; error?: string } {
  const sourcePath = path.join(VENDOR_BASE, fileName);
  const destDir = APP_BINARIES_PATH;
  const destPath = path.join(destDir, fileName);

  if (!fs.existsSync(destDir)) {
    try {
      fs.mkdirSync(destDir, { recursive: true });
    } catch (err) {
      return {
        success: false,
        error: `Failed to create binaries directory: ${err instanceof Error ? err.message : 'unknown error'}`,
      };
    }
  }

  try {
    fs.copyFileSync(sourcePath, destPath);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: `Failed to copy ${fileName}: ${err instanceof Error ? err.message : 'unknown error'}`,
    };
  }
}

function testBinaryExecutable(binaryName: string): Promise<{ success: boolean; version?: string; error?: string }> {
  const binaryPath = path.join(APP_BINARIES_PATH, binaryName);
  
  // Quick check: if file is too small, it's likely a placeholder - skip execution test
  const stats = fs.statSync(binaryPath);
  const MIN_REAL_BINARY = 1024 * 1024; // 1MB
  if (stats.size < MIN_REAL_BINARY) {
    return Promise.resolve({ 
      success: false, 
      error: `Binary is too small (${stats.size} bytes) - likely a placeholder, not real FFmpeg` 
    });
  }

  return new Promise<{ success: boolean; version?: string; error?: string }>((resolve) => {
    // Use PowerShell to execute binary - handles Windows paths with spaces better
    // -NoProfile for faster startup, -Command for inline execution
    const child = spawn('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `& "${binaryPath}" -version 2>&1 | Select-Object -First 5`
    ], { 
      shell: false,
      windowsHide: true 
    });
    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      // PowerShell outputs everything to stdout, so check both for version info
      const combinedOutput = stdout + stderr;
      
      // Success if: exit code 0, or we see version info in output
      const hasVersion = combinedOutput.match(/ffmpeg version ([^\s\n\r]+)/i) || 
                         combinedOutput.match(/ffprobe version ([^\s\n\r]+)/i) ||
                         combinedOutput.match(/version ([^\s\n\r]+)/i);
      
      if (code === 0 || hasVersion) {
        const match = combinedOutput.match(/ffmpeg version ([^\s\n\r]+)/i) || 
                      combinedOutput.match(/ffprobe version ([^\s\n\r]+)/i) ||
                      combinedOutput.match(/version ([^\s\n\r]+)/i);
        resolve({ success: true, version: match ? match[1] : 'detected' });
      } else {
        resolve({ success: false, error: stderr || `Exit code: ${code}, Output: ${combinedOutput.substring(0, 200)}` });
      }
    });

    child.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      child.kill();
      resolve({ success: false, error: 'Timeout' });
    }, 10000);
  });
}

async function main() {
  log('info', 'Starting first-run verification...');
  log('info', `Vendor base: ${VENDOR_BASE}`);
  log('info', `App binaries path: ${APP_BINARIES_PATH}`);

  // Step 1: Check vendor payload exists
  log('info', 'Step 1: Checking vendor payload...');
  if (!fs.existsSync(VENDOR_BASE)) {
    log('error', `Vendor directory not found: ${VENDOR_BASE}`);
    process.exit(1);
  }
  log('ok', 'Vendor directory exists');

  // Step 2: Check manifest
  log('info', 'Step 2: Checking manifest...');
  const manifest = readManifest();
  if (!manifest) {
    log('error', 'Manifest not found or invalid');
    process.exit(1);
  }
  log('ok', `Manifest found: ${manifest.version} (${manifest.encoder})`);

  // Step 3: Run bootstrap (copy binaries)
  log('info', 'Step 3: Running bootstrap...');
  for (const file of manifest.files) {
    const result = copyBinary(file.name);
    if (!result.success) {
      log('error', `Failed to copy ${file.name}: ${result.error}`);
      process.exit(1);
    }
    log('ok', `Copied ${file.name}`);
  }

  // Step 4: Verify binaries exist in app location
  log('info', 'Step 4: Verifying binaries in app location...');
  if (!areBinariesPrepared()) {
    log('error', 'Binaries not prepared correctly');
    process.exit(1);
  }
  log('ok', 'Binaries prepared');

  // Step 5: Test executability
  log('info', 'Step 5: Testing binary executability...');
  for (const file of manifest.files) {
    const testResult = await testBinaryExecutable(file.name);
    if (!testResult.success) {
      log('error', `${file.name} failed to execute: ${testResult.error}`);
      process.exit(1);
    }
    log('ok', `${file.name} is executable (version: ${testResult.version})`);
  }

  // All steps passed
  log('info', 'RESULT: First-run verification PASSED');
  log('info', 'App is ready for use');
  process.exit(0);
}

main().catch((err) => {
  log('error', `Unexpected error: ${err.message}`);
  process.exit(1);
});
