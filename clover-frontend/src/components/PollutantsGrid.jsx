/**
 * PollutantsGrid.jsx — 6-pollutant concentration grid with NAAQS/WHO bars.
 *
 * Props:
 *  currentStationMetrics  {Object}  { pm25, pm10, no2, so2, co, o3, aqiCategory }
 *  selectedStation        {Object}  { station: { name } }
 */
function PollutantsGrid({ currentStationMetrics, selectedStation }) {
  const { pm25, pm10, no2, so2, co, o3, aqiCategory } = currentStationMetrics;

  const pollutants = [
    {
      name: 'PM2.5', value: pm25, unit: 'µg/m³',
      whoLimit: 15, naaqsLimit: 60,
      color: aqiCategory.color,
      status: aqiCategory.label,
    },
    {
      name: 'PM10', value: pm10, unit: 'µg/m³',
      whoLimit: 45, naaqsLimit: 100,
      color: '#eab308', status: 'Moderate',
    },
    {
      name: 'NO2', value: no2, unit: 'µg/m³',
      whoLimit: 25, naaqsLimit: 80,
      color: '#10b981', status: 'Good',
    },
    {
      name: 'SO2', value: so2, unit: 'µg/m³',
      whoLimit: 40, naaqsLimit: 80,
      color: '#10b981', status: 'Good',
    },
    {
      name: 'CO', value: co, unit: 'mg/m³',
      whoLimit: 4, naaqsLimit: 4,
      color: '#84cc16', status: 'Satisfactory',
    },
    {
      name: 'Ozone (O3)', value: o3, unit: 'µg/m³',
      whoLimit: 100, naaqsLimit: 180,
      color: '#10b981', status: 'Good',
    },
  ];

  return (
    <div className="glass-card rounded-3xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-black font-heading text-slate-900">
            Live Air Pollutant Concentrations
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Continuous monitoring at {selectedStation.station.name} compared to National (NAAQS) and WHO safety limits
          </p>
        </div>
        <span className="text-xs font-bold text-slate-500">Unit: µg/m³ (CO in mg/m³)</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {pollutants.map(poll => {
          const isAvailable = Number.isFinite(poll.value);
          const displayVal = isAvailable ? poll.value : 'Unavailable';
          const pct = isAvailable ? Math.min((poll.value / (poll.naaqsLimit * 1.5)) * 100, 100) : 0;
          return (
            <div key={poll.name} className="p-3.5 rounded-2xl glass-subtle">
              <div className="flex items-center justify-between mb-1">
                <span className="font-extrabold text-xs text-slate-700">{poll.name}</span>
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: isAvailable ? poll.color + '25' : '#94a3b825', color: isAvailable ? poll.color : '#64748b' }}
                >
                  {isAvailable ? poll.status : 'N/A'}
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-black font-heading text-slate-900 mt-1 truncate">
                {displayVal}
              </div>
              <div className="text-[10px] text-slate-400 mb-2">{isAvailable ? poll.unit : 'No Data'}</div>
              <div className="w-full h-1.5 bg-slate-200/60 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: poll.color }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-slate-400 mt-1.5">
                <span>WHO: {poll.whoLimit}</span>
                <span>NAAQS: {poll.naaqsLimit}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

window.PollutantsGrid = PollutantsGrid;
