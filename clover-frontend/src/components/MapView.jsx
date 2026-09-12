/**
 * MapView.jsx — Interactive Radar & Map tab.
 *
 * Contains the map mode switcher, layer toggles, and the Leaflet map canvas.
 * The actual Leaflet map lifecycle is managed in app.jsx via refs because the
 * map must persist across tab switches (re-mounting destroys the Leaflet instance).
 * This component renders the controls UI and the div container the map attaches to.
 *
 * Props:
 *  weatherFieldMode    {string}   'aqi' | 'cml_rain'
 *  setWeatherFieldMode {Function}
 *  layers              {Object}   { field, stations, cml, wind, fires }
 *  setLayers           {Function}
 *  mapRef              {Ref}      React ref attached to the map container div
 */
function MapView({ weatherFieldMode, setWeatherFieldMode, layers, setLayers, mapRef }) {
  const layerControls = [
    { key: 'stations', label: 'Stations' },
    { key: 'cml',      label: 'CML Microwave Links' },
    { key: 'wind',     label: 'Wind Vectors' },
    { key: 'fires',    label: 'Upwind Hotspots' },
  ];

  return (
    <div className="space-y-4">
      {/* Controls bar */}
      <div className="glass-card rounded-3xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        {/* Map mode buttons */}
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-slate-800">Map Mode:</span>
          <button
            onClick={() => setWeatherFieldMode('aqi')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              weatherFieldMode === 'aqi'
                ? 'bg-emerald-600 text-white shadow'
                : 'glass-subtle text-slate-600 hover:bg-white'
            }`}
          >
            Air Quality (AQI) Heatmap
          </button>
          <button
            onClick={() => setWeatherFieldMode('cml_rain')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              weatherFieldMode === 'cml_rain'
                ? 'bg-sky-600 text-white shadow'
                : 'glass-subtle text-slate-600 hover:bg-white'
            }`}
          >
            CML Microwave Rain Radar
          </button>
        </div>

        {/* Layer checkboxes */}
        <div className="flex items-center gap-3 text-xs font-semibold text-slate-600 flex-wrap">
          {layerControls.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={layers[key]}
                onChange={e => setLayers({ ...layers, [key]: e.target.checked })}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Leaflet map canvas container */}
      <div className="w-full h-[600px] rounded-3xl overflow-hidden glass-card shadow-md relative">
        <div ref={mapRef} className="w-full h-full"/>
      </div>
    </div>
  );
}

window.MapView = MapView;
