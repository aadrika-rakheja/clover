/**
 * logger — lightweight structured console logger.
 *
 * Reads LOG_LEVEL from environment (error | warn | info | debug).
 * Each log entry includes an ISO timestamp and the severity level.
 *
 * Usage:
 *   import { logger } from '../utils/logger.js';
 *   logger.info('MongoDB connected');
 *   logger.error('Failed to connect', err);
 *   logger.debug('Observation payload', payload);
 */

import { env } from '../config/env.js';

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

const currentLevel = LEVELS[env.logLevel] ?? LEVELS.info;

function stamp() {
  return new Date().toISOString();
}

function log(level, message, ...args) {
  if (LEVELS[level] > currentLevel) return;

  const prefix = `[${stamp()}] [${level.toUpperCase()}]`;

  if (level === 'error') {
    console.error(prefix, message, ...args);
  } else if (level === 'warn') {
    console.warn(prefix, message, ...args);
  } else {
    console.log(prefix, message, ...args);
  }
}

export const logger = {
  error: (message, ...args) => log('error', message, ...args),
  warn:  (message, ...args) => log('warn',  message, ...args),
  info:  (message, ...args) => log('info',  message, ...args),
  debug: (message, ...args) => log('debug', message, ...args),
};
