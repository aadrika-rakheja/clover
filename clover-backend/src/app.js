/**
 * app.js — Express application factory.
 *
 * Creates and configures the Express app with middleware and routes.
 * Exported so it can be imported by server.js (which attaches it to a port)
 * and by test suites (which can call routes without binding a port).
 */
import express from 'express';
import cors from 'cors';

import { env } from './config/env.js';
import routes from './routes/index.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const app = express();

// ── Security ───────────────────────────────────────────────────────────────
// Remove the X-Powered-By header to avoid advertising the framework version
app.disable('x-powered-by');

// ── CORS ───────────────────────────────────────────────────────────────────
app.use(cors({
  origin: env.corsOrigin,
  credentials: true,
}));

// ── Body parsing ───────────────────────────────────────────────────────────
// 2 MB limit accommodates batch observation ingestion payloads
app.use(express.json({ limit: '2mb' }));

// ── Health check ───────────────────────────────────────────────────────────
// Simple liveness probe — does not require DB connectivity
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'clover-api',
    environment: env.nodeEnv,
    time: new Date().toISOString(),
  });
});

// ── API routes ─────────────────────────────────────────────────────────────
app.use('/api/v1', routes);

// ── Error handling ─────────────────────────────────────────────────────────
// notFound must come after all routes; errorHandler must be the very last middleware
app.use(notFound);
app.use(errorHandler);

export default app;
