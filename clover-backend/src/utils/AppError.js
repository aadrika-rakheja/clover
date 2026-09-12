/**
 * AppError — operational error class for Express error-handling middleware.
 *
 * Usage:
 *   throw new AppError('Station not found', 404);
 *   throw new AppError('Invalid input', 422, { field: 'pm25' });
 */
export class AppError extends Error {
  /**
   * @param {string} message   Human-readable error description.
   * @param {number} statusCode HTTP status code (default 500).
   * @param {*}      details   Optional extra context (validation details, upstream body, etc.).
   */
  constructor(message, statusCode = 500, details) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
    // Capture clean stack trace (Node.js only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}
