/* Single HTTP boundary for the Clover UI. Configure before load with CLOVER_API_URL. */
(function () {
  const baseUrl = (window.CLOVER_API_URL || 'http://localhost:4000').replace(/\/$/, '');
  async function request(path, options = {}) {
    const response = await fetch(`${baseUrl}${path}`, { ...options, headers: { Accept:'application/json', ...(options.body ? {'Content-Type':'application/json'} : {}), ...options.headers } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error?.message || `Request failed (${response.status})`);
    return body;
  }
  window.CLOVER_API = {
    baseUrl,
    health: () => request('/health'),
    dashboard: () => request('/api/v1/dashboard'),
    stations: () => request('/api/v1/stations'),
    latest: (source) => request(`/api/v1/observations/latest${source ? `?source=${encodeURIComponent(source)}` : ''}`),
    weather: () => request('/api/v1/weather'),
    links: () => request('/api/v1/cml/links'),
    alerts: async () => ({ data: (await request('/api/v1/dashboard')).data.alerts }),
    forecast: async (payload) => (await request('/api/v1/predictions', { method:'POST', body:JSON.stringify(payload) })).data
  };
})();
