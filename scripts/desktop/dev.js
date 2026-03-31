#!/usr/bin/env node
/**
 * Desktop development runner
 * Starts the Electron app in development mode
 * 
 * Contract:
 * - Exits 0 when Electron window opens successfully
 * - Exits 1 with clear error if Electron is not installed
 * - Exits 1 with clear error if main process fails to start
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

async function buildElectron() {
  const buildScript = path.join(projectRoot, 'scripts/desktop/buildElectron.js');
  
  console.log('[desktop:dev] Building Electron TypeScript...');
  
  return new Promise((resolve, reject) => {
    const build = spawn('node', [buildScript], {
      stdio: 'inherit',
      cwd: projectRoot
    });
    
    build.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Build failed with code ${code}`));
      }
    });
    
    build.on('error', reject);
  });
}

async function main() {
  console.log('[desktop:dev] Starting desktop development...');
  
  // Check if electron is installed
  const electronPath = path.join(projectRoot, 'node_modules', 'electron', 'package.json');
  
  if (!fs.existsSync(electronPath)) {
    console.error('[desktop:dev] Electron is not installed.');
    console.error('Run: npm install electron --save-dev');
    console.error('Note: Electron will be installed in PR03');
    process.exit(1);
  }
  
  // Build electron TypeScript first
  try {
    await buildElectron();
  } catch (err) {
    console.error('[desktop:dev] Failed to build electron:', err.message);
    process.exit(1);
  }
  
  // Start Electron with the compiled main process
  // On Windows, use electron binary directly
  let electronBinary;
  if (process.platform === 'win32') {
    // Try to find the electron executable in node_modules/electron/dist
    electronBinary = path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe');
  } else {
    electronBinary = path.join(projectRoot, 'node_modules', '.bin', 'electron');
  }
  
  const mainPath = path.join(projectRoot, 'dist-electron/main.cjs');
  
  // Check if main.js exists
  if (!fs.existsSync(mainPath)) {
    console.error('[desktop:dev] Electron main process not found:', mainPath);
    process.exit(1);
  }
  
  console.log('[desktop:dev] electronBinary:', electronBinary);
  console.log('[desktop:dev] mainPath:', mainPath);
  
  // Use spawn without shell to run the electron binary directly
  // On Windows, this runs electron.exe directly
  // On Unix, this runs the electron binary
  const electron = spawn(electronBinary, [mainPath], {
    stdio: 'inherit',
    cwd: projectRoot,
    env: { ...process.env, NODE_ENV: 'development' },
    windowsHide: true
  });
  
  electron.on('close', (code) => {
    process.exit(code || 0);
  });
  
  electron.on('error', (err) => {
    console.error('[desktop:dev] Failed to start Electron:', err.message);
    process.exit(1);
  });
}

main().catch((err) => {
  console.error('[desktop:dev] Unexpected error:', err);
  process.exit(1);
});