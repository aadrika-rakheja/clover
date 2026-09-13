/**
 * routes/index.js — API v1 route registry.
 *
 * All routes are prefixed with /api/v1 by app.js.
 * asyncHandler wraps each controller so thrown errors propagate to errorHandler.
 */
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';

import * as stationController    from '../controllers/stationController.js';
import * as dataController       from '../controllers/dataController.js';
import * as weatherController    from '../controllers/weatherController.js';
import * as cmlController        from '../controllers/cmlController.js';
import * as dashboardController  from '../controllers/dashboardController.js';
import * as predictionController from '../controllers/predictionController.js';

const router = Router();

// ── Dashboard ──────────────────────────────────────────────────────────────
// Aggregated snapshot: stations + latest obs + alerts + CML summary
router.get('/dashboard', asyncHandler(dashboardController.getDashboard));

// ── Monitoring Stations ────────────────────────────────────────────────────
router.get('/stations',           asyncHandler(stationController.listStations));
router.get('/stations/:stationId',asyncHandler(stationController.getStation));

// ── Weather Observations ───────────────────────────────────────────────────
router.get('/weather', asyncHandler(weatherController.getWeather));

// ── Sensor Observations ────────────────────────────────────────────────────
router.get('/observations/latest',          asyncHandler(dataController.latest));
router.post('/ingestion/observations',      asyncHandler(dataController.ingest));
router.post('/telemetry/sync',              asyncHandler(dataController.syncLiveData));

// ── Commercial Microwave Links (CML) ──────────────────────────────────────
router.get('/cml/links',                    asyncHandler(cmlController.listLinks));
router.post('/cml/links',                   asyncHandler(cmlController.createLink));
router.get('/cml/links/:linkId/health',     asyncHandler(cmlController.getHealth));

// ── ML Predictions ─────────────────────────────────────────────────────────
// Proxies to the Python FastAPI service; see services/ai/predictionService.js
router.post('/predictions', asyncHandler(predictionController.createPrediction));

export default router;
