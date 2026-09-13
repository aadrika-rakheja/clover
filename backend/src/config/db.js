import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

export async function connectDatabase() {
  mongoose.set('strictQuery', true);

  mongoose.connection.on('connected', () => logger.info('MongoDB connection established'));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB connection lost'));
  mongoose.connection.on('error', (err) => logger.error('MongoDB connection error', err));

  await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: env.nodeEnv === 'production' ? 15000 : 5000,
  });

  logger.info(`MongoDB connected → ${env.mongoUri.split('@').pop()}`);
}

export { mongoose };
export default connectDatabase;
