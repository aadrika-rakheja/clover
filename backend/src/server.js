import app from './app.js';
import { connectDatabase } from './config/db.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';

async function start() {
  try {
    await connectDatabase();
  } catch (dbErr) {
    logger.warn(`MongoDB not connected on startup (${dbErr.message}). Server running in standalone / fallback mode.`);
  }

  const server = app.listen(env.port, () => {
    logger.info(`Clover Backend API listening on port :${env.port} [${env.nodeEnv}]`);
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
}

start();
