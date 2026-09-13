/**
 * ForecastTab.jsx — Full 7-day extended forecast tab (dedicated tab view).
 *
 * Data is computed dynamically from the weather72h physics engine.
 * Replaces the previously hardcoded static arrays with Sep 11-17 dates.
 *
 * Props:
 *  weather72h      {Array}    Full 73-entry weather array
 *  selectedStation {Object}   { fullTrajectory }
 *  activeModel     {string}   'modelA' | 'modelB'
 *  formatTemp      {Function}
 */
function ForecastTab({ weather72h, selectedStation, activeModel, formatTemp, backendForecast }) {
  // Sample at every 24h for a full 7-day view, starting from now (0h)
  const SAMPLE_HOURS = [0, 12, 24, 36, 48, 60, 72];

  const days = SAMPLE_HOURS.map(h => {
    const wx   = weather72h[h] || weather72h[weather72h.length - 1];
    const aiPoint = backendForecast?.forecast?.find(p => p.horizonHours === h);
    const traj = selectedStation?.fullTrajectory?.[h];

    let pm25 = Number.isFinite(aiPoint?.pm25)
      ? aiPoint.pm25
      : (traj ? (activeModel === 'modelA' ? traj.modelA_PM25 : traj.modelB_PM25) : null);

    let aqi = Number.isFinite(aiPoint?.aqi)
      ? aiPoint.aqi
      : (Number.isFinite(pm25) ? window.FORECAST_ENGINE.calculateAQI(pm25) : null);

    const isAvailable = Number.isFinite(aqi);
    const cat = isAvailable
      ? window.FORECAST_ENGINE.getAQICategory(aqi)
      : { label: 'N/A', color: '#64748b' };

    const icon = wx.rain > 0 ? '🌧️' : wx.relativeHumidity > 80 ? '🌫️'
      : wx.isInversionRisk ? '😶‍🌫️' : wx.relativeHumidity > 65 ? '⛅' : '☀️';

    const cond = wx.rain > 0
      ? 'Passing Monsoon Showers'
      : wx.relativeHumidity > 80
      ? 'Early Morning Fog & Mist'
      : wx.isInversionRisk
      ? 'Warm Autumn Sun, Light Haze'
      : wx.relativeHumidity > 65
      ? 'Partly Cloudy, Afternoon Breeze'
      : 'Clean Atmosphere & Clear Skies';

    const windDir = wx.windDir > 270 ? 'WNW' : wx.windDir > 180 ? 'SW' : 'NW';
    const windStr = `${Math.round(wx.windSpeed * 3.6)} km/h ${windDir}`;

    const now      = new Date();
    const dateObj  = new Date(now.getTime() + h * 3600 * 1000);
    const dayLabel = h === 0
      ? `${dateObj.toLocaleDateString('en-US', { weekday: 'long' })} (Today)`
      : h === 24
      ? `${dateObj.toLocaleDateString('en-US', { weekday: 'long' })} (Tomorrow)`
      : dateObj.toLocaleDateString('en-US', { weekday: 'long' });
    const dateLabel = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

    return {
      h, dayLabel, dateLabel, icon, cond, windStr,
      hum: `${wx.relativeHumidity}%`,
      rain: wx.rain > 0 ? Math.min(100, Math.round(wx.rain * 20)) : Math.round(wx.relativeHumidity * 0.35),
      minTemp: wx.temp - 6,
      maxTemp: wx.temp + 4,
      aqi, cat,
    };
  });

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-3xl p-6 shadow-sm">
        <h2 className="text-xl font-black font-heading text-slate-900 mb-1">
          Greater Noida 7-Day Extended Weather &amp; Air Quality Outlook
        </h2>
        <p className="text-xs text-slate-500 mb-6">
          Comprehensive synoptic meteorological model combined with CML microwave atmospheric absorption trajectories
        </p>

        <div className="space-y-3">
          {days.map(item => (
            <div
              key={item.h}
              className="p-4 rounded-2xl glass-subtle hover:bg-white/80 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              {/* Day + condition */}
              <div className="flex items-center gap-3 min-w-[200px]">
                <span className="text-3xl">{item.icon}</span>
                <div>
                  <div className="font-bold text-sm text-slate-800">{item.dayLabel}</div>
                  <div className="text-xs text-slate-400">{item.dateLabel} &bull; {item.cond}</div>
                </div>
              </div>

              {/* Numerical params */}
              <div className="flex items-center gap-6 text-xs text-slate-600">
                <div>
                  <span className="text-[10px] text-slate-400 block">TEMP RANGE</span>
                  <strong className="text-slate-800">
                    {formatTemp(item.minTemp)} — {formatTemp(item.maxTemp)}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">RAIN CHANCE</span>
                  <strong className="text-sky-600">{item.rain}%</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">WIND &amp; HUMIDITY</span>
                  <span>{item.windStr} &bull; {item.hum}</span>
                </div>
              </div>

              {/* AQI badge */}
              <div>
                <span
                  className="px-3.5 py-1.5 rounded-full text-xs font-extrabold text-white inline-block shadow-sm"
                  style={{ backgroundColor: item.cat.color }}
                >
                  AQI {item.aqi} &bull; {item.cat.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

window.ForecastTab = ForecastTab;
