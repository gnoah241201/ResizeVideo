/**
 * Vendor payload verification script
 * Verifies NVENC payload artifacts are present and valid
 * 
 * Contract:
 * - Exits 0 when vendor payload is valid and binaries are real
 * - Exits 1 with clear error if payload is missing, invalid, or contains only placeholders
 * 
 * Expected structure:
 * vendor/ffmpeg/windows-x64-nvenc/
 *   - ffmpeg.exe (real binary, not placeholder)
 *   - ffprobe.exe (real binary, not placeholder)
 *   - manifest.json
 * 
 * Note: This script checks for the PRESENCE of real binaries, not just files.
 * Placeholder files (empty or <1KB) are treated as missing.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');
const vendorBase = path.join(projectRoot, 'vendor/ffmpeg/windows-x64-nvenc');

// Minimum size for a real FFmpeg binary (should be at least 1MB)
const MIN_BINARY_SIZE = 1024 * 1024; // 1MB

function verifyFileExistsAndIsReal(fileEntry) {
  const filePath = path.join(vendorBase, fileEntry.name);
  
  if (!fs.existsSync(filePath)) {
    return { valid: false, error: `Missing file: ${fileEntry.name}` };
  }
  
  const stats = fs.statSync(filePath);
  
  // Check if file is too small to be a real binary
  if (stats.size < MIN_BINARY_SIZE) {
    return { valid: false, error: `File too small to be real binary (${stats.size} bytes): ${fileEntry.name}. This is likely a placeholder.` };
  }
  
  // If sha256 is provided, verify it
  if (fileEntry.sha256) {
    const fileContent = fs.readFileSync(filePath);
    const hash = createHash('sha256').update(fileContent).digest('hex');
    
    if (hash !== fileEntry.sha256) {
      return { valid: false, error: `Checksum mismatch for ${fileEntry.name}: expected ${fileEntry.sha256}, got ${hash}` };
    }
  }
  
  return { valid: true, size: stats.size };
}

function main() {
  console.log('[desktop:verify-vendor-payload] Verifying NVENC payload...');
  console.log('[desktop:verify-vendor-payload] Minimum binary size required:', MIN_BINARY_SIZE, 'bytes');
  
  // Check if vendor directory exists
  if (!fs.existsSync(vendorBase)) {
    console.error('[desktop:verify-vendor-payload] FAIL: Vendor directory not found:', vendorBase);
    console.error('[desktop:verify-vendor-payload] The NVENC payload has not been prepared yet.');
    console.error('[desktop:verify-vendor-payload] Cluster A only defines the CONTRACT - actual payload will be added later.');
    process.exit(1);
  }
  
  // Check for manifest.json
  const manifestPath = path.join(vendorBase, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error('[desktop:verify-vendor-payload] FAIL: manifest.json not found');
    process.exit(1);
  }
  
  // Read and validate manifest
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  } catch (err) {
    console.error('[desktop:verify-vendor-payload] FAIL: Invalid manifest.json:', err.message);
    process.exit(1);
  }
  
  // Validate manifest structure
  const required = ['version', 'platform', 'encoder', 'files'];
  for (const field of required) {
    if (!manifest[field]) {
      console.error(`[desktop:verify-vendor-payload] FAIL: Missing required field in manifest: ${field}`);
      process.exit(1);
    }
  }
  
  if (manifest.platform !== 'windows-x64') {
    console.error(`[desktop:verify-vendor-payload] FAIL: Platform mismatch - expected windows-x64, got: ${manifest.platform}`);
    process.exit(1);
  }
  
  if (manifest.encoder !== 'nvenc') {
    console.error(`[desktop:verify-vendor-payload] FAIL: Encoder mismatch - expected nvenc, got: ${manifest.encoder}`);
    process.exit(1);
  }
  
  console.log('[desktop:verify-vendor-payload] Manifest validated. Checking files...');
  
  // Verify all files listed in manifest exist and are real binaries
  let allFilesValid = true;
  for (const file of manifest.files) {
    const result = verifyFileExistsAndIsReal(file);
    
    if (!result.valid) {
      console.error(`[desktop:verify-vendor-payload] FAIL: ${result.error}`);
      allFilesValid = false;
    } else {
      console.log(`[desktop:verify-vendor-payload] OK: ${file.name} (${result.size} bytes)`);
    }
  }
  
  if (!allFilesValid) {
    console.error('[desktop:verify-vendor-payload] RESULT: Payload verification FAILED');
    console.error('[desktop:verify-vendor-payload] The NVENC payload binaries are missing or are placeholders.');
    console.error('[desktop:verify-vendor-payload] Cluster A defines the CONTRACT only - real payload comes later.');
    process.exit(1);
  }
  
  console.log('[desktop:verify-vendor-payload] RESULT: NVENC payload is valid and complete');
  console.log(`[desktop:verify-vendor-payload] Version: ${manifest.version}`);
  console.log(`[desktop:verify-vendor-payload] Files: ${manifest.files.length}`);
  process.exit(0);
}

main();