/**
 * Header.jsx — Sticky glassy top navigation bar.
 *
 * Contains:
 *  - CLOVER logo + brand
 *  - Station search bar with live dropdown
 *  - API status badge, real-time clock, unit toggles
 *  - Sub-navigation tabs (Weather, Forecast, Map, Pollutants, CML Science)
 *
 * Props:
 *  activeTab          {string}   Current active tab ID
 *  setActiveTab       {Function} Tab switch handler
 *  searchQuery        {string}   Current search string
 *  setSearchQuery     {Function} Search input handler
 *  searchResults      {Array}    Matched station objects
 *  flyToStation       {Function} (stationId) => void
 *  currentTimeStr     {string}   Formatted IST time string
 *  tempUnit           {'C'|'F'}  Active temperature unit
 *  setTempUnit        {Function}
 *  aqiStandard        {'IN'|'US'} Active AQI standard
 *  setAqiStandard     {Function}
 *  apiState           {Object}   { status, alerts, observations }
 */
function Header({
  activeTab, setActiveTab,
  searchQuery, setSearchQuery,
  searchResults, flyToStation,
  currentTimeStr,
  tempUnit, setTempUnit,
  aqiStandard, setAqiStandard,
  apiState,
}) {
  const NAV_TABS = [
    ['weather',     'Weather & Overview'],
    ['forecast',    '7-Day Forecast'],
    ['map',         'Interactive Radar & Map'],
    ['pollutants',  'Pollutants Deep-Dive'],
    ['cml_science', '✦ CML Microwave Radar'],
  ];

  return (
    <header className="sticky top-0 z-50 glass-header">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-3">

        {/* ── Brand Logo ─────────────────────────────────────────── */}
        <div
          className="flex items-center gap-3 shrink-0 cursor-pointer"
          onClick={() => setActiveTab('weather')}
        >
          <div className="w-10 h-10 flex items-center justify-center">
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none" className="drop-shadow">
              <defs>
                <radialGradient id="cloverGrad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%"   stopColor="#4ade80" />
                  <stop offset="60%"  stopColor="#10b981" />
                  <stop offset="100%" stopColor="#047857" />
                </radialGradient>
                <radialGradient id="cloverGradTop" cx="50%" cy="50%" r="50%">
                  <stop offset="0%"   stopColor="#86efac" />
                  <stop offset="70%"  stopColor="#10b981" />
                  <stop offset="100%" stopColor="#059669" />
                </radialGradient>
              </defs>
              <path d="M18 18 C14 10 11 4 15 3 C17.5 2.2 18 5 18 6 C18 5 18.5 2.2 21 3 C25 4 22 10 18 18 Z" fill="url(#cloverGradTop)"/>
              <path d="M18 18 C26 14 32 11 33 15 C33.8 17.5 31 18 30 18 C31 18 33.8 18.5 33 21 C32 25 26 22 18 18 Z" fill="url(#cloverGrad)"/>
              <path d="M18 18 C22 26 25 32 21 33 C18.5 33.8 18 31 18 30 C18 31 17.5 33.8 15 33 C11 32 14 26 18 18 Z" fill="url(#cloverGrad)"/>
              <path d="M18 18 C10 22 4 25 3 21 C2.2 18.5 5 18 6 18 C5 18 2.2 17.5 3 15 C4 11 10 14 18 18 Z" fill="url(#cloverGrad)"/>
              <path d="M18 18 Q16 26 10 32" stroke="#047857" strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.9"/>
              <circle cx="18" cy="18" r="2.8" fill="#d1fae5" stroke="#059669" strokeWidth="0.8"/>
            </svg>
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-black text-2xl tracking-tight text-slate-900 font-heading">CLOVER</span>
              <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-100/70 border border-emerald-300/60 px-1.5 py-0.5 rounded-full">
                v3.4
              </span>
            </div>
            <div className="text-[10px] text-slate-500 font-medium leading-none tracking-wide">
              Greater Noida Weather &amp; Air Quality Engine
            </div>
          </div>
        </div>

        {/* ── Search Bar ─────────────────────────────────────────── */}
        <div className="relative flex-1 max-w-md hidden md:block">
          <div className="relative flex items-center">
            <span className="absolute left-3.5 text-slate-400 text-sm">🔍</span>
            <input
              id="location-search-input"
              type="text"
              placeholder="Search station or sector (e.g. Pari Chowk, Knowledge Park)..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-full glass-subtle text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {searchResults.length > 0 && (
            <div className="absolute top-11 left-0 right-0 glass-dropdown rounded-2xl p-2 z-50 max-h-64 overflow-y-auto">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1">
                Matching Monitoring Stations
              </div>
              {searchResults.map(st => (
                <div
                  key={st.id}
                  onClick={() => flyToStation(st.id)}
                  className="px-3 py-2 rounded-xl hover:bg-emerald-500/10 cursor-pointer text-xs flex justify-between items-center transition-colors gap-2"
                >
                  <div>
                    <div className="font-bold text-slate-800">{st.name}</div>
                    <div className="text-[10px] text-slate-500">{st.district} &bull; {st.type}</div>
                  </div>
                  <span className="text-emerald-700 font-bold text-[11px] shrink-0">Select &rarr;</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right Controls ─────────────────────────────────────── */}
        <div className="flex items-center gap-2.5">
          {/* Sync Live Telemetry Button */}
          <button
            id="sync-live-telemetry-btn"
            onClick={async (e) => {
              const btn = e.currentTarget;
              btn.disabled = true;
              btn.innerText = '⚡ Syncing...';
              try {
                await window.CLOVER_API.syncTelemetry();
                btn.innerText = '✅ Synced';
                setTimeout(() => { btn.innerText = '⚡ Sync Live'; btn.disabled = false; }, 2500);
              } catch {
                btn.innerText = '❌ Failed';
                setTimeout(() => { btn.innerText = '⚡ Sync Live'; btn.disabled = false; }, 2500);
              }
            }}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all flex items-center gap-1 cursor-pointer"
            title="Fetch real-time live dynamic AQI and Weather telemetry from satellite/station feed"
          >
            ⚡ Sync Live
          </button>

          <ApiStatusBadge
            status={apiState.status}
            alertCount={apiState.alerts.length}
            recordCount={apiState.observations.length}
          />

          {/* Clock */}
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-subtle text-slate-700 text-xs font-semibold font-mono">
            <span className="text-emerald-600">🕒</span>
            <span>{currentTimeStr} IST</span>
          </div>

          {/* Temperature unit toggle */}
          <div className="flex items-center glass-subtle rounded-xl p-0.5 border border-white/80">
            {['C', 'F'].map(unit => (
              <button
                key={unit}
                id={`temp-unit-${unit.toLowerCase()}-btn`}
                onClick={() => setTempUnit(unit)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  tempUnit === unit ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                °{unit}
              </button>
            ))}
          </div>

          {/* AQI standard toggle */}
          <button
            id="standard-toggle-btn"
            onClick={() => setAqiStandard(prev => prev === 'IN' ? 'US' : 'IN')}
            className="hidden sm:inline-flex px-3 py-1.5 rounded-xl text-xs font-bold glass-subtle text-slate-700 hover:bg-white/80 transition-colors"
            title="Toggle Standard between Indian CPCB and US EPA"
          >
            Standard: <span className="text-emerald-700 ml-1">{aqiStandard === 'IN' ? 'CPCB' : 'US-EPA'}</span>
          </button>
        </div>
      </div>

      {/* ── Sub-nav Tabs ───────────────────────────────────────────── */}
      <div className="border-t border-white/60 bg-white/40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-1.5 overflow-x-auto py-1.5">
          {NAV_TABS.map(([id, label]) => (
            <button
              key={id}
              id={`nav-${id}`}
              onClick={() => setActiveTab(id)}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                activeTab === id
                  ? 'bg-emerald-600/90 text-white shadow-sm backdrop-blur-md'
                  : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
              }`}
            >
              {label}
              {id === 'cml_science' && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block"/>
              )}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}

window.Header = Header;
