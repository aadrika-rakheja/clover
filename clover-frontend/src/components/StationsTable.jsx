/**
 * StationsTable.jsx — ranked monitoring stations table.
 *
 * Props:
 *  rankedStations    {Array}    Stations sorted by PM2.5 descending
 *  selectedStationId {string}
 *  currentWx         {Object}   Current weather (for temp/humidity columns)
 *  formatTemp        {Function}
 *  flyToStation      {Function} (stationId) => void
 *  stations          {Array}    All stations (for count display)
 */
function StationsTable({
  rankedStations, selectedStationId, currentWx,
  formatTemp, flyToStation, stations,
}) {
  return (
    <div className="glass-card rounded-3xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-black font-heading text-slate-900">
            Greater Noida &amp; Delhi NCR Real-Time Station Directory
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Click any station to switch location, view telemetry, or fly the interactive radar
          </p>
        </div>
        <span className="text-xs font-mono text-slate-400">{stations.length} Active Stations</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="glass-subtle text-slate-600 font-bold border-b border-white/60">
            <tr>
              <th className="px-4 py-3">STATION</th>
              <th className="px-4 py-3">DISTRICT</th>
              <th className="px-4 py-3">TEMP</th>
              <th className="px-4 py-3">HUMIDITY</th>
              <th className="px-4 py-3">PM2.5</th>
              <th className="px-4 py-3">AQI LEVEL</th>
              <th className="px-4 py-3 text-right">ACTION</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/40">
            {rankedStations.map(st => {
              const isCurr = st.id === selectedStationId;
              return (
                <tr
                  key={st.id}
                  className={`hover:bg-white/60 transition-colors ${isCurr ? 'bg-emerald-500/10 font-semibold' : ''}`}
                >
                  <td className="px-4 py-3 font-bold text-slate-800">
                    {st.name}
                    {isCurr && (
                      <span className="ml-1 text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded font-normal">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{st.district || 'Delhi NCR'}</td>
                  <td className="px-4 py-3 text-slate-700">{formatTemp(currentWx.temp)}</td>
                  <td className="px-4 py-3 text-sky-700">{currentWx.relativeHumidity}%</td>
                  <td className="px-4 py-3 font-bold text-slate-800">{st.currentPM25} µg/m³</td>
                  <td className="px-4 py-3">
                    <span
                      className="px-2.5 py-1 rounded-full text-[10px] font-extrabold text-white"
                      style={{ backgroundColor: st.cat.color }}
                    >
                      AQI {st.currentAQI}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => flyToStation(st.id)}
                      className="px-3 py-1 rounded-xl glass-subtle hover:bg-white hover:text-emerald-700 font-bold transition-all text-xs border border-white/80"
                    >
                      Select &rarr;
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

window.StationsTable = StationsTable;
