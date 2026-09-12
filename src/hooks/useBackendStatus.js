const { useEffect, useState } = React;

/** Shared health state for any page that needs to show API availability. */
export function useBackendStatus() {
  const [status, setStatus] = useState('connecting');
  useEffect(() => { window.CLOVER_API.health().then(result => setStatus(result.status === 'ok' ? 'live' : 'degraded')).catch(() => setStatus('offline')); }, []);
  return status;
}
