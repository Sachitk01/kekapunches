import express from 'express';
import db from '../lib/db.js';
import * as approvalsService from '../services/approvalsService.js';
import { error } from '../lib/logger.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    await db.query('SELECT 1');
    const approvals = await approvalsService.getPendingApprovals();
    const pendingCount = approvals?.length || 0;
    
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      db: 'connected',
      pendingApprovalsCount: pendingCount
    });
  } catch (err) {
    error('Health check failed', { err: err.message });
    res.status(503).json({
      status: 'degraded',
      timestamp: new Date().toISOString(),
      db: 'error',
      error: err.message
    });
  }
});

export default router;
