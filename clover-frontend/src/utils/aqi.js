/**
 * aqi.js — AQI utility functions exposed as window.AQI_UTILS.
 *
 * Loaded as a plain <script> tag (no ES module bundler), so all exports
 * are attached to the window object for use across component files.
 *
 * Usage (in any component):
 *   const rounded = window.AQI_UTILS.formatAqi(obs.aqi);
 *   const label   = window.AQI_UTILS.aqiLabel(obs.aqi);
 */

(function () {
  /**
   * Round an AQI value to the nearest integer, returning '—' for invalid input.
   * @param {*} value  Raw AQI value
   * @returns {number|string}
   */
  function formatAqi(value) {
    const num = Number(value);
    return Number.isFinite(num) ? Math.round(num) : '—';
  }

  /**
   * Return the Indian CPCB AQI category label for a given AQI number.
   * @param {number} aqi
   * @returns {string}
   */
  function aqiLabel(aqi) {
    if (aqi <= 50)  return 'Good';
    if (aqi <= 100) return 'Satisfactory';
    if (aqi <= 200) return 'Moderate';
    if (aqi <= 300) return 'Poor';
    if (aqi <= 400) return 'Very Poor';
    return 'Severe';
  }

  window.AQI_UTILS = { formatAqi, aqiLabel };
})();
