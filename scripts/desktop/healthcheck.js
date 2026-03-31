/**
 * Desktop healthcheck script
 * Verifies the local backend is running and healthy
 * 
 * Contract:
 * - Exits 0 when health check returns {ok: true}
 * - Exits 1 when health check fails or returns {ok: false}
 */

import http from 'http';

function main() {
  const port = process.env.PORT || 3001;
  const host = process.env.DESKTOP_BACKEND_HOST || 'localhost';
  const healthUrl = `http://${host}:${port}/api/health`;
  
  console.log(`[desktop:healthcheck] Checking ${healthUrl}...`);
  
  http.get(healthUrl, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const health = JSON.parse(data);
        
        if (res.statusCode === 200 && health.ok) {
          console.log(`[desktop:healthcheck] OK - ${JSON.stringify(health)}`);
          process.exit(0);
        } else {
          console.error(`[desktop:healthcheck] FAILED - Status: ${res.statusCode}, Body: ${data}`);
          process.exit(1);
        }
      } catch (err) {
        console.error(`[desktop:healthcheck] Failed to parse response: ${err.message}`);
        process.exit(1);
      }
    });
  }).on('error', (err) => {
    console.error(`[desktop:healthcheck] Could not connect: ${err.message}`);
    process.exit(1);
  });
}

main();