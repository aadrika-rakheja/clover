/**
 * env.js — centralised environment configuration.
 *
 * All process.env reads happen here. The rest of the codebase imports
 * from this module so that env keys are never scattered across files.
 *
 * Required: MONGODB_URI (in production — defaults to localhost in dev)
 * Optional: PORT, CORS_ORIGIN, PREDICTION_SERVICE_URL, LOG_LEVEL, NODE_ENV
 */
import 'dotenv/config';

export const env = {
  /** Runtime environment ('development' | 'production' | 'test') */
  nodeEnv: process.env.NODE_ENV || 'development',

  /** TCP port the Express server listens on */
  port: Number(process.env.PORT || 4000),

  /** MongoDB connection string */
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/clover',

  /**
   * Comma-separated list of allowed CORS origins.
   * Example: "http://localhost:5173,https://clover.example.com"
   */
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:3000').split(',').map(o => o.trim()),

  /** Base URL of the Python FastAPI ML prediction service. */
  predictionServiceUrl: (
    process.env.PREDICTION_SERVICE_URL ||
    process.env.ML_SERVICE_URL ||
    'http://localhost:8000'
  ).replace(/\/$/, ''),

  /** Redis host and port configuration */
  redisHost: process.env.REDIS_HOST || '127.0.0.1',
  redisPort: Number(process.env.REDIS_PORT || 6379),
  redisPassword: process.env.REDIS_PASSWORD || '',

  /** Minimum log level: 'error' | 'warn' | 'info' | 'debug' */
  logLevel: process.env.LOG_LEVEL || 'info',
};

// Warn if running in production without an explicit MONGODB_URI
if (env.nodeEnv === 'production' && !process.env.MONGODB_URI) {
  console.warn('[env] WARNING: MONGODB_URI is not set. Falling back to localhost — this will fail in production.');
}
