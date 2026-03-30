import express from 'express';
import { buildJobsRouter } from './routes/jobs';
import { JobQueueService } from './services/jobQueue';
import { getEncoderConfig, getFfmpegPath } from './services/encoderConfig';
import { setEncoder } from './services/renderRunner';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import fs from 'node:fs';

// Validate environment variables at startup
const PORT_ENV = process.env.PORT;
const MAX_JOBS_ENV = process.env.MAX_CONCURRENT_JOBS;

const port = PORT_ENV ? Number(PORT_ENV) : 3001;
const maxConcurrentJobs = MAX_JOBS_ENV ? Number(MAX_JOBS_ENV) : 2;

// Startup validation
if (PORT_ENV && isNaN(port)) {
  console.error(`ERROR: Invalid PORT value "${PORT_ENV}". PORT must be a number.`);
  process.exit(1);
}

if (MAX_JOBS_ENV && isNaN(maxConcurrentJobs)) {
  console.error(`ERROR: Invalid MAX_CONCURRENT_JOBS value "${MAX_JOBS_ENV}". MAX_CONCURRENT_JOBS must be a number.`);
  process.exit(1);
}

if (maxConcurrentJobs < 1) {
  console.error(`ERROR: MAX_CONCURRENT_JOBS must be at least 1. Got: ${maxConcurrentJobs}`);
  process.exit(1);
}

// Validate FFmpeg availability (using unified path from encoderConfig)
const ffmpegPath = getFfmpegPath();
const ffprobePath = ffprobeInstaller.path;

try {
  fs.accessSync(ffmpegPath);
} catch {
  console.error(`ERROR: FFmpeg not found at "${ffmpegPath}".`);
  console.error('This may happen if npm install failed to download FFmpeg binaries.');
  console.error('Try running: npm install @ffmpeg-installer/ffmpeg @ffprobe-installer/ffprobe');
  console.error('As a fallback, you can install FFmpeg manually on your system:');
  console.error('  macOS: brew install ffmpeg');
  console.error('  Ubuntu/Debian: sudo apt install ffmpeg');
  console.error('  Windows: Download from https://ffmpeg.org/download.html');
  process.exit(1);
}

try {
  fs.accessSync(ffprobePath);
} catch {
  console.error(`ERROR: ffprobe not found at "${ffprobePath}".`);
  console.error('This may happen if npm install failed to download FFprobe binaries.');
  console.error('Try running: npm install @ffmpeg-installer/ffmpeg @ffprobe-installer/ffprobe');
  console.error('As a fallback, you can install FFmpeg (which includes ffprobe) manually:');
  console.error('  macOS: brew install ffmpeg');
  console.error('  Ubuntu/Debian: sudo apt install ffmpeg');
  console.error('  Windows: Download from https://ffmpeg.org/download.html');
  process.exit(1);
}

// Validate and configure encoder
const encoderConfig = getEncoderConfig();
if (encoderConfig.fallbackBehavior === 'fail') {
  process.exit(1);
}
setEncoder(encoderConfig.effectiveEncoder);

const start = async () => {
  const app = express();
  const queue = new JobQueueService(maxConcurrentJobs);
  await queue.init();

  app.use((_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (_req.method === 'OPTIONS') {
      res.status(204).send();
      return;
    }
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({ 
      ok: true, 
      port,
      maxConcurrentJobs,
      encoder: encoderConfig.effectiveEncoder,
    });
  });

  app.use('/api/jobs', buildJobsRouter(queue));

  app.listen(port, () => {
    console.log(`Native render server listening on port ${port}`);
    console.log(`Max concurrent jobs: ${maxConcurrentJobs}`);
  });
};

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
