/**
 * predictionController.js — endpoint for PM2.5 forecast generation.
 *
 * Bridges the frontend's forecast request through to the Python ML service.
 * If the frontend provides live features (pm25, weather), those are forwarded
 * directly. If not, the controller attempts to fetch the latest DB observation
 * as a fallback pm25 seed value.
 *
 * @route   POST /api/v1/predictions
 * @access  Public
 */
import { latestForDevice } from '../services/observationService.js';
import { requestPrediction } from '../services/ai/predictionService.js';
import { AppError } from '../utils/AppError.js';

/**
 * Generate a multi-horizon PM2.5 forecast for a given station.
 *
 * Request body:
 *   {
 *     stationId: string,               // Required
 *     horizons?: number[],             // Optional — defaults to 0..72 in ML service
 *     features?: {
 *       pm25?: number,                 // Overrides DB lookup when provided
 *       temperatureC?: number,
 *       humidityPct?: number,
 *       windSpeedMs?: number,
 *       cmlMeanRslDbm?: number,
 *       cmlHealthyLinks?: number
 *     }
 *   }
 */
export async function createPrediction(req, res) {
  const { stationId, horizons, features = {} } = req.body;

  if (!stationId) {
    throw new AppError('stationId is required', 400);
  }

  // Use the caller-supplied pm25 value; fall back to the latest DB observation
  let pm25 = features.pm25;

  if (!Number.isFinite(pm25)) {
    const current = await latestForDevice(stationId, 'aq_station');
    pm25 = current?.pm25;
  }

  if (!Number.isFinite(pm25)) {
    throw new AppError(
      'A current PM2.5 observation is required. Either provide features.pm25 or ' +
      'ingest an AQ observation for this station first.',
      422
    );
  }

  // Forward to the Python ML service — all ML logic lives there
  const data = await requestPrediction({
    stationId,
    horizons,
    features: { ...features, pm25 },
  });

  res.json({ data });
}
