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

async function start() {
  try {
    // 1. Connect to MongoDB before accepting traffic
    await connectDatabase();

    // 2. Start listening
    const server = app.listen(env.port, () => {
      logger.info(`Clover API listening on :${env.port} [${env.nodeEnv}]`);
    });

    // 3. Graceful shutdown handler — allows Docker / Kubernetes to drain connections
    const shutdown = (signal) => {
      logger.info(`${signal} received — shutting down gracefully`);
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT',  () => shutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start Clover API', error);
    process.exit(1);
  }
}

start();
