/**
 * database.js — MongoDB connection management via Mongoose.
 *
 * Call `connectDatabase()` once at server startup. Mongoose maintains a
 * connection pool internally — no per-request connect/disconnect needed.
 */
import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

export async function connectDatabase() {
  mongoose.set('strictQuery', true);

  // Log connection lifecycle events for observability
  mongoose.connection.on('connected', () => logger.info('MongoDB connection established'));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB connection lost'));
  mongoose.connection.on('error', (err) => logger.error('MongoDB connection error', err));

  await mongoose.connect(env.mongoUri, {
    // Fail fast in dev; give more time in production for replica set elections
    serverSelectionTimeoutMS: env.nodeEnv === 'production' ? 15000 : 8000,
  });

  logger.info(`MongoDB connected → ${env.mongoUri.split('@').pop()}`);
}
