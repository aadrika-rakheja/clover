/**
 * LocationBreadcrumb.jsx — breadcrumb path + station quick-chip selector.
 *
 * Props:
 *  stations          {Array}    All station objects
 *  selectedStationId {string}   Currently active station ID
 *  flyToStation      {Function} (stationId) => void
 */
function LocationBreadcrumb({ stations, selectedStationId, flyToStation }) {
  return (
    <div className="glass-subtle border-b border-white/60">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">

        {/* Breadcrumb path */}
        <div className="flex items-center gap-1 text-xs text-slate-600 font-medium">
          <span className="text-slate-400">Home</span>
          <span className="text-slate-300">›</span>
          <span>🇮🇳 India</span>
          <span className="text-slate-300">›</span>
          <span>Uttar Pradesh</span>
          <span className="text-slate-300">›</span>
          <span className="font-bold text-slate-900">Greater Noida · CLOVER</span>
        </div>

        {/* Station quick-chips (first 6) */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs py-0.5">
          <span className="text-slate-400 text-[11px] font-semibold shrink-0">Locations:</span>
          {stations.slice(0, 6).map(st => (
            <button
              key={st.id}
              onClick={() => flyToStation(st.id)}
              className={`px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all border ${
                selectedStationId === st.id
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : 'glass-subtle text-slate-700 hover:bg-white/80 border-white/80'
              }`}
            >
              {st.name.split(',')[0]}
            </button>
          ))}
        </div>

      </div>
    </div>
  );
}

window.LocationBreadcrumb = LocationBreadcrumb;
