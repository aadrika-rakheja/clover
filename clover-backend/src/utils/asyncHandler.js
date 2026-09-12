/**
 * asyncHandler — wraps an async Express route handler to forward any thrown
 * errors to Express's `next(error)` pipeline instead of causing unhandled
 * promise rejections.
 *
 * Usage:
 *   router.get('/stations', asyncHandler(stationController.listStations));
 *
 * @param {Function} handler  Async Express handler (req, res, next) => Promise
 * @returns {Function}        Standard Express middleware
 */
export const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);
