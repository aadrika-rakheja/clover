/**
 * dataController.js — observation ingestion and retrieval endpoints.
 *
 * Routes:
 *   POST /api/v1/ingestion/observations  → batch ingest sensor readings
 *   GET  /api/v1/observations/latest     → fetch latest readings (optionally filtered by source)
 */
import { createObservations, latestObservations } from '../services/observationService.js';
import { AppError } from '../utils/AppError.js';

const VALID_SOURCES = ['cml', 'aq_station', 'weather'];

/**
 * Batch-ingest sensor observations.
 * Accepts either a raw JSON array or `{ observations: [...] }` envelope.
 * Returns HTTP 201 on full success, 207 (Multi-Status) if some records failed.
 *
 * @route   POST /api/v1/ingestion/observations
 * @access  Internal / sensor agents
 */
export async function ingest(req, res) {
  // Accept both bare array and envelope format
  const items = Array.isArray(req.body) ? req.body : req.body?.observations;

  const result = await createObservations(items);

  const statusCode = result.rejected.length > 0 ? 207 : 201;

  res.status(statusCode).json({
    received: items?.length || 0,
    accepted: result.data.length,
    rejected: result.rejected,
    data: result.data,
  });
}

/**
 * Return the latest observations, with optional source filtering.
 *
 * @route   GET /api/v1/observations/latest
 * @query   {string} [source]  Filter by source type
 * @query   {number} [limit]   Max records (capped server-side at 1000)
 * @access  Public
 */
export async function latest(req, res) {
  const { source, limit } = req.query;

  if (source && !VALID_SOURCES.includes(source)) {
    throw new AppError(`Invalid source. Must be one of: ${VALID_SOURCES.join(', ')}`, 400);
  }

  const data = await latestObservations(source, limit);
  res.json({ data });
}
