/**
 * Desktop smoke test script
 * Tests the complete job flow: health, get job status, cancel (with invalid job ID)
 * 
 * Note: Full job flow (create/poll/cancel/download) requires actual video files,
 * so we test the endpoints are reachable with appropriate error responses.
 * 
 * Contract:
 * - Exits 0 when all smoke tests pass
 * - Exits 1 with clear error if any test fails
 */

import http from 'http';

const PORT = process.env.PORT || '3001';
const HOST = process.env.DESKTOP_BACKEND_HOST || 'localhost';
const BASE_URL = `http://${HOST}:${PORT}`;

interface HealthResponse {
  ok: boolean;
  port: number;
  maxConcurrentJobs: number;
  encoder: string;
}

interface JobResponse {
  jobId: string;
  status: string;
}

interface JobStateResponse {
  jobId: string;
  status: string;
  progress?: number;
  error?: string;
}

async function httpGet(path: string): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    http.get(`${BASE_URL}${path}`, (res) => {
      let data = '';
      res.on('data', (chunk: string) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode || 0, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode || 0, body: data });
        }
      });
    }).on('error', reject);
  });
}

async function httpDelete(path: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(`${BASE_URL}${path}`, { method: 'DELETE' }, (res) => {
      let data = '';
      res.on('data', (chunk: string) => { data += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode || 0, body: data });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function testHealth(): Promise<void> {
  console.log('[smoke] Testing /api/health...');
  const { status, body } = await httpGet('/api/health');
  
  if (status !== 200) {
    throw new Error(`Health check failed: status=${status}`);
  }
  
  const health = body as HealthResponse;
  if (!health.ok) {
    throw new Error(`Health check returned ok=false`);
  }
  
  console.log('[smoke] Health OK:', health);
}

async function testGetJobNotFound(): Promise<void> {
  console.log('[smoke] Testing GET /api/jobs/:id with non-existent job...');
  
  // Use a random UUID that definitely doesn't exist
  const fakeJobId = 'smoke-test-' + Date.now();
  const { status, body } = await httpGet(`/api/jobs/${fakeJobId}`);
  
  // Should return 404 - this proves the endpoint is reachable
  if (status === 404) {
    console.log('[smoke] GET /api/jobs/:id correctly returns 404 for unknown job');
  } else {
    throw new Error(`Get job should return 404 for unknown job, got: ${status}, body: ${JSON.stringify(body)}`);
  }
}

async function testCancelNotFound(): Promise<void> {
  console.log('[smoke] Testing DELETE /api/jobs/:id with non-existent job...');
  
  // Use a random UUID that definitely doesn't exist
  const fakeJobId = 'smoke-test-' + Date.now();
  const { status, body } = await httpDelete(`/api/jobs/${fakeJobId}`);
  
  // Should return 404 - this proves the endpoint is reachable
  if (status === 404) {
    console.log('[smoke] DELETE /api/jobs/:id correctly returns 404 for unknown job');
  } else {
    throw new Error(`Cancel job should return 404 for unknown job, got: ${status}, body: ${body}`);
  }
}

async function testJobDownloadNotFound(): Promise<void> {
  console.log('[smoke] Testing GET /api/jobs/:id/download with non-existent job...');
  
  // Use a random UUID that definitely doesn't exist
  const fakeJobId = 'smoke-test-' + Date.now();
  const { status, body } = await httpGet(`/api/jobs/${fakeJobId}/download`);
  
  // Should return 404 - this proves the endpoint is reachable
  if (status === 404) {
    console.log('[smoke] GET /api/jobs/:id/download correctly returns 404 for unknown job');
  } else {
    throw new Error(`Download job should return 404 for unknown job, got: ${status}, body: ${JSON.stringify(body)}`);
  }
}

async function main() {
  console.log('[smoke] Starting desktop smoke test...');
  console.log('[smoke] Backend:', BASE_URL);
  
  try {
    // Test 1: Health check
    await testHealth();
    
    // Test 2: Get job (404 for non-existent job - endpoint works)
    await testGetJobNotFound();
    
    // Test 3: Cancel job (404 for non-existent job - endpoint works)
    await testCancelNotFound();
    
    // Test 4: Download job (404 for non-existent job - endpoint works)
    await testJobDownloadNotFound();
    
    console.log('[smoke] ✓ All smoke tests passed');
    process.exit(0);
  } catch (err) {
    console.error('[smoke] ✗ Smoke test failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
