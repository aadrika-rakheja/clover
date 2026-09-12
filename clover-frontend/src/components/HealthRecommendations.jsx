/**
 * HealthRecommendations.jsx — AQI-aware health advisory panel.
 *
 * Props:
 *  aqi  {number}  Current AQI value (used to highlight relevant advisories)
 */
function HealthRecommendations({ aqi }) {
  const advisories = [
    {
      icon: '😷',
      title: 'Wear an N95 Mask Outdoors',
      desc: 'Advised when AQI exceeds 150 to protect against fine PM2.5 particulates.',
      threshold: 150,
    },
    {
      icon: '🪟',
      title: 'Keep Windows Closed',
      desc: 'Prevent high concentrations of ambient smog and dust from penetrating indoors.',
      threshold: 100,
    },
    {
      icon: '🌀',
      title: 'Run Indoor Air Purifiers',
      desc: 'Keep HEPA filters active, particularly during evening thermal inversion peaks.',
      threshold: 100,
    },
    {
      icon: '🏃',
      title: 'Limit Heavy Morning Exercise',
      desc: 'Postpone intense cardio jogs until the afternoon when boundary layer mixing rises.',
      threshold: 100,
    },
    {
      icon: '👶',
      title: 'Protect Vulnerable Groups',
      desc: 'Children, elderly, and respiratory patients should minimize outdoor duration.',
      threshold: 50,
    },
  ];

  return (
    <div className="lg:col-span-5 glass-card rounded-3xl p-5 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-black font-heading uppercase tracking-wider text-slate-500">
            Health Recommendations
          </h2>
          <span className="text-xs text-slate-400 font-medium">Greater Noida Advisory</span>
        </div>

        <div className="space-y-3">
          {advisories.map(rec => {
            const isActive = aqi >= rec.threshold;
            return (
              <div
                key={rec.title}
                className={`flex items-start gap-3 p-3 rounded-2xl transition-all ${
                  isActive ? 'glass-subtle ring-1 ring-amber-300/40' : 'glass-subtle opacity-70'
                }`}
              >
                <span className="text-xl shrink-0 mt-0.5">{rec.icon}</span>
                <div>
                  <div className={`text-xs font-bold ${isActive ? 'text-slate-800' : 'text-slate-600'}`}>
                    {rec.title}
                    {isActive && (
                      <span className="ml-2 text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 leading-tight mt-0.5">{rec.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-200/60 text-[11px] text-slate-400 text-center">
        Based on Central Pollution Control Board (CPCB) &amp; WHO Health Standards
      </div>
    </div>
  );
}

window.HealthRecommendations = HealthRecommendations;
