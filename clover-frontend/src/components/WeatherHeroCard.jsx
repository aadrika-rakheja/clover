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
              {Number.isFinite(currentWx?.temp) ? formatTemp(currentWx.temp) : 'Unavailable'}
            </div>
            <div className="text-base font-bold text-slate-700 mt-2 flex items-center gap-2">
              <span>{getConditionLabel(currentWx)}</span>
              {Number.isFinite(currentWx?.temp) && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="text-xs text-slate-500 font-normal">
                    Feels like <strong className="text-slate-700">{formatTemp(currentWx.temp + (currentWx.relativeHumidity > 70 ? 2 : 0))}</strong>
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Weather emoji graphic */}
          <div className="text-6xl sm:text-7xl drop-shadow-md">
            {getConditionIcon(currentWx)}
          </div>
        </div>

        {/* Day indicators */}
        <div className="mt-5 pt-4 border-t border-slate-200/60 flex items-center gap-4 text-xs font-semibold text-slate-600 flex-wrap">
          <span className="text-slate-500 font-normal">
            Dew Point: <strong className="text-slate-700">{Number.isFinite(currentWx?.dewPoint) ? formatTemp(currentWx.dewPoint) : 'Unavailable'}</strong>
          </span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-500 font-normal">
            Wind: <strong className="text-slate-700">{Number.isFinite(currentWx?.windSpeed) ? `${currentWx.windSpeed} m/s` : 'Unavailable'}</strong>
          </span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-500 font-normal">
            Humidity: <strong className="text-sky-700">{Number.isFinite(currentWx?.relativeHumidity) ? `${currentWx.relativeHumidity}%` : 'Unavailable'}</strong>
          </span>
        </div>
      </div>
    </div>
  );
}

window.WeatherHeroCard = WeatherHeroCard;
