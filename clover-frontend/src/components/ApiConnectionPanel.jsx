/**
 * ApiConnectionPanel.jsx — Floating live API connection & request log panel.
 *
 * A reusable panel that shows:
 *  - Connection status badge (LIVE / CONNECTING / OFFLINE)
 *  - The backend base URL being used
 *  - A live, scrollable log of every API request made to the backend
 *    (method, path, HTTP status, response time)
 *
 * Listens to the 'clover:api-call' CustomEvent dispatched by api.js so it
 * updates automatically with zero prop-drilling.
 *
 * Usage (in any JSX file):
 *   <ApiConnectionPanel apiStatus={status} />
 *
 * Props:
 *  apiStatus  {'connecting'|'live'|'degraded'|'offline'}
 */
function ApiConnectionPanel({ apiStatus }) {
  const { useState, useEffect, useRef } = React;

  const [open,    setOpen]    = useState(false);
  const [log,     setLog]     = useState([]);
  const [pulse,   setPulse]   = useState(false);
  const logRef = useRef(null);

  // Listen to every API call dispatched by api.js
  useEffect(() => {
    function onApiCall(e) {
      setLog(prev => [e.detail, ...prev].slice(0, 60));
      // Briefly flash the panel button
      setPulse(true);
      setTimeout(() => setPulse(false), 400);
    }
    window.addEventListener('clover:api-call', onApiCall);
    // Hydrate from existing log (calls made before component mounted)
    if (window.API_LOG && window.API_LOG.length) {
      setLog([...window.API_LOG]);
    }
    return () => window.removeEventListener('clover:api-call', onApiCall);
  }, []);

  // Auto-scroll log list to top on new entry
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = 0;
  }, [log.length]);

  // ── Status badge helpers ─────────────────────────────────────────────────
  const STATUS = {
    live:       { dot: 'bg-emerald-400 animate-pulse', text: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-300', label: 'CONNECTED' },
    connecting: { dot: 'bg-amber-400 animate-pulse',  text: 'text-amber-700',   bg: 'bg-amber-50 border-amber-300',   label: 'CONNECTING' },
    degraded:   { dot: 'bg-amber-500',                text: 'text-amber-800',   bg: 'bg-amber-50 border-amber-300',   label: 'DEGRADED' },
    offline:    { dot: 'bg-slate-400',                text: 'text-slate-600',   bg: 'bg-slate-50 border-slate-300',   label: 'OFFLINE' },
  };
  const s = STATUS[apiStatus] || STATUS.connecting;

  // ── Row status helpers ──────────────────────────────────────────────────
  function rowColor(entry) {
    if (entry.status === 0)      return 'text-rose-600';
    if (entry.status >= 500)     return 'text-rose-600';
    if (entry.status >= 400)     return 'text-amber-600';
    return 'text-emerald-600';
  }
  function rowBg(entry) {
    if (!entry.ok) return 'bg-rose-50/60';
    return '';
  }

  return (
    <>
      {/* ── Floating toggle button ─────────────────────────────────────── */}
      <button
        id="api-panel-toggle"
        onClick={() => setOpen(o => !o)}
        title="Toggle API connection panel"
        className={`fixed bottom-5 right-5 z-[9998] flex items-center gap-2 px-3.5 py-2 rounded-2xl shadow-xl border text-xs font-bold transition-all duration-200 ${s.bg} ${s.text} ${
          pulse ? 'scale-110' : 'scale-100'
        }`}
      >
        <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
        <span>API {s.label}</span>
        {log.length > 0 && (
          <span className="bg-white/70 border border-current/20 rounded-full text-[10px] px-1.5 py-0.5 font-black">
            {log.length}
          </span>
        )}
        <span className={`transition-transform ${open ? 'rotate-180' : ''}`}>▲</span>
      </button>

      {/* ── Slide-up panel ────────────────────────────────────────────── */}
      {open && (
        <div
          id="api-panel"
          className="fixed bottom-16 right-5 z-[9997] w-[420px] max-w-[calc(100vw-2rem)] rounded-3xl shadow-2xl border border-white/80 overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)' }}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div>
              <div className="font-black text-slate-900 text-sm flex items-center gap-2">
                <span>🔌 API Connection</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${s.bg} ${s.text}`}>
                  {s.label}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                {window.CLOVER_API?.baseUrl || window.location.origin}
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-slate-400 hover:text-slate-700 text-lg leading-none"
            >
              ✕
            </button>
          </div>

          {/* Connection info row */}
          <div className="px-4 py-2.5 bg-slate-50/60 border-b border-slate-100 flex items-center gap-4 text-[11px] text-slate-600">
            <span>📡 Backend: <strong className="font-mono">{window.CLOVER_API?.baseUrl}</strong></span>
            <span>•</span>
            <span>Calls: <strong>{log.length}</strong></span>
            <span>•</span>
            <span>
              Errors:{' '}
              <strong className={log.filter(l => !l.ok).length > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                {log.filter(l => !l.ok).length}
              </strong>
            </span>
            <button
              onClick={() => setLog([])}
              className="ml-auto text-slate-400 hover:text-slate-700 font-bold"
            >
              Clear
            </button>
          </div>

          {/* Log list */}
          <div ref={logRef} className="overflow-y-auto max-h-72 divide-y divide-slate-50">
            {log.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-slate-400">
                <div className="text-2xl mb-2">📭</div>
                <div>No API calls yet.</div>
                <div className="text-[10px] mt-1">Calls appear here in real time as the app makes requests.</div>
              </div>
            ) : (
              log.map(entry => (
                <div key={entry.id} className={`px-4 py-2 flex items-center gap-2.5 text-[11px] ${rowBg(entry)}`}>
                  {/* Method badge */}
                  <span className={`shrink-0 w-10 text-center text-[10px] font-extrabold rounded-md py-0.5 ${
                    entry.method === 'POST' ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'
                  }`}>
                    {entry.method}
                  </span>

                  {/* Path */}
                  <span className="flex-1 font-mono text-slate-700 truncate" title={entry.url}>
                    {entry.path}
                  </span>

                  {/* Status */}
                  <span className={`font-extrabold shrink-0 ${rowColor(entry)}`}>
                    {entry.status === 0 ? 'ERR' : entry.status}
                  </span>

                  {/* Response time */}
                  <span className="text-slate-400 shrink-0 font-mono">
                    {entry.ms}ms
                  </span>

                  {/* Timestamp */}
                  <span className="text-slate-300 shrink-0 font-mono text-[10px]">
                    {entry.ts.toLocaleTimeString('en-US', { hour12: false, hour:'2-digit', minute:'2-digit', second:'2-digit' })}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Footer hint */}
          <div className="px-4 py-2 border-t border-slate-100 text-[10px] text-slate-400 text-center">
            Every API request to <span className="font-mono">{window.CLOVER_API?.baseUrl}</span> is logged here in real time
          </div>
        </div>
      )}
    </>
  );
}

window.ApiConnectionPanel = ApiConnectionPanel;
