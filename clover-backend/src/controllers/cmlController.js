/**
 * cmlController.js — Commercial Microwave Link (CML) management endpoints.
 *
 * Routes:
 *   GET  /api/v1/cml/links                 → list all active CML links with health status
 *   POST /api/v1/cml/links                 → create or upsert a CML link definition
 *   GET  /api/v1/cml/links/:linkId/health  → get health status for a specific link
 */
import { CmlLink } from '../models/CmlLink.js';
import { latestForDevice } from '../services/observationService.js';
import { AppError } from '../utils/AppError.js';

/** Maximum age (ms) before a link's last observation is considered stale */
const STALE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Compute the operational health status for a CML link based on its latest
 * observation age and quality score.
 *
 * @param {Object|null} latestObs  Most recent Observation for this link (or null)
 * @returns {{ status: string, score: number, lastSeenAt: Date|null }}
 */
function computeLinkHealth(latestObs) {
  if (!latestObs) {
    return { status: 'offline', score: 0, lastSeenAt: null };
  }

  const ageMs = Date.now() - new Date(latestObs.observedAt).getTime();

  if (ageMs >= STALE_THRESHOLD_MS) {
    return { status: 'offline', score: 0, lastSeenAt: latestObs.observedAt };
  }

  const isHealthy = (latestObs.quality ?? 1) >= 0.8;
  return {
    status: isHealthy ? 'healthy' : 'degraded',
    score: isHealthy ? 100 : 60,
    lastSeenAt: latestObs.observedAt,
  };
}

/**
 * List all active CML links with their current health status.
 *
 * @route   GET /api/v1/cml/links
 * @access  Public
 */
export async function listLinks(_req, res) {
  const links = await CmlLink.find({ active: true }).lean();

  // Attach real-time health for each link (parallel fetch)
  const linksWithHealth = await Promise.all(
    links.map(async (link) => {
      const latest = await latestForDevice(link.linkId, 'cml');
      return { ...link, health: computeLinkHealth(latest) };
    })
  );

  res.json({ data: linksWithHealth });
}

/**
 * Create or upsert a CML link configuration record.
 *
 * @route   POST /api/v1/cml/links
 * @access  Internal / admin
 */
export async function createLink(req, res) {
  const { linkId, from, to, frequencyGhz, baselineRslDbm } = req.body;

  if (!linkId || !from || !to) {
    throw new AppError('linkId, from, and to are required', 400);
  }
  if (!Number.isFinite(Number(frequencyGhz))) {
    throw new AppError('frequencyGhz must be a finite number', 400);
  }
  if (!Number.isFinite(Number(baselineRslDbm))) {
    throw new AppError('baselineRslDbm must be a finite number', 400);
  }

  const data = await CmlLink.findOneAndUpdate(
    { linkId },
    { linkId, from, to, frequencyGhz, baselineRslDbm },
    { new: true, upsert: true, runValidators: true }
  );

  res.status(201).json({ data });
}

/**
 * Return the health status for a single CML link.
 *
 * @route   GET /api/v1/cml/links/:linkId/health
 * @access  Public
 */
export async function getHealth(req, res) {
  const link = await CmlLink.findOne({ linkId: req.params.linkId }).lean();

  if (!link) {
    throw new AppError('CML link not found', 404);
  }

  const latest = await latestForDevice(link.linkId, 'cml');

  res.json({
    data: {
      linkId: link.linkId,
      ...computeLinkHealth(latest),
    },
  });
}
