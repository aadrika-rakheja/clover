/**
 * dashboardController.js — aggregate endpoint for the frontend dashboard.
 *
 * Assembles the complete dashboard payload in a single request:
 *   - Active station list
 *   - Latest AQ, weather, and CML observations
 *   - Active alert list (PM2.5 threshold breaches)
 *   - Summary counts
 *
 * @route   GET /api/v1/dashboard
 * @access  Public
 */
import { Station } from '../models/Station.js';
import { CmlLink } from '../models/CmlLink.js';
import { latestObservations } from '../services/observationService.js';

/** PM2.5 thresholds for auto-generated alerts (CPCB GRAP categories) */
const PM25_WARNING_THRESHOLD  = 91;   // AQI > 200 (Poor)
const PM25_CRITICAL_THRESHOLD = 121;  // AQI > 300 (Very Poor)

/**
 * Build an alert record from an AQ observation that breaches thresholds.
 *
 * @param {Object} obs   Latest AQ station observation
 * @returns {Object}     Alert object
 */
function buildAlert(obs) {
  const severity = obs.pm25 >= PM25_CRITICAL_THRESHOLD ? 'critical' : 'warning';
  return {
    id: `pm25-${obs._id}`,
    severity,
    deviceId: obs.deviceId,
    observedAt: obs.observedAt,
    message: `PM2.5 is ${obs.pm25} µg/m³ at ${obs.deviceId}`,
  };
}

export async function getDashboard(_req, res) {
  // Fetch all data in parallel to minimise response time
  const [stations, aqObs, weatherObs, cmlObs, activeLinkCount] = await Promise.all([
    Station.find({ active: true }).lean(),
    latestObservations('aq_station'),
    latestObservations('weather', 1),
    latestObservations('cml'),
    CmlLink.countDocuments({ active: true }),
  ]);

  // Generate alerts for stations breaching PM2.5 thresholds
  const alerts = aqObs
    .filter(obs => (obs.pm25 || 0) >= PM25_WARNING_THRESHOLD)
    .map(buildAlert);

  res.json({
    data: {
      stations,
      observations: {
        aq: aqObs,
        weather: weatherObs,
        cml: cmlObs,
      },
      alerts,
      summary: {
        stationCount: stations.length,
        activeCmlLinks: activeLinkCount,
      },
    },
  });
}
