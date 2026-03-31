/**
 * Desktop auth smoke test script
 * Tests that the local backend properly protects API endpoints
 * 
 * Contract:
 * - Exits 0 when auth is properly enforced
 * - Exits 1 when auth is misconfigured or backend is not accessible
 */

import http from 'http';

const PORT = process.env.PORT || '3001';
const HOST = 'localhost';
const BASE_URL = `http://${HOST}:${PORT}`;

interface HttpResult {
  status: number;
  body: string;
}

function httpGet(path: string, authToken?: string): Promise<HttpResult> {
  return new Promise((resolve, reject) => {
    const options: any = {
      hostname: HOST,
      port: parseInt(PORT),
      path: path,
      method: 'GET',
    };
    
    if (authToken) {
      options.headers = {
        'Authorization': `Bearer ${authToken}`,
      };
    }
    
    http.get(options, (res) => {
      let data = '';
      res.on('data', (chunk: string) => { data += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode || 0, body: data });
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('[auth-smoke] Testing local backend auth protection...');
  console.log('[auth-smoke] Backend:', BASE_URL);
  
  // First, check if backend is accessible at all
  console.log('[auth-smoke] Test 0: Health check (backend must be running)...');
  let healthResult: HttpResult;
  try {
    healthResult = await httpGet('/api/health');
  } catch (err: any) {
    console.error('[auth-smoke] FAIL: Cannot connect to backend - is it running?');
    console.error('[auth-smoke] Error:', err.message);
    console.error('[auth-smoke] Make sure backend is running with DESKTOP_MODE=1');
    process.exit(1);
  }
  
  if (healthResult.status !== 200) {
    console.error('[auth-smoke] FAIL: Health check failed, status:', healthResult.status);
    process.exit(1);
  }
  
  let health: { isDesktop?: boolean };
  try {
    health = JSON.parse(healthResult.body);
  } catch {
    console.error('[auth-smoke] FAIL: Invalid health response');
    process.exit(1);
  }
  
  console.log('[auth-smoke] Health OK:', JSON.stringify(health));
  
  // Check if this is actually desktop mode (from backend response, not local env!)
  const isDesktopMode = health.isDesktop === true;
  console.log('[auth-smoke] Desktop mode:', isDesktopMode);
  
  // Test 1: Try to access jobs without auth
  console.log('\n[auth-smoke] Test 1: Access jobs without auth...');
  const noAuthResult = await httpGet('/api/jobs/test-job-123');
  
  if (isDesktopMode) {
    // In desktop mode, should get 401 for missing auth
    if (noAuthResult.status === 401) {
      console.log('[auth-smoke] ✅ PASS: Requests without auth are rejected with 401');
    } else {
      console.error('[auth-smoke] FAIL: Expected 401 in desktop mode, got:', noAuthResult.status);
      console.error('[auth-smoke] Body:', noAuthResult.body);
      process.exit(1);
    }
  } else {
    // Not in desktop mode - auth not enforced
    if (noAuthResult.status === 404) {
      console.log('[auth-smoke] ✅ PASS: Auth not enforced (not desktop mode), got 404 for unknown job');
    } else {
      console.error('[auth-smoke] FAIL: Expected 404 for unknown job, got:', noAuthResult.status);
      process.exit(1);
    }
  }
  
  // Test 2: Try with invalid token
  console.log('\n[auth-smoke] Test 2: Access with invalid token...');
  const invalidAuthResult = await httpGet('/api/jobs/test-job-123', 'invalid-token-12345');
  
  if (isDesktopMode) {
    if (invalidAuthResult.status === 401) {
      console.log('[auth-smoke] ✅ PASS: Invalid token is rejected with 401');
    } else {
      console.error('[auth-smoke] FAIL: Expected 401 for invalid token, got:', invalidAuthResult.status);
      process.exit(1);
    }
  } else {
    // Not in desktop mode
    if (invalidAuthResult.status === 404) {
      console.log('[auth-smoke] ✅ PASS: Auth not enforced (not desktop mode)');
    } else {
      console.error('[auth-smoke] FAIL: Expected 404 for unknown job, got:', invalidAuthResult.status);
      process.exit(1);
    }
  }
  
  console.log('\n[auth-smoke] ✓ All auth smoke tests passed');
  
  if (!isDesktopMode) {
    console.log('[auth-smoke] Note: Tests ran in non-desktop mode - auth protection not active');
  }
  
  process.exit(0);
}

main().catch((err: any) => {
  console.error('[auth-smoke] Unexpected error:', err.message);
  process.exit(1);
});
