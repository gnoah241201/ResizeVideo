import path from 'node:path';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import { ChildProcessWithoutNullStreams } from 'node:child_process';
import { RenderSpec } from '../../shared/render-contract';
import { ensureTempRoot, cleanupJobByWorkDir, cleanupExpiredJobs, isJobExpired } from './fileStore';
import { runRenderJob, RenderProgress, determineProgressMode } from './renderRunner';
import { RenderJobRecord } from '../types/renderJob';
import { JobStore } from './jobStore';
import { getRuntimePaths } from './pathConfig';

type InputUploadPaths = {
  foregroundPath: string;
  backgroundVideoPath?: string;
  backgroundImagePath?: string;
  overlayPath?: string;
};

const FINAL_STATES = new Set(['completed', 'failed', 'cancelled']);
const TERMINAL_STATES = new Set(['completed', 'failed', 'cancelled']);
const RECOVERABLE_STATES = new Set(['queued', 'completed', 'failed', 'cancelled']);

/**
 * Cleanup interval: check for expired jobs every 5 minutes
 */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

const isCancelling = (job: RenderJobRecord) => {
  return (job.status as string) === 'cancelling';
};

/**
 * RESTART RECOVERY POLICY:
 * 
 * - queued: Re-queued for processing after restart
 * - processing: Marked as 'failed' with "Interrupted by server restart"
 * - cancelling: Marked as 'failed' with "Interrupted by server restart"
 * - completed: Kept as-is (available for download)
 * - failed: Kept as-is (for history/debugging)
 * - cancelled: Kept as-is (for history)
 */
const RESTART_ERROR_MESSAGE = 'Interrupted by server restart';

type QueueDeps = {
  tempRoot?: string;
  runRenderJob?: typeof runRenderJob;
  determineProgressMode?: typeof determineProgressMode;
};

export class JobQueueService {
  private readonly jobs = new Map<string, RenderJobRecord>();
  private readonly pending: string[] = [];
  private readonly activeProcesses = new Map<string, ChildProcessWithoutNullStreams>();
  private activeCount = 0;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly jobStore: JobStore;
  private readonly tempRoot: string;
  private readonly runRenderJobImpl: typeof runRenderJob;
  private readonly determineProgressModeImpl: typeof determineProgressMode;

  constructor(private readonly maxConcurrentJobs: number, deps: QueueDeps = {}) {
    // Use runtime paths if no explicit tempRoot provided
    const runtimePaths = getRuntimePaths();
    this.tempRoot = deps.tempRoot ?? runtimePaths.stateRoot;
    this.jobStore = new JobStore(this.tempRoot);
    this.runRenderJobImpl = deps.runRenderJob ?? runRenderJob;
    this.determineProgressModeImpl = deps.determineProgressMode ?? determineProgressMode;
  }

  async init() {
    await ensureTempRoot();
    
    // Recover from any previous state
    await this.recoverFromRestart();
    
    // Start periodic cleanup of expired jobs
    this.startCleanupScheduler();
  }

  /**
   * Recover queue state from persisted storage after restart
   */
  private async recoverFromRestart(): Promise<void> {
    console.log('[jobQueue] Starting restart recovery...');
    
    const persistedJobs = await this.jobStore.load();
    
    if (persistedJobs.length === 0) {
      console.log('[jobQueue] No persisted jobs to recover');
      return;
    }

    let recovered = 0;
    let failed = 0;
    let requeued = 0;

    for (const job of persistedJobs) {
      // Check if this is a recoverable state
      const originalStatus = job.status;
      if (originalStatus === 'processing' || originalStatus === 'cancelling') {
        // Jobs that were in progress when server died are marked as failed
        // This is explicit - we don't try to resume interrupted processing
        job.status = 'failed';
        job.error = RESTART_ERROR_MESSAGE;
        job.finishedAt = Date.now();
        job.progressMode = 'determinate';
        job.progress = 0;
        
        console.log(`[jobQueue] Job ${job.id} was ${originalStatus}, marked as failed after restart`);
        failed++;
        
        this.jobs.set(job.id, job);
      } else if (job.status === 'queued') {
        // CRITICAL: Validate workDir exists before requeueing
        // If workDir is missing, we can't process this job - mark as failed
        const workDirExists = await this.jobStore.workDirExists(job.files.workDir);
        
        if (!workDirExists) {
          // Work directory doesn't exist - job cannot be processed
          job.status = 'failed';
          job.error = 'Work directory missing after restart';
          job.finishedAt = Date.now();
          
          this.jobs.set(job.id, job);
          console.log(`[jobQueue] Job ${job.id} queued but workDir missing, marked as failed`);
          failed++;
        } else {
          // Re-queue valid queued jobs
          this.jobs.set(job.id, job);
          this.pending.push(job.id);
          
          console.log(`[jobQueue] Job ${job.id} re-queued after restart`);
          requeued++;
        }
      } else if (TERMINAL_STATES.has(job.status)) {
        // Keep completed, failed, cancelled as-is
        this.jobs.set(job.id, job);
        recovered++;
      } else {
        // Unknown state - treat as failed
        job.status = 'failed';
        job.error = 'Unknown state after restart';
        job.finishedAt = Date.now();
        
        this.jobs.set(job.id, job);
        failed++;
      }
    }

    // Persist the recovered state
    await this.persistAll();
    
    console.log(`[jobQueue] Restart recovery complete: ${recovered} terminal, ${requeued} re-queued, ${failed} marked as failed`);
    
    // CRITICAL: Actually start processing recovered queued jobs
    // Just adding to pending array is not enough - we must trigger the scheduler
    if (requeued > 0) {
      this.schedule();
    }
  }

