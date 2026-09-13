/**
 * redis.js — Redis connection management with graceful offline fallback.
 */
import Redis from 'ioredis';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

let redisClient = null;
let isRedisConnected = false;

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
          logger.warn('Redis reconnection limit reached. Operating in fallback mode.');
          return null; // Stop retrying
        }
        return Math.min(times * 200, 1000);
      },
    });

    redisClient.on('connect', () => {
      isRedisConnected = true;
      logger.info(`Redis connected → ${env.redisHost}:${env.redisPort}`);
    });

    redisClient.on('error', (err) => {
      isRedisConnected = false;
      logger.warn(`Redis connection warning: ${err.message}`);
    });

    // Attempt non-blocking connect
    redisClient.connect().catch((err) => {
      logger.warn(`Initial Redis connection failed: ${err.message}. Application running without Redis cache.`);
    });
  } catch (err) {
    logger.warn(`Redis initialization skipped: ${err.message}`);
  }

  return redisClient;
}

export function getRedisClient() {
  if (!redisClient) {
    initRedis();
  }
  return redisClient;
}

export function isRedisAvailable() {
  return isRedisConnected;
}
