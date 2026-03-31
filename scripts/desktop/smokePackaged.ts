/**
 * Packaged Desktop Smoke Test
 * Tests the ACTUAL packaged app end-to-end
 * 
 * This script tests:
 * 1. Packaged app exists in release/win-unpacked/
 * 2. Packaged app starts and its embedded backend becomes reachable
 * 3. Health check passes from the packaged runtime
 * 4. Bootstrap state API works from the packaged runtime
 * 
 * IMPORTANT: This script REQUIRES a packaged executable to exist.
 * It does NOT fall back to dev mode - that would defeat the purpose
 * of verifying a packaged app.
 * 
 * Contract:
 * - Exits 0 when all tests pass
 * - Exits 1 on failure or if no packaged executable found
 */

import http from 'http';
import fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

const PORT = process.env.PORT || '3001';
const HOST = 'localhost';
const BASE_URL = `http://${HOST}:${PORT}`;
const AUTH_TOKEN = 'smoke-packaged-test-token';

interface HealthResponse {
  ok: boolean;
  port: number;
  encoder: string;
  isDesktop?: boolean;
  isNvencReady?: boolean;
}

interface BootstrapState {
  status: string;
  version?: string;
  error?: string;
  message?: string;
}

function log(level: 'info' | 'error' | 'ok', message: string) {
  const prefix = {
    info: '[desktop:smoke-packaged]',
    error: '[desktop:smoke-packaged] FAIL',
    ok: '[desktop:smoke-packaged] OK',
  };
  console.log(`${prefix[level]} ${message}`);
}

async function httpGet(httpPath: string): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const req = http.request(`${BASE_URL}${httpPath}`, {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
      timeout: 10000,
    }, (res) => {
      let data = '';
      res.on('data', (chunk: string) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode || 0, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode || 0, body: data });
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
    req.end();
  });
}

// Find packaged app in release/win-unpacked/
function findPackagedExecutable(): string | null {
  const unpackedDir = path.join(projectRoot, 'release', 'win-unpacked');
  
  if (!fs.existsSync(unpackedDir)) {
    log('error', `No win-unpacked directory found at: ${unpackedDir}`);
    return null;
  }
  
  // Look for .exe in win-unpacked directory
  const files = fs.readdirSync(unpackedDir);
  for (const file of files) {
    if (file.endsWith('.exe')) {
      return path.join(unpackedDir, file);
    }
  }
  
  log('error', `No .exe found in: ${unpackedDir}`);
  return null;
}

// Wait for backend to become ready with retries
async function waitForBackend(maxAttempts: number = 20, delayMs: number = 1500): Promise<void> {
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const { status } = await httpGet('/api/health');
      if (status === 200) {
        return;
      }
    } catch {
      // Connection refused - backend not ready yet
    }
    if (i < maxAttempts) {
      log('info', `Waiting for packaged app backend... (attempt ${i}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  throw new Error(`Backend did not become ready after ${maxAttempts} attempts`);
}

async function testHealth(): Promise<void> {
  log('info', 'Testing health endpoint...');
  const { status, body } = await httpGet('/api/health');
  
  if (status !== 200) {
    throw new Error(`Health check failed: status=${status}`);
  }
  
  const health = body as HealthResponse;
  if (!health.ok) {
    throw new Error('Health returned ok=false');
  }
  
  log('ok', `Health OK - encoder: ${health.encoder}, isDesktop: ${health.isDesktop}, isNvencReady: ${health.isNvencReady}`);
}

async function testBootstrapState(): Promise<void> {
  log('info', 'Testing bootstrap state endpoint...');
  const { status, body } = await httpGet('/api/bootstrap/state');
  
  if (status !== 200) {
    throw new Error(`Bootstrap state failed: status=${status}`);
  }
  
  const state = body as BootstrapState;
  log('ok', `Bootstrap state: ${state.status}`);
}

async function main() {
  log('info', 'Starting packaged desktop smoke test...');
  
  // Strict check: packaged executable MUST exist
  const exePath = findPackagedExecutable();
  
  if (!exePath) {
    log('error', 'No packaged executable found in release/win-unpacked/');
    log('error', 'Run "npm run desktop:package" first to create the packaged app');
    log('error', 'Cannot verify packaged app without the actual executable');
    process.exit(1);
  }
  
  log('ok', `Found packaged executable: ${exePath}`);
  
  let appProcess: ChildProcess | null = null;
  
  try {
    // Launch the ACTUAL packaged executable
    // Pass env vars so the embedded backend uses a known port and auth token
    log('info', `Launching packaged app: ${path.basename(exePath)}`);
    
    appProcess = spawn(exePath, [], {
      env: {
        ...process.env,
        PORT,
        DESKTOP_AUTH_TOKEN: AUTH_TOKEN,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    
    appProcess.on('error', (err) => {
      log('error', `Failed to launch packaged app: ${err.message}`);
    });
    
    if (appProcess.stdout) {
      appProcess.stdout.on('data', (data) => {
        const output = data.toString().trim();
        if (output) console.log('[packaged-app]', output);
      });
    }
    
    if (appProcess.stderr) {
      appProcess.stderr.on('data', (data) => {
        const output = data.toString().trim();
        if (output) console.log('[packaged-app:err]', output);
      });
    }
    
    // Wait for the packaged app's backend to become ready
    log('info', 'Waiting for packaged app backend to start...');
    await waitForBackend();
    
    log('ok', 'Packaged app backend is responding');
    
    // Run smoke tests against the REAL packaged app
    await testHealth();
    await testBootstrapState();
    
    log('ok', 'All packaged smoke tests passed');
    log('ok', 'Packaged app verification complete - tested against REAL packaged executable');
    process.exit(0);
    
  } catch (err) {
    log('error', err instanceof Error ? err.message : String(err));
    process.exit(1);
  } finally {
    if (appProcess) {
      // Kill the packaged app tree
      if (process.platform === 'win32' && appProcess.pid) {
        // On Windows, use taskkill to kill the process tree
        spawn('taskkill', ['/pid', String(appProcess.pid), '/T', '/F'], {
          stdio: 'ignore',
          windowsHide: true,
        });
      } else {
        appProcess.kill();
      }
    }
  }
}

main();
