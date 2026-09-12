/**
 * weatherController.js — returns the latest weather observations.
 *
 * GET /api/v1/weather
 *   Returns the 100 most recent weather-source observations, sorted by
 *   observedAt descending.
 */
import { latestObservations } from '../services/observationService.js';

/**
 * @route   GET /api/v1/weather
 * @access  Public
 */
export async function getWeather(_req, res) {
  const data = await latestObservations('weather', 100);
  res.json({ data });
}
