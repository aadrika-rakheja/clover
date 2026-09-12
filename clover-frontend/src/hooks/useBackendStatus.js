/**
 * useBackendStatus.js — shared hook for API health state.
 *
 * Loaded as a plain <script> tag (no ES module bundler), so the hook is
 * attached to window.useBackendStatus for use across component files.
 *
 * Usage (in any React component):
 *   const status = window.useBackendStatus();
 *   // status: 'connecting' | 'live' | 'degraded' | 'offline'
 */

(function () {
  const { useEffect, useState } = React;

  /**
   * Poll the Node API health endpoint once on mount.
   * Returns the current connectivity status string.
   *
   * @returns {'connecting'|'live'|'degraded'|'offline'}
   */
  function useBackendStatus() {
    const [status, setStatus] = useState('connecting');

    useEffect(() => {
      let cancelled = false;

      window.CLOVER_API.health()
        .then((result) => {
          if (!cancelled) {
            setStatus(result.status === 'ok' ? 'live' : 'degraded');
          }
        })
        .catch(() => {
          if (!cancelled) setStatus('offline');
        });

      return () => { cancelled = true; };
    }, []);

    return status;
  }

  window.useBackendStatus = useBackendStatus;
})();
