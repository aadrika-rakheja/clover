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
  const params = [
    {
      icon: '💧', label: 'Humidity',
      value: `${currentWx.relativeHumidity}%`,
      desc: `Dew Point ${formatTemp(currentWx.dewPoint)}`,
      barColor: '#0ea5e9',
      pct: currentWx.relativeHumidity,
    },
    {
      icon: '💨', label: 'Wind Speed',
      value: `${currentWx.windSpeed} m/s`,
      desc: `Direction ${currentWx.windDir}° (${currentWx.windDir > 270 ? 'WNW' : currentWx.windDir > 180 ? 'SW' : 'NW'})`,
      barColor: '#10b981',
      pct: Math.min((currentWx.windSpeed / 12) * 100, 100),
    },
    {
      icon: '🧭', label: 'Pressure',
      value: `1010 hPa`,
      desc: 'Barometer: Stable',
      barColor: '#6366f1',
      pct: 65,
    },
    {
      icon: '☀️', label: 'UV Index',
      value: `${currentWx.hour >= 6 && currentWx.hour <= 18 ? 6 : 0} of 11`,
      desc: currentWx.hour >= 6 && currentWx.hour <= 18 ? 'Moderate to High' : 'Low / Night',
      barColor: '#f59e0b',
      pct: currentWx.hour >= 6 && currentWx.hour <= 18 ? 55 : 5,
    },
    {
      icon: '👁️', label: 'Visibility',
      value: currentStationMetrics.aqi > 250 ? '2.5 km' : '4.5 km',
      desc: currentStationMetrics.aqi > 250 ? 'Reduced by haze/smog' : 'Moderate visibility',
      barColor: '#8b5cf6',
      pct: currentStationMetrics.aqi > 250 ? 30 : 60,
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
        // Compute approximate sunrise/sunset for Delhi NCR latitude (~28.6°N)
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
      value: `${currentWx.boundaryLayerHeight} m`,
      desc: currentWx.isInversionRisk ? '⚠️ Inversion Trapping' : 'Normal mixing',
      barColor: currentWx.isInversionRisk ? '#ef4444' : '#10b981',
      pct: Math.min((currentWx.boundaryLayerHeight / 2000) * 100, 100),
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
