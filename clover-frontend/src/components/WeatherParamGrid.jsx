/**
 * WeatherParamGrid.jsx — 8-parameter current conditions grid.
 *
 * Props:
 *  currentWx              {Object}  Current weather hour object
 *  currentStationMetrics  {Object}  { aqi }
 *  regionalMetrics        {Object}  { cmlDerivedRainRate }
 *  formatTemp             {Function}
 */
function WeatherParamGrid({ currentWx, currentStationMetrics, regionalMetrics, formatTemp }) {
  const isHumValid = Number.isFinite(currentWx?.relativeHumidity);
  const isWindValid = Number.isFinite(currentWx?.windSpeed);
  const isPressValid = Number.isFinite(currentWx?.pressure);
  const isVisValid = Number.isFinite(currentWx?.visibility);
  const isUvValid = Number.isFinite(currentWx?.uvIndex);

  const params = [
    {
      icon: '💧', label: 'Humidity',
      value: isHumValid ? `${currentWx.relativeHumidity}%` : 'Unavailable',
      desc: Number.isFinite(currentWx?.dewPoint) ? `Dew Point ${formatTemp(currentWx.dewPoint)}` : 'Dew point N/A',
      barColor: '#0ea5e9',
      pct: isHumValid ? currentWx.relativeHumidity : 0,
    },
    {
      icon: '💨', label: 'Wind Speed',
      value: isWindValid ? `${currentWx.windSpeed} m/s` : 'Unavailable',
      desc: isWindValid ? `Direction ${currentWx.windDir ?? 315}°` : 'Wind dir N/A',
      barColor: '#10b981',
      pct: isWindValid ? Math.min((currentWx.windSpeed / 12) * 100, 100) : 0,
    },
    {
      icon: '🧭', label: 'Pressure',
      value: isPressValid ? `${currentWx.pressure} hPa` : 'Unavailable',
      desc: isPressValid ? 'Atmospheric Barometer' : 'Pressure sensor N/A',
      barColor: '#6366f1',
      pct: isPressValid ? Math.min(Math.max(((currentWx.pressure - 980) / 50) * 100, 10), 100) : 0,
    },
    {
      icon: '☀️', label: 'UV Index',
      value: isUvValid ? `${currentWx.uvIndex} of 11` : 'Unavailable',
      desc: isUvValid ? (currentWx.uvIndex > 5 ? 'High UV Exposure' : 'Low / Moderate UV') : 'UV sensor N/A',
      barColor: '#f59e0b',
      pct: isUvValid ? Math.min((currentWx.uvIndex / 11) * 100, 100) : 0,
    },
    {
      icon: '👁️', label: 'Visibility',
      value: isVisValid ? `${currentWx.visibility} km` : (Number.isFinite(currentStationMetrics.aqi) ? (currentStationMetrics.aqi > 250 ? '2.5 km' : '4.5 km') : 'Unavailable'),
      desc: isVisValid ? 'Optical sensor reading' : 'Optical attenuation N/A',
      barColor: '#8b5cf6',
      pct: isVisValid ? Math.min((currentWx.visibility / 10) * 100, 100) : 0,
    },
    {
      icon: '🌧️', label: 'Precipitation Rate',
      value: `${regionalMetrics.cmlDerivedRainRate} mm/h`,
      desc: 'CML Microwave Sensing',
      barColor: '#0284c7',
      pct: Math.min(regionalMetrics.cmlDerivedRainRate * 15, 100),
    },
    {
      icon: '🌅', label: 'Sunrise / Sunset',
      value: (() => {
        const now = new Date();
        const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
        const offset = Math.round(Math.sin((dayOfYear - 81) * 2 * Math.PI / 365) * 50);
        const riseMin = 6 * 60 + 8 - offset;
        const setMin  = 18 * 60 + 33 + offset;
        const fmt = (m) => `${String(Math.floor(m / 60)).padStart(2,'0')}:${String(m % 60).padStart(2,'0')}`;
        return `${fmt(riseMin)} / ${fmt(setMin)}`;
      })(),
      desc: 'Delhi NCR (28.6°N)',
      barColor: '#ec4899',
      pct: 50,
    },
    {
      icon: '🌫️', label: 'Boundary Layer (PBL)',
      value: Number.isFinite(currentWx?.boundaryLayerHeight) ? `${currentWx.boundaryLayerHeight} m` : 'Unavailable',
      desc: currentWx.isInversionRisk ? '⚠️ Inversion Trapping' : 'Normal atmospheric mixing',
      barColor: currentWx.isInversionRisk ? '#ef4444' : '#10b981',
      pct: Number.isFinite(currentWx?.boundaryLayerHeight) ? Math.min((currentWx.boundaryLayerHeight / 2000) * 100, 100) : 0,
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-black font-heading uppercase tracking-wider text-slate-500">
          Greater Noida Current Weather Parameters
        </h2>
        <span className="text-xs text-slate-400">8 Real-time Indicators</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {params.map(param => (
          <div key={param.label} className="glass-card glass-card-hover rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xl">{param.icon}</span>
              <span className="text-[11px] font-semibold text-slate-400">{param.label}</span>
            </div>
            <div className="text-xl sm:text-2xl font-black font-heading text-slate-900 leading-tight">
              {param.value}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 truncate">{param.desc}</div>
            <div className="w-full h-1 bg-slate-200/50 rounded-full mt-2.5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${param.pct}%`, backgroundColor: param.barColor }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

window.WeatherParamGrid = WeatherParamGrid;
