/**
 * Desktop Packaging Script
 * Creates Windows app using electron-builder
 * 
 * This script:
 * - Builds Electron main/preload with esbuild
 * - Builds frontend with Vite
 * - Verifies NVENC vendor payload
 * - Packages with electron-builder (config read from package.json "build")
 * - Outputs unpacked app to release/win-unpacked/
 * 
 * Contract:
 * - Exits 0 on successful packaging
 * - Exits 1 on failure
 */

import * as esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

function log(level: 'info' | 'error' | 'ok', message: string) {
  const prefix = {
    info: '[desktop:package]',
    error: '[desktop:package] FAIL',
    ok: '[desktop:package] OK',
  };
  console.log(`${prefix[level]} ${message}`);
}

async function main() {
  log('info', 'Starting desktop packaging...');
  
  const distElectron = path.join(projectRoot, 'dist-electron');
  const releaseDir = path.join(projectRoot, 'release');
  
  // Step 1: Build Electron TypeScript with esbuild
  log('info', 'Step 1: Building Electron main/preload...');
  
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
  
  log('ok', 'Electron main/preload built');
  
  // Step 2: Build frontend with Vite
  log('info', 'Step 2: Building frontend with Vite...');
  
  const viteCmdFile = process.platform === 'win32'
    ? path.join(projectRoot, 'node_modules', '.bin', 'vite.cmd')
    : path.join(projectRoot, 'node_modules', '.bin', 'vite');
  
  const viteResult = spawnSync(viteCmdFile, ['build'], {
    cwd: projectRoot,
    stdio: 'inherit',
    windowsHide: true,
  });
  
  if (viteResult.status !== 0) {
    log('error', 'Vite build failed');
    process.exit(1);
  }
  
  log('ok', 'Frontend built');
  
  // Step 3: Verify vendor payload
  log('info', 'Step 3: Verifying vendor payload...');
  
  const vendorPath = path.join(projectRoot, 'vendor', 'ffmpeg', 'windows-x64-nvenc');
  const vendorManifest = path.join(vendorPath, 'manifest.json');
  
  if (!fs.existsSync(vendorPath)) {
    log('error', 'Vendor payload directory not found');
    process.exit(1);
  }
  
  if (!fs.existsSync(vendorManifest)) {
    log('error', 'Vendor manifest not found');
    process.exit(1);
  }
  
  log('ok', 'Vendor payload verified');
  
  // Step 4: Run electron-builder
  // Config is read from package.json "build" section
  // "main" field in package.json points to dist-electron/main.cjs
  log('info', 'Step 4: Running electron-builder...');
  
  const ebCmdFile = process.platform === 'win32'
    ? path.join(projectRoot, 'node_modules', '.bin', 'electron-builder.cmd')
    : path.join(projectRoot, 'node_modules', '.bin', 'electron-builder');
  
  if (!fs.existsSync(ebCmdFile)) {
    log('error', 'electron-builder CLI not found. Run: npm install electron-builder');
    process.exit(1);
  }
  
  log('info', 'Running electron-builder --win --x64 ...');
  
  const ebResult = spawnSync(ebCmdFile, ['--win', '--x64'], {
    cwd: projectRoot,
    stdio: 'inherit',
    windowsHide: true,
  });
  
  if (ebResult.status !== 0) {
    log('error', `electron-builder exited with code ${ebResult.status}`);
    process.exit(1);
  }
  
  log('ok', 'Packaging complete');
  
  // List output files
  if (fs.existsSync(releaseDir)) {
    const listDir = (dir: string, indent: string = '') => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          console.log(`${indent}  📁 ${entry.name}/`);
          if (entry.name === 'win-unpacked') {
            // Only list top-level contents of win-unpacked
            const unpackedEntries = fs.readdirSync(fullPath);
            for (const ue of unpackedEntries.slice(0, 10)) {
              const uePath = path.join(fullPath, ue);
              const stats = fs.statSync(uePath);
              if (stats.isFile()) {
                const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
                console.log(`${indent}    - ${ue} (${sizeMB} MB)`);
              } else {
                console.log(`${indent}    📁 ${ue}/`);
              }
            }
          }
        } else {
          const stats = fs.statSync(fullPath);
          const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
          console.log(`${indent}  - ${entry.name} (${sizeMB} MB)`);
        }
      }
    };
    
    console.log('[desktop:package] Output:');
    listDir(releaseDir);
  }
  
  // Verify win-unpacked exists
  const winUnpacked = path.join(releaseDir, 'win-unpacked');
  if (fs.existsSync(winUnpacked)) {
    log('ok', `Unpacked app at: ${winUnpacked}`);
  } else {
    log('error', 'win-unpacked directory not found in release/');
    process.exit(1);
  }
  
  log('ok', 'Desktop packaging SUCCESS');
  process.exit(0);
}

main().catch((err) => {
  log('error', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
