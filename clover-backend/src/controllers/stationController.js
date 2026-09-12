/**
 * stationController.js — CRUD for monitoring station metadata.
 *
 * Routes:
 *   GET /api/v1/stations           → list all active stations
 *   GET /api/v1/stations/:stationId → single station + its latest AQ reading
 */
import { Station } from '../models/Station.js';
import { latestForDevice } from '../services/observationService.js';
import { AppError } from '../utils/AppError.js';

/**
 * List all active monitoring stations, sorted alphabetically by name.
 *
 * @route   GET /api/v1/stations
 * @access  Public
 */
export async function listStations(_req, res) {
  const data = await Station.find({ active: true }).sort({ name: 1 }).lean();
  res.json({ data });
}

/**
 * Get a single station and attach its latest air quality observation.
 *
 * @route   GET /api/v1/stations/:stationId
 * @access  Public
 */
export async function getStation(req, res) {
  const station = await Station.findOne({ stationId: req.params.stationId }).lean();

  if (!station) {
    throw new AppError('Station not found', 404);
  }

  const latest = await latestForDevice(station.stationId, 'aq_station');

  res.json({ data: station, latest });
}
