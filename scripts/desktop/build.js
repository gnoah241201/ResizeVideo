import * as esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

async function main() {
  console.log('[desktop:build] Starting desktop production build...');
  console.log('[desktop:build] Scope: Compile Electron + Build frontend (no installer in Cluster A)');
  
  // Check if electron is installed
  const electronPath = path.join(projectRoot, 'node_modules', 'electron', 'package.json');
  if (!fs.existsSync(electronPath)) {
    console.error('[desktop:build] FAIL: Electron is not installed.');
    console.error('[desktop:build] Run: npm install electron --save-dev');
    process.exit(1);
  }
  
  // Check if electron-builder is installed (needed for real packaging later)
  let hasElectronBuilder = true;
  try {
    await import('electron-builder');
  } catch {
    hasElectronBuilder = false;
  }
  
  const distElectron = path.join(projectRoot, 'dist-electron');
  
  // Step 1: Build Electron TypeScript
  console.log('[desktop:build] Building Electron main/preload...');
  
  await esbuild.build({
    entryPoints: [path.join(projectRoot, 'electron/main.ts')],
    outfile: path.join(distElectron, 'main.cjs'),
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    external: ['electron'],
    sourcemap: true,
    define: { '__dirname': JSON.stringify(distElectron) }
  });
  
  await esbuild.build({
    entryPoints: [path.join(projectRoot, 'electron/preload.ts')],
    outfile: path.join(distElectron, 'preload.cjs'),
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    external: ['electron'],
    sourcemap: true,
  });
  
  console.log('[desktop:build] Electron main/preload built');
  
  // Step 2: Build frontend using vite
  console.log('[desktop:build] Building frontend with Vite...');
  
  const viteBin = path.join(projectRoot, 'node_modules', '.bin', 'vite');
  
  // On Windows, use cmd /c to run the .cmd file properly
  let viteCmd, viteArgs;
  if (process.platform === 'win32') {
    viteCmd = 'cmd';
    viteArgs = ['/c', viteBin + '.cmd', 'build'];
  } else {
    viteCmd = viteBin;
    viteArgs = ['build'];
  }
  
  const viteResult = spawnSync(viteCmd, viteArgs, {
    cwd: projectRoot,
    stdio: 'inherit'
  });
  
  if (viteResult.status !== 0) {
    console.error('[desktop:build] FAIL: Vite build failed with code', viteResult.status);
    process.exit(1);
  }
  
  console.log('[desktop:build] Frontend built');
  
  // Verify outputs exist
  const mainCjs = path.join(projectRoot, 'dist-electron/main.cjs');
  const preloadCjs = path.join(projectRoot, 'dist-electron/preload.cjs');
  const distIndex = path.join(projectRoot, 'dist/index.html');
  
  if (!fs.existsSync(mainCjs)) {
    console.error('[desktop:build] FAIL: dist-electron/main.cjs not found');
    process.exit(1);
  }
  
  if (!fs.existsSync(preloadCjs)) {
    console.error('[desktop:build] FAIL: dist-electron/preload.cjs not found');
    process.exit(1);
  }
  
  if (!fs.existsSync(distIndex)) {
    console.error('[desktop:build] FAIL: dist/index.html not found (frontend build may have failed)');
    process.exit(1);
  }
  
  console.log('[desktop:build] RESULT: Desktop build artifacts ready');
  console.log('[desktop:build]   - dist-electron/main.cjs');
  console.log('[desktop:build]   - dist-electron/preload.cjs');
  console.log('[desktop:build]   - dist/');
  console.log('[desktop:build] NOTE: Installer packaging comes in Cluster E, not Cluster A.');
  
  if (!hasElectronBuilder) {
    console.log('[desktop:build] NOTE: electron-builder not installed - full packaging not available.');
    console.log('[desktop:build] This is OK for Cluster A - we only needed the build scripts.');
  }
  
  process.exit(0);
}

main();