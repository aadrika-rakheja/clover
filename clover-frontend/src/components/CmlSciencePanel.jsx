/**
 * CmlSciencePanel.jsx — CML Microwave Radar science tab.
 *
 * Displays:
 *  - Regional CML metric highlight cards
 *  - Chart.js PM2.5 model comparison or RSL telemetry chart
 *  - Inspector type toggle (station model vs CML link)
 *
 * Note: Chart instance lifecycle is managed here via refs. The canvas ref is
 * forwarded from app.jsx so the chart persists across re-renders.
 *
 * Props:
 *  cmlLinks         {Array}    All CML link definitions
 *  regionalMetrics  {Object}   { avgCmlAttenuation, cmlDerivedRainRate, maxCmlAttenuation }
 *  inspectorType    {string}   'station' | 'cml'
 *  setInspectorType {Function}
 *  selectedCml      {Object}   Currently selected CML link state
 *  selectedStation  {Object}   { station: { name } }
 *  chartCanvasRef   {Ref}      React ref for the Chart.js canvas element
 */
function CmlSciencePanel({
  cmlLinks, regionalMetrics,
  inspectorType, setInspectorType,
  selectedCml, selectedStation,
  chartCanvasRef,
}) {
  const metrics = [
    {
      label: 'Mean Specific Attenuation',
      value: regionalMetrics.avgCmlAttenuation,
      unit: 'dB/km',
      desc: 'Atmospheric microwave loss',
      colorClass: 'text-sky-700',
      bgClass: 'border-sky-300/60',
      valClass: 'text-sky-950',
    },
    {
      label: 'CML Inferred Rain Rate',
      value: regionalMetrics.cmlDerivedRainRate,
      unit: 'mm/h',
      desc: 'Real-time rain rate via RSL inversion',
      colorClass: 'text-emerald-700',
      bgClass: 'border-emerald-300/60',
      valClass: 'text-emerald-950',
    },
    {
      label: 'Max Attenuation Peak',
      value: regionalMetrics.maxCmlAttenuation,
      unit: 'dB/km',
      desc: 'Localized downpour detection',
      colorClass: 'text-amber-700',
      bgClass: 'border-amber-300/60',
      valClass: 'text-amber-950',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-3xl p-6 shadow-sm">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h2 className="text-xl font-black font-heading text-slate-900">
              Commercial Microwave Link (CML) Atmospheric Radar
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Opportunistic telecom microwave signal absorption (ITU-R P.838) providing ultra-dense rain and boundary layer sensing
            </p>
          </div>
          <div className="px-3 py-1 rounded-full glass-subtle text-emerald-800 border border-emerald-300/60 text-xs font-bold">
            Active Hops: {cmlLinks.length}
          </div>
        </div>

        {/* Metric highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {metrics.map(m => (
            <div key={m.label} className={`p-4 rounded-2xl glass-subtle ${m.bgClass}`}>
              <div className={`text-xs font-bold ${m.colorClass}`}>{m.label}</div>
              <div className={`text-3xl font-black font-heading ${m.valClass} mt-1`}>
                {m.value}{' '}
                <span className={`text-sm font-normal ${m.colorClass}`}>{m.unit}</span>
              </div>
              <div className={`text-[11px] ${m.colorClass} mt-0.5`}>{m.desc}</div>
            </div>
          ))}
        </div>

        {/* Chart panel */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-800">
              {inspectorType === 'cml'
                ? `Telemetry for Link ${selectedCml?.id} (72-Hour RSL Signal Decay)`
                : `PM2.5 Model Comparison at ${selectedStation.station.name}`}
            </h3>
            <button
              onClick={() => setInspectorType(prev => prev === 'cml' ? 'station' : 'cml')}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-900"
            >
              Switch to {inspectorType === 'cml' ? 'Station Model' : 'CML Link'} &rarr;
            </button>
          </div>
          <div className="w-full h-72 glass-subtle rounded-2xl p-3 border border-white/80">
            <canvas ref={chartCanvasRef}/>
          </div>
        </div>
      </div>
    </div>
  );
}

window.CmlSciencePanel = CmlSciencePanel;
