/**
 * HourlyForecast.jsx — 36-hour horizontal scroll cards + time slider + playback.
 *
 * Props:
 *  weather72h       {Array}    Full 73-entry weather array
 *  selectedStation  {Object}   { fullTrajectory }
 *  selectedHour     {number}   Active hour index
 *  setSelectedHour  {Function}
 *  isPlaying        {boolean}
 *  setIsPlaying     {Function}
 *  playSpeed        {number}   0.5 | 1 | 2
 *  setPlaySpeed     {Function}
 *  activeModel      {string}   'modelA' | 'modelB'
 *  formatTemp       {Function}
 */
function HourlyForecast({
  weather72h, selectedStation, selectedHour, setSelectedHour,
  isPlaying, setIsPlaying, playSpeed, setPlaySpeed,
  activeModel, formatTemp,
}) {
  return (
    <div className="glass-card rounded-3xl p-5 shadow-sm">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/60 mb-4">
        <div>
          <h2 className="text-base font-black font-heading text-slate-900">
            Greater Noida Hourly Weather &amp; AQI Forecast
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Continuous 72-hour trajectory with CML microwave precipitation and inversion coupling
          </p>
        </div>

        {/* Playback controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedHour(0)}
            className="px-2.5 py-1 rounded-xl glass-subtle hover:bg-white text-xs font-bold text-slate-600 transition-colors"
          >
            Now
          </button>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`px-3 py-1 rounded-xl text-xs font-bold text-white transition-all shadow-sm flex items-center gap-1 ${
              isPlaying ? 'bg-rose-500 hover:bg-rose-600' : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            <span>{isPlaying ? '⏸ Pause' : '▶ Play'}</span>
          </button>
          <div className="flex items-center glass-subtle rounded-xl p-0.5 text-xs font-bold text-slate-600">
            {[0.5, 1, 2].map(spd => (
              <button
                key={spd}
                onClick={() => setPlaySpeed(spd)}
                className={`px-2 py-0.5 rounded-lg transition-all ${
                  playSpeed === spd ? 'bg-white shadow text-emerald-700' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {spd}×
              </button>
            ))}
          </div>
          <span className="text-xs font-mono font-bold text-slate-600 pl-1">
            +{selectedHour}h
          </span>
        </div>
      </div>

      {/* Horizontal scroll cards */}
      <div className="forecast-scroll flex gap-2.5 overflow-x-auto pb-3 pt-1">
        {weather72h.slice(0, 36).map((wx, idx) => {
          const stForecast = selectedStation.fullTrajectory[idx];
          const pm25H = stForecast
            ? (activeModel === 'modelA' ? stForecast.modelA_PM25 : stForecast.modelB_PM25)
            : 180;
          const aqiH = window.FORECAST_ENGINE.calculateAQI(pm25H);
          const catH = window.FORECAST_ENGINE.getAQICategory(aqiH);
          const isSelected = selectedHour === idx;
          const icon = wx.rain > 0 ? '🌧️' : wx.relativeHumidity > 80 ? '🌫️'
            : wx.isInversionRisk ? '😶‍🌫️' : wx.relativeHumidity > 65 ? '🌥️' : '☀️';

          return (
            <div
              key={idx}
              onClick={() => setSelectedHour(idx)}
              className={`shrink-0 w-24 p-3 rounded-2xl text-center cursor-pointer forecast-hour-card transition-all ${
                isSelected
                  ? 'bg-emerald-500/15 border-2 border-emerald-500 shadow-md backdrop-blur-md'
                  : 'glass-subtle hover:bg-white/90 border border-white/80'
              }`}
            >
              <div className="text-[11px] font-bold text-slate-500">
                {idx === 0 ? 'Now' : `+${idx}h`}
              </div>
              <div className="text-2xl my-1.5">{icon}</div>
              <div className="text-sm font-black font-heading text-slate-900">
                {formatTemp(wx.temp)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {wx.rain > 0 ? `${wx.rain}mm` : `${wx.relativeHumidity}%`}
              </div>
              <div
                className="mt-2 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold text-white"
                style={{ backgroundColor: catH.color }}
              >
                AQI {aqiH}
              </div>
            </div>
          );
        })}
      </div>

      {/* Time slider */}
      <div className="mt-3 pt-2">
        <input
          type="range" min="0" max="72"
          value={selectedHour}
          onChange={e => setSelectedHour(parseInt(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-1">
          <span>Current (0h)</span>
          <span>+24h (Tomorrow)</span>
          <span>+48h (Day 2)</span>
          <span>+72h (Day 3)</span>
        </div>
      </div>
    </div>
  );
}

window.HourlyForecast = HourlyForecast;
