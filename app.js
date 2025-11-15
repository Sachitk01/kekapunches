import express from 'express';
import dotenv from 'dotenv';
dotenv.config();

import healthRoutes from './routes/healthRoutes.js';
import slackRoutes from './routes/slackRoutes.js';
import approvalsRoutes from './routes/approvalsRoutes.js';
import { getMetrics, initMetrics } from './lib/metrics.js';
import db from './lib/db.js';
import { info } from './lib/logger.js';

const app = express();

// Initialize metrics
initMetrics();

// capture raw body for Slack verification for /slack routes
app.use('/slack', express.urlencoded({ extended: false, verify: (req, res, buf) => { req.rawBody = buf.toString(); } }));

app.use(express.json());

app.use('/health', healthRoutes);
app.use('/slack', slackRoutes);
app.use('/approvals', approvalsRoutes);

// GET /metrics - Return Prometheus metrics
app.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(getMetrics());
});

export default app;