  /**
   * Persist all jobs to storage
   */
  private async persistAll(): Promise<void> {
    const jobs = Array.from(this.jobs.values());
    await this.jobStore.save(jobs);
  }

  /**
   * Start the cleanup scheduler for expired jobs
   */
  private startCleanupScheduler() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(async () => {
      try {
        const jobsToCheck = Array.from(this.jobs.values()).filter(
          (job) => job.status === 'completed' || job.status === 'failed'
        );
        
        // Perform cleanup (fileStore deletes expired workDirs)
        await cleanupExpiredJobs(jobsToCheck);
        
        // CRITICAL: Remove expired jobs from memory and persist
        // This ensures restart doesn't load stale terminal jobs whose files are gone
        const expiredIds = jobsToCheck
          .filter(job => {
            const status = job.status as 'completed' | 'failed';
            return isJobExpired(job.id, status, job.finishedAt);
          })
          .map(job => job.id);
        
        for (const id of expiredIds) {
          this.jobs.delete(id);
        }
        
        if (expiredIds.length > 0) {
          await this.persistAll();
          console.log(`[jobQueue] Removed ${expiredIds.length} expired jobs from persistence`);
        }
      } catch (error) {
        console.error('[jobQueue] Error during cleanup:', error);
      }
    }, CLEANUP_INTERVAL_MS);

