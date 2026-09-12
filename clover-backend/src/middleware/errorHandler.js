/**
 * errorHandler.js — Express error-handling middleware.
 *
 * Two exports:
 *   - notFound   : catch-all for routes that don't match anything
 *   - errorHandler: converts errors to structured JSON responses
 */
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

/**
 * 404 catch-all middleware. Must be registered AFTER all valid routes.
 */
export function notFound(req, _res, next) {
  next(new AppError(`Route ${req.method} ${req.originalUrl} was not found`, 404));
}

/**
 * Global error handler. Must be registered as the LAST middleware (4 args).
 * Converts AppError and Mongoose ValidationError into consistent JSON.
 */
export function errorHandler(error, _req, res, _next) {
  // Determine HTTP status
  let status = error.statusCode || 500;
  if (error.name === 'ValidationError') status = 422;
  if (error.name === 'CastError') status = 400;

  // Log server-side errors (5xx) with full stack; 4xx are expected, skip stack
  if (status >= 500) {
    logger.error('Unhandled server error', error);
  }

  res.status(status).json({
    error: {
      message: error.message || 'Internal server error',
      ...(error.details !== undefined && { details: error.details }),
      // Include stack trace only in development to avoid leaking internals
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    },
  });
}
