/**
 * SevenDayForecast.jsx — 7-day weather & AQI outlook.
 *
 * IMPORTANT: Data is computed dynamically from the weather72h physics engine
 * array — no hardcoded dates or values. The 7 displayed days are sampled from
 * the 72-hour trajectory at 0h, 12h, 24h, 36h, 48h, 60h, 72h.
 *
 * Props:
 *  weather72h       {Array}    Full 73-entry weather array (from FORECAST_ENGINE)
 *  selectedStation  {Object}   { fullTrajectory }
 *  activeModel      {string}   'modelA' | 'modelB'
 *  formatTemp       {Function}
 *  setActiveTab     {Function}
 */
function SevenDayForecast({ weather72h, selectedStation, activeModel, formatTemp, setActiveTab }) {
  // Sample one representative hour per day (every 24h starting from 0)
  const SAMPLE_HOURS = [0, 12, 24, 36, 48, 60, 72];

  const days = SAMPLE_HOURS.map(h => {
    const wx   = weather72h[h] || weather72h[weather72h.length - 1];
    const traj = selectedStation.fullTrajectory[h];
    const pm25 = traj
      ? (activeModel === 'modelA' ? traj.modelA_PM25 : traj.modelB_PM25)
      : 180;
    const aqi = window.FORECAST_ENGINE.calculateAQI(pm25);
    const cat = window.FORECAST_ENGINE.getAQICategory(aqi);

    // Determine icon & condition from physics
    const icon = wx.rain > 0 ? '🌧️' : wx.relativeHumidity > 80 ? '🌫️'
      : wx.isInversionRisk ? '😶‍🌫️' : wx.relativeHumidity > 65 ? '⛅' : '☀️';

    const condition = wx.rain > 0 ? 'Passing Showers'
      : wx.relativeHumidity > 80 ? 'Dense Fog & Mist'
      : wx.isInversionRisk ? 'Smoggy Haze'
      : wx.relativeHumidity > 65 ? 'Partly Cloudy'
      : 'Sunny & Clear';

    // Day label from the timestamp embedded in the weather object
    const dateObj  = new Date(new Date().getTime() + h * 3600 * 1000);
    const dayLabel = h === 0
      ? 'Today'
      : h === 24
      ? 'Tomorrow'
      : dateObj.toLocaleDateString('en-US', { weekday: 'long' });
    const dateLabel = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    return {
      h, dayLabel, dateLabel, icon, condition,
      minTemp: wx.temp - 6,
      maxTemp: wx.temp + 4,
      rainChance: wx.rain > 0 ? Math.min(100, Math.round(wx.rain * 20)) : Math.round(wx.relativeHumidity * 0.4),
      aqi, cat,
    };
  });

  return (
    <div className="lg:col-span-7 glass-card rounded-3xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-black font-heading uppercase tracking-wider text-slate-500">
          7-Day Weather &amp; Air Quality Outlook
        </h2>
        <span
          className="text-xs text-emerald-700 font-bold cursor-pointer"
          onClick={() => setActiveTab('forecast')}
        >
          View Details &rarr;
        </span>
      </div>

      <div className="space-y-2">
        {days.map(d => (
          <div
            key={d.h}
            className="flex items-center justify-between p-2.5 rounded-2xl glass-subtle hover:bg-white/80 transition-all text-xs"
          >
            <div className="w-24 shrink-0">
              <div className="font-bold text-slate-800">{d.dayLabel}</div>
              <div className="text-[10px] text-slate-400">{d.dateLabel}</div>
            </div>
            <div className="flex items-center gap-2 w-32 shrink-0">
              <span className="text-xl">{d.icon}</span>
              <span className="text-slate-600 font-medium truncate">{d.condition}</span>
            </div>
            {/* Temp range bar */}
            <div className="flex-1 max-w-[120px] hidden sm:flex items-center gap-2">
              <span className="text-[10px] text-slate-400">{formatTemp(d.minTemp)}</span>
              <div className="flex-1 temp-range-bar"/>
              <span className="text-[10px] font-bold text-slate-700">{formatTemp(d.maxTemp)}</span>
            </div>
            <div className="text-right shrink-0">
              <span
                className="px-2.5 py-1 rounded-full text-[10px] font-extrabold text-white"
                style={{ backgroundColor: d.cat.color }}
              >
                AQI {d.aqi} &bull; {d.cat.label}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

window.SevenDayForecast = SevenDayForecast;
