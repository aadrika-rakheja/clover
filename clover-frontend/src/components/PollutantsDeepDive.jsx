/**
 * PollutantsDeepDive.jsx — detailed pollutant tab with sources & health impacts.
 *
 * Props:
 *  currentStationMetrics  {Object}  { pm25, pm10, no2, so2, co, o3, aqiCategory }
 *  selectedStation        {Object}  { station: { name } }
 */
function PollutantsDeepDive({ currentStationMetrics, selectedStation }) {
  const { pm25, pm10, no2, so2, co, o3, aqiCategory } = currentStationMetrics;

  const pollutants = [
    {
      code: 'PM2.5',
      name: 'Fine Particulate Matter (< 2.5 µm)',
      val: `${pm25} µg/m³`,
      color: aqiCategory.color,
      sources: 'Vehicular exhaust (Yamuna/Noida Expressway), biomass burning, construction dust, secondary aerosol synthesis.',
      health: 'Penetrates deep into alveolar sacs and bloodstream. Associated with cardiovascular stress, stroke, asthma, and chronic bronchitis.',
    },
    {
      code: 'PM10',
      name: 'Coarse Particulates (< 10 µm)',
      val: `${pm10} µg/m³`,
      color: '#eab308',
      sources: 'Road resuspension, construction sites in Greater Noida West, desert dust, industrial processing.',
      health: 'Causes upper respiratory tract irritation, nasal congestion, eye burning, and persistent coughing.',
    },
    {
      code: 'NO2',
      name: 'Nitrogen Dioxide',
      val: `${no2} µg/m³`,
      color: '#10b981',
      sources: 'High-temperature diesel combustion, freight transit along Eastern Peripheral Expressway.',
      health: 'Aggravates asthma and increases susceptibility to respiratory lung infections.',
    },
    {
      code: 'CO',
      name: 'Carbon Monoxide',
      val: `${co} mg/m³`,
      color: '#84cc16',
      sources: 'Incomplete combustion in motor vehicles and slow idling at congested intersections (Pari Chowk).',
      health: 'Reduces oxygen delivery to body organs and tissues; causes headaches, fatigue, and dizziness.',
    },
    {
      code: 'SO2',
      name: 'Sulfur Dioxide',
      val: `${so2} µg/m³`,
      color: '#10b981',
      sources: 'Industrial clusters, brick kilns upwind, coal-fired industrial boilers.',
      health: 'Causes bronchoconstriction and bronchial spasms in sensitive asthmatic populations.',
    },
    {
      code: 'O3',
      name: 'Ground-Level Ozone',
      val: `${o3} µg/m³`,
      color: '#10b981',
      sources: 'Secondary photochemical pollutant formed by sunlight reaction between NOx and VOCs.',
      health: 'Reduces lung capacity, triggers asthma attacks, and inflames chest lining.',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-3xl p-6 shadow-sm">
        <h2 className="text-xl font-black font-heading text-slate-900 mb-1">
          Air Pollutant Standards &amp; Medical Health Impact
        </h2>
        <p className="text-xs text-slate-500 mb-6">
          Real-time measurements at {selectedStation.station.name} with toxicity thresholds and source attribution
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {pollutants.map(item => (
            <div key={item.code} className="p-5 rounded-2xl glass-subtle">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-lg font-black font-heading text-slate-900">{item.code}</span>
                  <span className="text-xs text-slate-500 ml-2 font-medium">{item.name}</span>
                </div>
                <span className="text-xl font-black font-heading" style={{ color: item.color }}>
                  {item.val}
                </span>
              </div>
              <div className="mt-3 text-xs text-slate-600 space-y-1.5">
                <div><strong className="text-slate-800">Primary Sources:</strong> {item.sources}</div>
                <div><strong className="text-slate-800">Health Hazards:</strong> {item.health}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

window.PollutantsDeepDive = PollutantsDeepDive;
