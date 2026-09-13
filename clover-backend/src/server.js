/**
 * server.js — application entry point.
 *
 * Connects to MongoDB, then starts the HTTP server.
 * Handles graceful shutdown on SIGTERM / SIGINT so in-flight requests can
 * complete before the process exits (important for container deployments).
 */
import app from './app.js';
import { connectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { syncLiveTelemetry } from './services/externalDataService.js';

async function start() {
  try {
    await connectDatabase();
    // Trigger immediate live telemetry sync on startup
    syncLiveTelemetry().catch(err => logger.warn(`Initial dynamic telemetry sync failed: ${err.message}`));
    // Schedule background refresh every 15 minutes (900,000 ms)
    setInterval(() => {
      syncLiveTelemetry().catch(err => logger.warn(`Scheduled dynamic telemetry sync failed: ${err.message}`));
    }, 15 * 60 * 1000);
  } catch (dbErr) {
    logger.warn(`MongoDB not connected on startup (${dbErr.message}). API will run with fallback / memory mode.`);
  }

  try {
    const server = app.listen(env.port, () => {
      logger.info(`Clover API listening on :${env.port} [${env.nodeEnv}]`);
    });

    const shutdown = (signal) => {
      logger.info(`${signal} received — shutting down gracefully`);
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error('Failed to start Clover API', error);
    process.exit(1);
  }
}

start();
