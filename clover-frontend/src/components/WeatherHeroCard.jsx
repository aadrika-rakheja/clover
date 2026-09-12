/**
 * WeatherHeroCard.jsx — left hero card showing current temperature & conditions.
 *
 * Props:
 *  currentWx         {Object}  Current weather hour object from weather72h
 *  formatTemp        {Function} (celsius) => formatted string
 *  cmlDerivedRainRate {number} CML-derived precipitation rate mm/h
 */
function WeatherHeroCard({ currentWx, formatTemp, cmlDerivedRainRate }) {
  function getConditionIcon(wx) {
    if (wx.rain > 0)              return '🌧️';
    if (wx.relativeHumidity > 80) return '🌫️';
    if (wx.isInversionRisk)       return '😶‍🌫️';
    if (wx.relativeHumidity > 65) return '⛅';
    return '☀️';
  }

  function getConditionLabel(wx) {
    if (wx.rain > 0)              return '🌧️ Light to Moderate Rain';
    if (wx.relativeHumidity > 80) return '🌫️ Dense Fog & Mist';
    if (wx.isInversionRisk)       return '😶‍🌫️ Smoggy Haze';
    if (wx.relativeHumidity > 65) return '🌥️ Partly Cloudy';
    return '☀️ Sunny & Clear';
  }

  return (
    <div className="lg:col-span-7 glass-card rounded-3xl p-6 flex flex-col justify-between shadow-sm">
      <div>
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Current Weather
          </span>
          <span className="text-xs text-slate-500 font-mono">
            {currentWx.timestamp}
          </span>
        </div>

        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Big temperature & condition */}
          <div>
            <div className="text-6xl sm:text-7xl font-black font-heading text-slate-900 leading-none tracking-tight">
              {formatTemp(currentWx.temp)}
            </div>
            <div className="text-base font-bold text-slate-700 mt-2 flex items-center gap-2">
              <span>{getConditionLabel(currentWx)}</span>
              <span className="text-slate-300">•</span>
              <span className="text-xs text-slate-500 font-normal">
                Feels like <strong className="text-slate-700">{formatTemp(currentWx.temp + 3)}</strong>
              </span>
            </div>
          </div>

          {/* Weather emoji graphic */}
          <div className="text-6xl sm:text-7xl drop-shadow-md">
            {getConditionIcon(currentWx)}
          </div>
        </div>

        {/* Day high / low */}
        <div className="mt-5 pt-4 border-t border-slate-200/60 flex items-center gap-4 text-xs font-semibold text-slate-600 flex-wrap">
          <span className="flex items-center gap-1 text-rose-600">
            ▲ Max: <strong>{formatTemp(currentWx.temp + 4)}</strong>
          </span>
          <span className="text-slate-300">|</span>
          <span className="flex items-center gap-1 text-sky-600">
            ▼ Min: <strong>{formatTemp(currentWx.temp - 6)}</strong>
          </span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-500 font-normal">
            Dew Point: <strong className="text-slate-700">{formatTemp(currentWx.dewPoint)}</strong>
          </span>
        </div>
      </div>

      {/* CML microwave rain strip */}
      <div className="mt-5 p-3.5 rounded-2xl glass-subtle text-xs text-slate-600 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-base">📡</span>
          <span>
            CML Microwave Rain Radar:{' '}
            <strong className="text-emerald-700">{cmlDerivedRainRate} mm/h</strong>
            {' '}(Atmospheric link tomogram)
          </span>
        </div>
        <span className="hidden sm:inline text-[11px] font-mono text-slate-400">
          Confidence: 98.4%
        </span>
      </div>
    </div>
  );
}

window.WeatherHeroCard = WeatherHeroCard;
