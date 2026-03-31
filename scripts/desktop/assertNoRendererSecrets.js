/**
 * Desktop assert no renderer secrets script
 * Verifies that the built renderer bundle does not contain sensitive environment variables
 * 
 * Contract:
 * - Exits 0 when no secrets are found in the bundle
 * - Exits 1 when secrets are detected or bundle is missing
 */

import fs from 'node:fs';
import path from 'path';

const DIST_DIR = path.join(process.cwd(), 'dist');

// Secrets that should NOT be in the renderer bundle
const FORBIDDEN_PATTERNS = [
  'GEMINI_API_KEY',
  'GOOGLE_API_KEY',
  'apiKey',
  'AIza',  // Google API key prefix
];

function findBundleFile() {
  const assetsDir = path.join(DIST_DIR, 'assets');
  
  if (!fs.existsSync(assetsDir)) {
    return null;
  }
  
  const files = fs.readdirSync(assetsDir);
  const jsFiles = files.filter(f => f.startsWith('index-') && f.endsWith('.js'));
  
  if (jsFiles.length === 0) {
    return null;
  }
  
  return path.join(assetsDir, jsFiles[0]);
}

function main() {
  console.log('[assert-no-renderer-secrets] Checking renderer bundle for secrets...');
  
  // Check if dist directory exists
  if (!fs.existsSync(DIST_DIR)) {
    console.error('[assert-no-renderer-secrets] ERROR: dist directory not found. Run "npm run build" first.');
    process.exit(1);
  }
  
  // Find the bundle file
  const bundleFile = findBundleFile();
  
  if (!bundleFile) {
    console.error('[assert-no-renderer-secrets] ERROR: Could not find bundle file in dist/assets');
    process.exit(1);
  }
  
  console.log('[assert-no-renderer-secrets] Checking file:', path.basename(bundleFile));
  
  // Read the bundle content
  const bundleContent = fs.readFileSync(bundleFile, 'utf-8');
  
  // Check for forbidden patterns
  const foundSecrets = [];
  
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (bundleContent.includes(pattern)) {
      foundSecrets.push(pattern);
    }
  }
  
  if (foundSecrets.length > 0) {
    console.error('[assert-no-renderer-secrets] ERROR: Found forbidden patterns in bundle:', foundSecrets.join(', '));
    console.error('[assert-no-renderer-secrets] The renderer bundle should not contain secrets!');
    process.exit(1);
  }
  
  console.log('[assert-no-renderer-secrets] PASS: No secrets found in renderer bundle');
  process.exit(0);
}

main();
