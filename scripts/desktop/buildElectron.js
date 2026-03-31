import * as esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// scripts/desktop/buildElectron.js -> scripts/desktop -> project root
const projectRoot = path.resolve(__dirname, '../..');
const distElectron = path.join(projectRoot, 'dist-electron');

async function main() {
  // Compile main process - use outfile to control exact output paths
  await esbuild.build({
    entryPoints: [
      path.join(projectRoot, 'electron/main.ts'),
    ],
    outfile: path.join(distElectron, 'main.cjs'),
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    external: ['electron'],
    sourcemap: true,
    define: {
      '__dirname': JSON.stringify(distElectron)
    }
  });
  
  await esbuild.build({
    entryPoints: [
      path.join(projectRoot, 'electron/preload.ts'),
    ],
    outfile: path.join(distElectron, 'preload.cjs'),
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    external: ['electron'],
    sourcemap: true,
  });
  
  console.log('[electron:build] Built main.ts and preload.ts');
}

main().catch((err) => {
  console.error('[electron:build] Failed:', err);
  process.exit(1);
});