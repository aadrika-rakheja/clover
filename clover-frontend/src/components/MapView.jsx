/**
 * MapView.jsx — State-of-the-Art Interactive Radar & Atmospheric Map.
 *
 * Features:
 *  - 360° continuous sweeping radar scanner beam overlay
 *  - Concentric distance range rings (10km, 25km, 50km) centered on Greater Noida
 *  - High-tech Radar HUD with real-time telemetry (Azimuth, Scan Status, Target Lock)
 *  - Mode switcher:
 *     1. Air Quality (AQI) Radar (powered by AI/NWP dispersion models)
 *     2. Precipitation & Weather Radar (precipitation reflectivity & moisture)
 *  - Layer toggles: AQI Heatmap, Monitoring Stations, Wind Vectors, NASA Thermal Hotspots
 *  - Clean UI without any CML microwave links or clutter
 */
function MapView({
  weatherFieldMode = 'aqi',
  setWeatherFieldMode,
  layers,
  setLayers,
  mapRef,
  activeModel = 'modelB',
  selectedHour = 0,
  selectedStation,
  currentWx,
  formatTemp,
  centerMap,
  telemetryTick = 0,
  lastSyncTime,
}) {
  const { useState } = React;
  const [sweepActive, setSweepActive] = useState(true);
  const [ringsActive, setRingsActive] = useState(true);

  const layerControls = [
    { key: 'field',    label: 'AQI Heatmap', icon: '🌫️' },
    { key: 'stations', label: 'Air Stations', icon: '📍' },
    { key: 'wind',     label: 'Wind Vectors', icon: '💨' },
    { key: 'fires',    label: 'Hotspots',     icon: '🔥' },
  ];

  return (
    <div className="space-y-4">
      {/* ── Radar Control Console ────────────────────────────────────── */}
      <div className="glass-card rounded-3xl p-4 sm:p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          
          {/* Left: Mode buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 mr-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"/>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"/>
              </span>
              <span className="text-xs font-black font-heading uppercase tracking-wider text-slate-800">
                Radar Mode:
              </span>
            </div>

            <button
              id="radar-mode-aqi-btn"
              onClick={() => setWeatherFieldMode('aqi')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                weatherFieldMode === 'aqi'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'glass-subtle text-slate-600 hover:bg-white'
              }`}
            >
              <span>🟢</span>
              <span>Air Quality (AQI) Radar</span>
            </button>

            <button
              id="radar-mode-rain-btn"
              onClick={() => setWeatherFieldMode('rain')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                weatherFieldMode === 'rain'
                  ? 'bg-sky-600 text-white shadow-md'
                  : 'glass-subtle text-slate-600 hover:bg-white'
              }`}
            >
              <span>🌧️</span>
              <span>Precipitation &amp; Rain Radar</span>
            </button>
          </div>

          {/* Right: Quick Radar Toggles */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <button
              onClick={() => setSweepActive(prev => !prev)}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all border ${
                sweepActive
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-sm'
                  : 'glass-subtle text-slate-500 border-slate-200 hover:bg-white'
              }`}
              title="Toggle rotating radar sweep animation"
            >
              📡 Sweep Beam: <strong>{sweepActive ? 'ON' : 'OFF'}</strong>
            </button>

            <button
              onClick={() => setRingsActive(prev => !prev)}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all border ${
                ringsActive
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-sm'
                  : 'glass-subtle text-slate-500 border-slate-200 hover:bg-white'
              }`}
              title="Toggle distance range rings (10km, 25km, 50km)"
            >
              🎯 Range Rings: <strong>{ringsActive ? 'ON' : 'OFF'}</strong>
            </button>

            {centerMap && (
              <button
                onClick={centerMap}
                className="px-3 py-1.5 rounded-xl font-bold glass-subtle text-slate-700 hover:bg-white transition-all border border-slate-200"
                title="Re-center map on Greater Noida"
              >
                📍 Center
              </button>
            )}
          </div>
        </div>

        {/* Sub-row: Layer checkboxes */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-4 flex-wrap text-xs font-semibold text-slate-600">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Telemetry Layers:
            </span>
            {layerControls.map(({ key, label, icon }) => (
              <label key={key} className="flex items-center gap-1.5 cursor-pointer hover:text-slate-900 transition-colors">
                <input
                  type="checkbox"
                  checked={layers[key] ?? true}
                  onChange={e => setLayers({ ...layers, [key]: e.target.checked })}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>{icon}</span>
                <span>{label}</span>
              </label>
            ))}
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
            <span>Model: <strong className="text-emerald-700">{activeModel === 'modelB' ? '✦ Atmospheric Radar AI' : 'Baseline NWP'}</strong></span>
            <span>•</span>
            <span>Forecast: <strong className="text-slate-800">+{selectedHour}h</strong></span>
          </div>
        </div>
      </div>

      {/* ── Interactive Radar Map Viewport ─────────────────────────── */}
      <div className="w-full h-[540px] sm:h-[620px] rounded-3xl overflow-hidden glass-card shadow-lg relative radar-container border border-white/90">
        
        {/* Leaflet Map DOM mount node */}
        <div ref={mapRef} className="w-full h-full"/>

        {/* High-Tech Radar HUD Overlay */}
        <div className="radar-overlay-grid pointer-events-none">
          
          {/* Radar Sweep Beam (rotates continuously if active) */}
          {sweepActive && (
            <div className={`radar-sweep-beam ${weatherFieldMode === 'rain' ? 'weather-radar-mode' : ''}`}/>
          )}

          {/* Concentric Range Rings */}
          {ringsActive && (
            <>
              {/* 10 km Ring */}
              <div
                className={`radar-range-ring ${weatherFieldMode === 'rain' ? 'weather-ring' : ''}`}
                style={{ width: '160px', height: '160px' }}
              >
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] font-mono font-bold text-emerald-800/80 bg-white/70 px-1 rounded">
                  10 km
                </span>
              </div>

              {/* 25 km Ring */}
              <div
                className={`radar-range-ring ${weatherFieldMode === 'rain' ? 'weather-ring' : ''}`}
                style={{ width: '320px', height: '320px' }}
              >
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] font-mono font-bold text-emerald-800/80 bg-white/70 px-1 rounded">
                  25 km
                </span>
              </div>

              {/* 50 km Ring */}
              <div
                className={`radar-range-ring ${weatherFieldMode === 'rain' ? 'weather-ring' : ''}`}
                style={{ width: '520px', height: '520px' }}
              >
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] font-mono font-bold text-emerald-800/80 bg-white/70 px-1 rounded">
                  50 km Coverage
                </span>
              </div>
            </>
          )}

          {/* Top-Left Telemetry HUD Badge */}
          <div className="absolute top-4 left-4 z-20 pointer-events-auto">
            <div className="radar-hud-pill rounded-2xl px-3.5 py-2 text-xs flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"/>
              <div>
                <div className="font-extrabold text-slate-900 tracking-wide flex items-center gap-1.5 flex-wrap">
                  <span>RADAR SCAN ACTIVE</span>
                  <span className="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-100/80 px-1.5 py-0.2 rounded">
                    360° LIVE
                  </span>
                  <span className="text-[10px] font-mono text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded font-semibold">
                    SYNC #{telemetryTick}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                  Coverage: Greater Noida &bull; Live Telemetry Synced
                </div>
              </div>
            </div>
          </div>

          {/* Top-Right Weather/Compass Telemetry */}
          <div className="absolute top-4 right-4 z-20 pointer-events-auto hidden sm:block">
            <div className="radar-hud-pill rounded-2xl px-3 py-2 text-xs font-mono text-slate-700">
              <div className="flex items-center gap-2">
                <span className="text-emerald-600 font-bold">AZIMUTH:</span>
                <span className="font-bold">000° NORTH</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Elev: 201m &bull; Scan Gain: +18.4 dB
              </div>
            </div>
          </div>

          {/* Bottom-Left Spectrum Legend */}
          <div className="absolute bottom-4 left-4 z-20 pointer-events-auto">
            <div className="radar-hud-pill rounded-2xl p-3 text-xs max-w-xs">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                {weatherFieldMode === 'aqi' ? 'Air Quality Index Scale' : 'Precipitation Reflectivity'}
              </div>
              {weatherFieldMode === 'aqi' ? (
                <div>
                  <div className="aqi-scale-strip w-full mb-1.5"/>
                  <div className="flex justify-between text-[9px] font-mono text-slate-500">
                    <span className="text-emerald-600 font-bold">0 Good</span>
                    <span className="text-amber-600 font-bold">150 Mod</span>
                    <span className="text-rose-600 font-bold">300+ Severe</span>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="h-1.5 rounded-full w-full mb-1.5 bg-gradient-to-r from-sky-300 via-blue-500 to-indigo-600"/>
                  <div className="flex justify-between text-[9px] font-mono text-slate-500">
                    <span>0 mm/h</span>
                    <span>2.5 mm/h</span>
                    <span>10+ mm/h Downpour</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom-Right Selected Station Peek Card */}
          {selectedStation && (
            <div className="absolute bottom-4 right-12 z-20 pointer-events-auto hidden md:block">
              <div className="radar-hud-pill rounded-2xl px-3.5 py-2.5 text-xs">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Locked Target Station</div>
                <div className="font-extrabold text-slate-900 mt-0.5">{selectedStation.station.name}</div>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                  Type: {selectedStation.station.type} &bull; Lat {selectedStation.station.lat}°
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

window.MapView = MapView;
