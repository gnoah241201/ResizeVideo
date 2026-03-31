/**
 * Bootstrap API routes
 * Exposes bootstrap state to the frontend
 */

import { Router } from 'express';
import { getBootstrapState, bootstrapBinaries } from '../services/bootstrap.js';

export function buildBootstrapRouter() {
  const router = Router();

  // Get current bootstrap state
  router.get('/state', (_req, res) => {
    const state = getBootstrapState();
    res.json(state);
  });

  // Trigger bootstrap (run the full bootstrap process)
  router.post('/bootstrap', (_req, res) => {
    const state = bootstrapBinaries();
    res.json(state);
  });

  return router;
}
