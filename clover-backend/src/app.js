/**
 * app.js — Express application factory.
 *
 * Creates and configures the Express app with middleware and routes.
 * Exported so it can be imported by server.js (which attaches it to a port)
 * and by test suites (which can call routes without binding a port).
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { env } from './config/env.js';
import routes from './routes/index.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { getRedisClient } from './config/redis.js';

const app = express();

// Initialize Redis if configured
getRedisClient();

// ── Security & Headers ─────────────────────────────────────────────────────
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: false, // Disable default CSP for flexible local dev API usage
}));

// ── Request ID & Tracking ──────────────────────────────────────────────────
app.use(requestIdMiddleware);

// ── Rate Limiting ──────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Max 300 requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many requests, please try again later.', statusCode: 429 } },
});
app.use(limiter);

// ── CORS ───────────────────────────────────────────────────────────────────
app.use(cors({
  origin: env.corsOrigin,
  credentials: true,
}));

// ── Body parsing ───────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ── Health Check Endpoints ────────────────────────────────────────────────
const healthHandler = (_req, res) => {
  res.json({
    status: 'ok',
    service: 'clover-backend-api',
    version: '1.0.0',
    environment: env.nodeEnv,
    timestamp: new Date().toISOString(),
    predictionServiceUrl: env.predictionServiceUrl,
  });
};

app.get('/health', healthHandler);
app.get('/api/v1/health', healthHandler);

// ── API routes ─────────────────────────────────────────────────────────────
app.use('/api/v1', routes);

// ── Error handling ─────────────────────────────────────────────────────────
// notFound must come after all routes; errorHandler must be the very last middleware
app.use(notFound);
app.use(errorHandler);

export default app;
