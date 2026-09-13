import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

export function notFound(req, _res, next) {
  next(new AppError(`Route ${req.method} ${req.originalUrl} was not found`, 404));
}

export function errorHandler(error, req, res, _next) {
  let status = error.statusCode || 500;
  if (error.name === 'ValidationError') status = 422;
  if (error.name === 'CastError') status = 400;

  if (status >= 500) {
    logger.error('Unhandled server error', error);
  }

  res.status(status).json({
    error: {
      message: error.message || 'Internal server error',
      statusCode: status,
      requestId: req.id || undefined,
      ...(error.details !== undefined && { details: error.details }),
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    },
  });
}
