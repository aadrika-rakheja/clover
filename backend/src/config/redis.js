import Redis from 'ioredis';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

let redisClient = null;
let isConnected = false;

export function initRedis() {
  if (redisClient) return redisClient;

  try {
    redisClient = new Redis({
      host: env.redisHost,
      port: env.redisPort,
      password: env.redisPassword || undefined,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy(times) {
        if (times > 3) {
          logger.warn('Redis retry limit reached. Operating without cache.');
          return null;
        }
        return Math.min(times * 200, 1000);
      },
    });

    redisClient.on('connect', () => {
      isConnected = true;
      logger.info(`Redis connected → ${env.redisHost}:${env.redisPort}`);
    });

    redisClient.on('error', (err) => {
      isConnected = false;
      logger.warn(`Redis connection warning: ${err.message}`);
    });

    redisClient.connect().catch((err) => {
      logger.warn(`Initial Redis connection failed: ${err.message}`);
    });
  } catch (err) {
    logger.warn(`Redis initialization error: ${err.message}`);
  }

  return redisClient;
}

export function getRedisClient() {
  if (!redisClient) initRedis();
  return redisClient;
}

export function isRedisAvailable() {
  return isConnected;
}
