import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { env } from './config/env.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { getRedisClient } from './config/redis.js';

const app = express();

// Initialize Redis if configured
getRedisClient();

// Security headers & Request ID
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(requestIdMiddleware);

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many requests, please try again later.', statusCode: 429 } },
});
app.use(limiter);

// CORS
app.use(cors({
  origin: env.corsOrigin,
  credentials: true,
}));

// Body Parsing Limits (2MB)
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Health Check Endpoints
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

// 404 & Error Handling
app.use(notFound);
app.use(errorHandler);

export default app;
