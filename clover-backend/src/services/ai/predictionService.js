/**
 * predictionService.js — bridge between the Node.js API and the Python ML service.
 *
 * ─── Architecture ────────────────────────────────────────────────────────────
 *
 *   Frontend  →  Node/Express API  →  (this service)  →  Python FastAPI (ml-service)
 *                                                                ↓
 *                                                     Trained PM2.5 forecast model
 *
 * This module is the ONLY place in the Node codebase that knows about the
 * Python service URL. No ML logic lives here — the responsibility is purely
 * HTTP transport and error normalisation.
 *
 * ─── Integration notes ───────────────────────────────────────────────────────
 * The Python service exposes:
 *   POST /v1/forecast
 *     Body: { stationId, features: { pm25, temperatureC?, humidityPct?,
 *             windSpeedMs?, cmlMeanRslDbm?, cmlHealthyLinks? }, horizons: int[] }
 *
 *   GET /health
 *     Returns: { status: "ok", modelVersion: "..." }
 *
 * To swap in a real trained model, replace forecast_pm25() in:
 *   clover-backend/ml-service/app/main.py
 * The interface contract (request/response shape) stays the same.
 *
 * ─── Environment ─────────────────────────────────────────────────────────────
 *   PREDICTION_SERVICE_URL  (or ML_SERVICE_URL)
 *   Default: http://localhost:8000
 */
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import { logger } from '../../utils/logger.js';

/**
 * Forward a prediction request to the Python FastAPI ML service.
 *
 * @param {Object} payload
 * @param {string}   payload.stationId   Station identifier
 * @param {Object}   payload.features    Input features for the model
 * @param {number[]} payload.horizons    Forecast horizons in hours (0–72)
 * @returns {Promise<Object>} Forecast response from the ML service
 * @throws {AppError} 503 if the service is unreachable, 502 if it returns an error
 */
export async function requestPrediction(payload) {
  const endpoint = `${env.predictionServiceUrl}/v1/forecast`;
  logger.debug(`Forwarding prediction request to ${endpoint}`, { stationId: payload.stationId });

  let response;

  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      // 10-second hard timeout to avoid blocking Express worker threads
      signal: AbortSignal.timeout(10000),
    });
  } catch (err) {
    logger.warn(`Prediction service unreachable at ${endpoint}: ${err.message}`);
    throw new AppError('Prediction service is currently unavailable', 503);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    logger.warn(`Prediction service returned ${response.status}`, body);
    throw new AppError('Prediction service rejected the request', 502, body);
  }

  return response.json();
}
