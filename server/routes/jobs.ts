import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { JobQueueService } from '../services/jobQueue';
import { RenderSpec } from '../../shared/render-contract';
import { createJobDirs, removeWorkDir, isJobExpired, getRemainingRetentionMs } from '../services/fileStore';
import { validateRenderSpec } from '../services/validation';

// Extend Express Request to track temp directories
declare module 'express-serve-static-core' {
  interface Request {
    tempWorkDir?: string;
  }
}

const upload = multer({
  storage: multer.diskStorage({
    destination: async (req, _file, cb) => {
      try {
        // Use ONE shared workDir for ALL files in this request
        // Created once on first file, reused for subsequent files
        if (!req.tempWorkDir) {
          const tempId = randomUUID();
          const dirs = await createJobDirs(`upload-${tempId}`);
          req.tempWorkDir = dirs.workDir;
          cb(null, dirs.inputDir);
        } else {
          // Reuse existing workDir - extract inputDir from it
          const inputDir = path.join(req.tempWorkDir, 'input');
          cb(null, inputDir);
        }
      } catch (error) {
        cb(error as Error, '');
      }
    },
    filename: (_req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);
    },
  }),
});

// Helper to clean up temp directory by direct workDir path
async function cleanupTempDir(tempWorkDir: string | undefined): Promise<void> {
  if (!tempWorkDir) return;
  await removeWorkDir(tempWorkDir).catch(() => {});
}

export const buildJobsRouter = (queue: JobQueueService) => {
  const router = express.Router();

  router.post(
    '/',
    upload.fields([
      { name: 'foreground', maxCount: 1 },
      { name: 'backgroundVideo', maxCount: 1 },
      { name: 'backgroundImage', maxCount: 1 },
      { name: 'overlay', maxCount: 1 },
    ]),
    async (req, res) => {
      try {
        const specRaw = req.body.spec;
        if (!specRaw) {
          await cleanupTempDir(req.tempWorkDir);
          res.status(400).json({
            error: 'ValidationError',
            message: 'spec is required and must be a valid JSON object',
          });
          return;
        }

        let spec: RenderSpec;
        try {
          spec = JSON.parse(specRaw) as RenderSpec;
        } catch {
          await cleanupTempDir(req.tempWorkDir);
          res.status(400).json({
            error: 'ValidationError',
            message: 'spec must be valid JSON',
          });
          return;
        }

        const files = req.files as Record<string, Express.Multer.File[] | undefined>;
        const foreground = files.foreground?.[0];
        const backgroundVideo = files.backgroundVideo?.[0];
        const backgroundImage = files.backgroundImage?.[0];
        const overlay = files.overlay?.[0];

        // Validate spec and file combinations
        const validationErrors = validateRenderSpec(spec, {
          hasForeground: !!foreground,
          hasBackgroundVideo: !!backgroundVideo,
          hasBackgroundImage: !!backgroundImage,
          hasOverlay: !!overlay,
        });

        if (validationErrors.length > 0) {
          await cleanupTempDir(req.tempWorkDir);
          res.status(400).json(validationErrors[0]);
          return;
        }

        const job = await queue.createJob(spec, {
          foregroundPath: path.resolve(foreground!.path),
          backgroundVideoPath: backgroundVideo ? path.resolve(backgroundVideo.path) : undefined,
          backgroundImagePath: backgroundImage ? path.resolve(backgroundImage.path) : undefined,
          overlayPath: overlay ? path.resolve(overlay.path) : undefined,
        });

        res.json({
          jobId: job.id,
          status: job.status,
        });
      } catch (error) {
        // Cleanup temp uploads if internal error occurs after upload
        await cleanupTempDir(req.tempWorkDir);
        console.error(error);
        res.status(500).json({
          error: 'InternalError',
          message: error instanceof Error ? error.message : 'Failed to create job',
        });
      }
    },
  );

  router.get('/:id', (req, res) => {
    const job = queue.getJob(req.params.id);
    if (!job) {
      res.status(404).json({
        error: 'NotFound',
        message: 'Job not found',
      });
      return;
    }

    // Check if download is still available
    let downloadUrl: string | undefined;
    if (job.status === 'completed') {
      const expired = isJobExpired(job.id, 'completed', job.finishedAt);
      if (!expired) {
        downloadUrl = `/api/jobs/${job.id}/download`;
      }
    }

    res.json({
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      progressMode: job.progressMode,
      error: job.error,
      outputFilename: job.outputFilename,
      downloadUrl,
    });
  });

  // Debug endpoint for queue observability
  router.get('/debug/queue', (_req, res) => {
    const stats = queue.getQueueStats();
    const jobs = queue.getAllJobs().map((job) => ({
      id: job.id,
      status: job.status,
      progress: job.progress,
      progressMode: job.progressMode,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      error: job.error,
    }));
    res.json({ stats, jobs });
  });

  router.delete('/:id', async (req, res) => {
    const ok = await queue.cancelJob(req.params.id);
    if (!ok) {
      res.status(404).send('Job not found');
      return;
    }
    res.status(204).send();
  });

  router.get('/:id/download', async (req, res) => {
    const job = queue.getJob(req.params.id);
    if (!job) {
      res.status(404).json({
        error: 'NotFound',
        message: 'Job not found',
      });
      return;
    }

    // Check if job is completed (only completed jobs can be downloaded)
    if (job.status !== 'completed') {
      res.status(409).json({
        error: 'NotReady',
        message: `Job is ${job.status}, not ready for download`,
      });
      return;
    }

    // Check if output has expired due to retention policy
    if (isJobExpired(job.id, 'completed', job.finishedAt)) {
      const remainingMs = getRemainingRetentionMs('completed', job.finishedAt);
      const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
      res.status(410).json({
        error: 'Expired',
        message: `Job output has expired and is no longer available for download. Retention period was 24 hours.`,
      });
      return;
    }

    const output = await queue.readOutput(req.params.id);
    if (!output) {
      // Output file missing but job says completed - might have been deleted externally
      res.status(410).json({
        error: 'Gone',
        message: 'Job output file is no longer available',
      });
      return;
    }

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${job.outputFilename || 'output.mp4'}"`);
    res.send(output);
  });

  return router;
};
