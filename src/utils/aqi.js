export function formatAqi(value) { return Number.isFinite(Number(value)) ? Math.round(Number(value)) : '—'; }
export function aqiLabel(aqi) { if (aqi <= 50) return 'Good'; if (aqi <= 100) return 'Satisfactory'; if (aqi <= 200) return 'Moderate'; if (aqi <= 300) return 'Poor'; if (aqi <= 400) return 'Very Poor'; return 'Severe'; }