    // Don't prevent process exit
    this.cleanupInterval.unref();
  }

  /**
   * Stop the cleanup scheduler (for testing)
   */
  stopCleanupScheduler() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  async createJob(spec: RenderSpec, uploads: InputUploadPaths): Promise<RenderJobRecord> {
    const id = randomUUID();
    const workDir = path.resolve(uploads.foregroundPath, '..', '..');
    const outputDir = path.join(workDir, 'output');
    await fs.mkdir(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, spec.outputFilename || `output-${id}.mp4`);

    const job: RenderJobRecord = {
      id,
      spec,
      files: {
        foregroundPath: uploads.foregroundPath,
        backgroundVideoPath: uploads.backgroundVideoPath,
        backgroundImagePath: uploads.backgroundImagePath,
        overlayPath: uploads.overlayPath,
        outputPath,
        workDir,
      },
      status: 'queued',
      progress: 0,
      outputFilename: spec.outputFilename,
    };

    this.jobs.set(id, job);
    this.pending.push(id);
    
    // Persist immediately after creating job
    await this.persistAll();
    
    this.schedule();
    return job;
  }

  getJob(jobId: string): RenderJobRecord | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get all jobs (for cleanup scheduler)
   */
  getAllJobs(): RenderJobRecord[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Get queue statistics for observability/debugging
   */
  getQueueStats() {
    const jobs = Array.from(this.jobs.values());
    const queued = jobs.filter((j) => j.status === 'queued').length;
    const processing = jobs.filter((j) => j.status === 'processing' || j.status === 'cancelling').length;
    const completed = jobs.filter((j) => j.status === 'completed').length;
    const failed = jobs.filter((j) => j.status === 'failed').length;
    const cancelled = jobs.filter((j) => j.status === 'cancelled').length;

    return {
      total: jobs.length,
      queued,
      processing,
      completed,
      failed,
      cancelled,
      activeSlots: this.activeCount,
      maxConcurrentJobs: this.maxConcurrentJobs,
    };
  }

  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return false;
    }

    if (FINAL_STATES.has(job.status)) {
      return true;
    }

    if (job.status === 'queued') {
      this.removeFromPending(jobId);
      // CRITICAL: Persist state change FIRST, then cleanup
      // This ensures that if crash happens during cleanup, 
      // restart will find the job as 'cancelled' (not 'queued' with missing files)
      job.status = 'cancelled';
      await this.persistAll();
      // Now cleanup the files - if this fails after persist, recovery will handle it
      await cleanupJobByWorkDir(job.files.workDir, 'cancelled', jobId);
      return true;
    }

    job.status = 'cancelling';
    const child = this.activeProcesses.get(jobId);
    if (child) {
      child.kill('SIGTERM');
    }
    // Persist after state change
    await this.persistAll();
    return true;
  }

  private removeFromPending(jobId: string) {
    const idx = this.pending.indexOf(jobId);
    if (idx >= 0) {
      this.pending.splice(idx, 1);
    }
  }

  private schedule() {
    while (this.activeCount < this.maxConcurrentJobs && this.pending.length > 0) {
      const nextJobId = this.pending.shift()!;
      const nextJob = this.jobs.get(nextJobId);
      if (!nextJob || nextJob.status !== 'queued') {
        continue;
      }
      this.execute(nextJob).catch((error) => {
        console.error('Unexpected execute() error:', error);
      });
    }
  }

  private async execute(job: RenderJobRecord) {
    this.activeCount += 1;
    job.status = 'processing';
    job.startedAt = Date.now();
    
    // Persist immediately when starting processing
    await this.persistAll();
    
    // CRITICAL: Set progressMode IMMEDIATELY when entering processing state
    // This prevents the ambiguous window where frontend sees progressMode: undefined
    const progressMode = await this.determineProgressModeImpl(job);
    job.progressMode = progressMode;
    
    // For indeterminate jobs, set progress to -1 immediately to signal "processing but unknown"
    if (progressMode === 'indeterminate') {
      job.progress = -1;
    }
    
    let wasCancelling = false;

    try {
      const { child, completion } = this.runRenderJobImpl(job, (renderProgress: RenderProgress) => {
        if (!wasCancelling) {
          job.progress = renderProgress.progress;
          // Only update mode if it's still indeterminate (to avoid overwriting determinate)
          // For indeterminate jobs, we keep emitting indeterminate mode
        }
      });

      this.activeProcesses.set(job.id, child);
      await completion;

      wasCancelling = isCancelling(job);
      if (wasCancelling) {
        job.status = 'cancelled';
        // Use centralized cleanup with actual workDir path
        await cleanupJobByWorkDir(job.files.workDir, 'cancelled', job.id);
      } else {
        job.status = 'completed';
        job.progress = 100;
        // CRITICAL: Terminal state must be consistent
        // Completed is always determinate (100%), even if started as indeterminate
        job.progressMode = 'determinate';
        // Note: completed jobs retain their workDir for download (handled by retention policy)
      }
    } catch (error) {
      wasCancelling = isCancelling(job);
      if (wasCancelling) {
        job.status = 'cancelled';
        // Use centralized cleanup with actual workDir path
        await cleanupJobByWorkDir(job.files.workDir, 'cancelled', job.id);
      } else {
        job.status = 'failed';
        job.error = error instanceof Error ? error.message : 'Render failed';
        // Note: failed jobs retain their workDir briefly for debugging (handled by retention policy)
      }
    } finally {
      job.finishedAt = Date.now();
      this.activeProcesses.delete(job.id);
      this.activeCount = Math.max(0, this.activeCount - 1);
      
      // Persist after terminal state
      await this.persistAll();
      
      this.schedule();
    }
  }

  async readOutput(jobId: string): Promise<Buffer | null> {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'completed') {
      return null;
    }

    try {
      return await fs.readFile(job.files.outputPath);
    } catch (error) {
      // File might not exist (expired, deleted externally, etc.)
      console.error(`[jobQueue] Error reading output for job ${jobId}:`, error);
      return null;
    }
  }
}
