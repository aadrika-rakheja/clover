/**
 * observationService.js — business logic for sensor observation records.
 *
 * Handles:
 *  - Field alias normalisation (vendor keys → canonical schema keys)
 *  - Batch ingestion with per-record validation and partial-success support
 *  - Latest-reading queries used by controllers and the dashboard
 */
import { Observation } from '../models/Observation.js';
import { AppError } from '../utils/AppError.js';

// ── Field alias map ───────────────────────────────────────────────────────────
// Allows vendors to send slightly different key names without breaking ingestion.
const FIELD_ALIASES = {
  device_id:   'deviceId',
  station_id:  'deviceId',
  link_id:     'deviceId',
  timestamp:   'observedAt',
  time:        'observedAt',
  latitude:    'lat',
  longitude:   'lon',
  pm2_5:       'pm25',
  'pm2.5':     'pm25',
  temperature: 'temperatureC',
  humidity:    'humidityPct',
  rsl:         'rslDbm',
  frequency:   'frequencyGhz',
};

const VALID_SOURCES = ['cml', 'aq_station', 'weather'];

/**
 * Remap vendor field names to canonical schema names.
 * Unknown keys are passed through unchanged.
 *
 * @param {Object} input Raw vendor payload
 * @returns {Object}     Normalised object
 */
export function normalizeObservation(input) {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [FIELD_ALIASES[key] ?? key, value])
  );
}

/**
 * Validate and persist a batch of raw observation payloads.
 * Returns accepted documents and a list of rejection reasons so callers can
 * send HTTP 207 (Multi-Status) when some items fail.
 *
 * @param {Array} items Array of raw observation objects from the request body
 * @returns {{ data: Observation[], rejected: { index: number, reason: string }[] }}
 */
export async function createObservations(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError('observations must be a non-empty array', 400);
  }

  const accepted = [];
  const rejected = [];

  items.forEach((raw, index) => {
    try {
      const item = normalizeObservation(raw);

      // Common required fields
      if (!VALID_SOURCES.includes(item.source)) {
        throw new Error(`source must be one of: ${VALID_SOURCES.join(', ')}`);
      }
      if (!item.deviceId) {
        throw new Error('deviceId is required');
      }

      // Source-specific validation
      if (item.source === 'aq_station' && !Number.isFinite(Number(item.pm25))) {
        throw new Error('AQ station observation requires a numeric pm25 value');
      }
      if (item.source === 'cml') {
        if (!Number.isFinite(Number(item.rslDbm))) {
          throw new Error('CML observation requires a numeric rslDbm value');
        }
        if (!Number.isFinite(Number(item.frequencyGhz))) {
          throw new Error('CML observation requires a numeric frequencyGhz value');
        }
      }

      // Build location GeoJSON if coordinates are present
      const lat = Number(item.lat);
      const lon = Number(item.lon);
      const locationField = Number.isFinite(lat) && Number.isFinite(lon)
        ? { location: { type: 'Point', coordinates: [lon, lat] } }
        : {};

      accepted.push({
        ...item,
        observedAt: item.observedAt || new Date(),
        quality: Number.isFinite(Number(item.quality)) ? Number(item.quality) : 1,
        ...locationField,
      });
    } catch (error) {
      rejected.push({ index, reason: error.message });
    }
  });

  // insertMany with ordered:false continues on individual document errors
  const data = accepted.length
    ? await Observation.insertMany(accepted, { ordered: false })
    : [];

  return { data, rejected };
}

/**
 * Return the most recent observations, optionally filtered by source.
 *
 * @param {string} [source]  Optional source filter ('cml' | 'aq_station' | 'weather')
 * @param {number} [limit]   Max records to return (capped at 1000)
 * @returns {Promise<Observation[]>}
 */
export async function latestObservations(source, limit = 500) {
  const filter = source ? { source } : {};
  const safeLimit = Math.min(Number(limit) || 500, 1000);
  return Observation.find(filter).sort({ observedAt: -1 }).limit(safeLimit).lean();
}

/**
 * Return the single most recent observation for a specific device.
 *
 * @param {string} deviceId  Device / station / link ID
 * @param {string} [source]  Optional source filter
 * @returns {Promise<Observation|null>}
 */
export async function latestForDevice(deviceId, source) {
  const filter = { deviceId, ...(source ? { source } : {}) };
  return Observation.findOne(filter).sort({ observedAt: -1 }).lean();
}
