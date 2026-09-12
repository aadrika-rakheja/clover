/**
 * Commercial Microwave Link (CML) Atmospheric Physics Engine
 * Implements ITU-R P.530 & P.838 recommendations for atmospheric attenuation:
 * - Specific attenuation gamma (dB/km) = a * R^b
 * - Differential path loss: Delta RSL = Baseline_RSL - Current_RSL
 * - Inferred atmospheric moisture and micro-precipitation scavenging
 */

(function() {
  // Haversine distance in km
  function getDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // ITU-R P.838 coefficients for typical carrier frequencies
  function getItuCoefficients(freqGHz, polarization) {
    // a_H, b_H vs a_V, b_V approximations for microwave bands
    if (freqGHz >= 35) {
      return polarization === 'H' ? { a: 0.38, b: 0.91 } : { a: 0.34, b: 0.90 };
    } else if (freqGHz >= 22) {
      return polarization === 'H' ? { a: 0.16, b: 0.99 } : { a: 0.14, b: 0.97 };
    } else if (freqGHz >= 17) {
      return polarization === 'H' ? { a: 0.08, b: 1.07 } : { a: 0.07, b: 1.05 };
    } else {
      return polarization === 'H' ? { a: 0.04, b: 1.15 } : { a: 0.035, b: 1.13 };
    }
  }

  /**
   * Compute instantaneous link telemetry based on weather conditions (RH, rain, temperature)
   * and hour of forecast horizon
   */
  function computeLinkState(link, towersMap, weatherAtHour) {
    const fromTower = towersMap[link.from];
    const toTower = towersMap[link.to];
    if (!fromTower || !toTower) return null;

    const lengthKm = getDistanceKm(fromTower.lat, fromTower.lon, toTower.lat, toTower.lon);
    const midLat = (fromTower.lat + toTower.lat) / 2;
    const midLon = (fromTower.lon + toTower.lon) / 2;

    const itu = getItuCoefficients(link.freqGHz, link.polarization);
    
    // Atmospheric attenuation sources:
    // 1. Rain rate attenuation: A_rain = a * R^b * L
    const rain = weatherAtHour.rain || 0;
    const rainAttenuation = itu.a * Math.pow(Math.max(0, rain), itu.b) * lengthKm;

    // 2. High humidity / fog water vapor absorption (ITU-R P.676 resonance around 22 GHz)
    const rh = weatherAtHour.relativeHumidity || 65;
    const freqFactor = Math.exp(-Math.pow((link.freqGHz - 22.2) / 6.0, 2)); // 22.235 GHz water vapor line
    const moistureAttenuation = (rh > 60 ? (rh - 60) * 0.035 : 0) * freqFactor * lengthKm;

    // 3. Thermal boundary layer multipath fading
    const tempInversionFactor = weatherAtHour.boundaryLayerHeight < 350 ? 0.8 : 0.1;
    const fading = (Math.sin(midLat * 100 + weatherAtHour.hour) * 0.25 + 0.3) * tempInversionFactor;

    const totalAttenuationDb = +(rainAttenuation + moistureAttenuation + fading).toFixed(2);
    const specificAttenuationDbKm = +(totalAttenuationDb / Math.max(0.1, lengthKm)).toFixed(3);
    const currentRsl = +(link.baselineRSL - totalAttenuationDb).toFixed(1);
    const deltaRsl = +(link.baselineRSL - currentRsl).toFixed(1);

    // Normalized atmospheric moisture / stability index (0.0 to 1.0)
    const moistureIndex = Math.min(1.0, +(specificAttenuationDbKm / 3.5).toFixed(3));

    return {
      id: link.id,
      fromTower,
      toTower,
      midLat,
      midLon,
      lengthKm: +lengthKm.toFixed(2),
      freqGHz: link.freqGHz,
      polarization: link.polarization,
      baselineRsl: link.baselineRSL,
      currentRsl,
      deltaRsl,
      totalAttenuationDb,
      specificAttenuationDbKm,
      moistureIndex,
      attenuationSeverity: specificAttenuationDbKm > 2.0 ? 'high' : (specificAttenuationDbKm > 0.8 ? 'moderate' : 'low')
    };
  }

  window.CML_ENGINE = {
    getDistanceKm,
    computeLinkState
  };
})();
