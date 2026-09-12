function ApiStatusBadge({ status, alertCount = 0, recordCount = 0 }) {
  const styles = status === 'live'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : status === 'connecting'
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-slate-50 text-slate-500 border-slate-200';
  const dot = status === 'live' ? 'bg-emerald-500 animate-pulse' : status === 'connecting' ? 'bg-amber-500' : 'bg-slate-400';
  const label = status === 'live' ? `API LIVE${alertCount ? ` · ${alertCount} alerts` : ''}` : status === 'connecting' ? 'API CONNECTING' : 'OFFLINE MODE';
  return <div title={status === 'live' ? `${recordCount} backend telemetry records loaded` : 'Backend unavailable'} className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10px] font-bold border ${styles}`}><span className={`w-1.5 h-1.5 rounded-full ${dot}`} />{label}</div>;
}
window.ApiStatusBadge = ApiStatusBadge;
