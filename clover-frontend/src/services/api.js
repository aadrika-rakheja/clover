/**
 * api.js — HTTP client for the Clover Node.js backend.
 *
 * Exposed as window.CLOVER_API. Logs every request to window.API_LOG and
 * dispatches a 'clover:api-call' CustomEvent so any component can react.
 *
 * Base URL resolution priority:
 *   1. window.CLOVER_API_URL  (set in index.html for per-env config)
 *   2. http://localhost:4000  (development default)
 */

(function () {
  const BASE_URL = window.CLOVER_API_URL
    ? window.CLOVER_API_URL.replace(/\/$/, '')
    : 'http://localhost:8000';

  // ── Request log ─────────────────────────────────────────────────────────
  // window.API_LOG is a capped ring-buffer of the last 50 API calls.
  // Each entry: { id, method, url, status, ms, ok, ts }
  window.API_LOG = [];
  let _seq = 0;

  function addLog(entry) {
    window.API_LOG.unshift(entry);
    if (window.API_LOG.length > 50) window.API_LOG.pop();
    // Notify any listening component
    window.dispatchEvent(new CustomEvent('clover:api-call', { detail: entry }));
  }

  // ── Core fetch wrapper ──────────────────────────────────────────────────
  async function request(path, opts = {}) {
    const method = (opts.method || 'GET').toUpperCase();
    const url    = `${BASE_URL}${path}`;
    const id     = ++_seq;
    const t0     = performance.now();

    try {
      const response = await fetch(url, {
        ...opts,
        headers: {
          Accept: 'application/json',
          ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
          ...opts.headers,
        },
      });

      const ms   = Math.round(performance.now() - t0);
      const body = await response.json().catch(() => ({}));

      addLog({ id, method, url, path, status: response.status, ms, ok: response.ok, ts: new Date() });

      if (!response.ok) {
        throw new Error(body.error?.message || `Request failed (${response.status})`);
      }

      return body;

    } catch (err) {
      const ms = Math.round(performance.now() - t0);
      // Network failure (CORS, server down, timeout)
      if (!window.API_LOG.find(l => l.id === id)) {
        addLog({ id, method, url, path, status: 0, ms, ok: false, error: err.message, ts: new Date() });
      }
      throw err;
    }
  }

  // ── Public API surface ───────────────────────────────────────────────────

  window.CLOVER_API = {
    /** Base URL used for all requests */
    baseUrl: BASE_URL,

    // Health
    health: () => request('/health'),

    // Dashboard
    dashboard: () => request('/api/v1/dashboard'),

    // Stations
    stations: () => request('/api/v1/stations'),

    // Observations
    latest: (source) =>
      request(`/api/v1/observations/latest${source ? `?source=${encodeURIComponent(source)}` : ''}`),

    // Weather
    weather: () => request('/api/v1/weather'),

    // CML Links
    links: () => request('/api/v1/cml/links'),

    // Alerts (derived from dashboard)
    alerts: async () => {
      const result = await request('/api/v1/dashboard');
      return { data: result.data.alerts };
    },

    // ML Predictions
    forecast: async (payload) => {
      const result = await request('/api/v1/predictions', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return result.data;
    },

    // Trigger dynamic live telemetry sync
    syncTelemetry: () => request('/api/v1/telemetry/sync', { method: 'POST' }),
  };
})();
