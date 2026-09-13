/**
 * AQICard.jsx — Air Quality Index donut display with health messaging.
 *
 * Props:
 *  currentStationMetrics  {Object}  { aqi, aqiCategory, pm25 }
 *  aqiStandard            {'IN'|'US'}
 */
function AQICard({ currentStationMetrics, aqiStandard }) {
  const { aqi, aqiCategory, pm25 } = currentStationMetrics;
  const color = aqiCategory.color;

  // SVG donut parameters
  const r    = 64;
  const circ = 2 * Math.PI * r;
  const pct  = Math.min(aqi / 500, 1);
  const dash = circ * pct;

  function getHealthMessage(aqi) {
    if (aqi > 300) return 'Severe emergency! Healthy people may experience respiratory illness; serious risk to those with pre-existing conditions.';
    if (aqi > 200) return 'Very Poor air quality. Significant breathing discomfort to people on prolonged exposure; avoid morning jogs.';
    if (aqi > 100) return 'Poor to Moderate air quality. Sensitive individuals should wear masks outdoors and avoid strenuous exertion.';
    return 'Air quality is satisfactory and poses little or no risk to public health.';
  }

  return (
    <div className="lg:col-span-5 glass-card rounded-3xl p-6 flex flex-col justify-between shadow-sm">
      <div>
        {/* Header row */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Air Quality Index (AQI)
          </span>
          <span
            className="px-3 py-0.5 rounded-full text-xs font-extrabold"
            style={{
              backgroundColor: color + '22',
              color,
              border: `1px solid ${color}55`,
            }}
          >
            {aqiCategory.label}
          </span>
        </div>

        {/* Donut circle */}
        <div className="flex items-center justify-center my-2">
          <div className="relative w-44 h-44 flex items-center justify-center">
            <svg
              width="176" height="176" viewBox="0 0 176 176"
              style={{ transform: 'rotate(-90deg)', position: 'absolute' }}
            >
              <circle cx="88" cy="88" r={r} fill="none" stroke="rgba(203, 213, 225, 0.4)" strokeWidth="16"/>
              <circle
                cx="88" cy="88" r={r} fill="none"
                stroke={color} strokeWidth="16"
                strokeDasharray={`${dash} ${circ - dash}`}
                strokeLinecap="round"
              />
            </svg>
            <div className="text-center z-10">
              <div className="text-4xl sm:text-5xl font-black font-heading leading-none" style={{ color: Number.isFinite(aqi) ? color : '#64748b' }}>
                {Number.isFinite(aqi) ? aqi : 'N/A'}
              </div>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                AQI ({aqiStandard})
              </div>
              <div className="text-xs font-bold mt-0.5 text-slate-700">
                PM2.5: {Number.isFinite(pm25) ? `${pm25} µg/m³` : 'Unavailable'}
              </div>
            </div>
          </div>
        </div>

        {/* Health message */}
        <div className="text-xs text-slate-600 text-center px-2 mt-1">
          {getHealthMessage(aqi)}
        </div>
      </div>

      {/* WHO comparison footer */}
      <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-500">
        <span>Prominent Pollutant: <strong className="text-slate-800">PM2.5</strong></span>
        <span className="text-rose-600 font-bold">
          {Number.isFinite(pm25) ? `${(pm25 / 15).toFixed(1)}× WHO Limit` : 'WHO Limit: 15 µg/m³'}
        </span>
      </div>
    </div>
  );
}

window.AQICard = AQICard;
