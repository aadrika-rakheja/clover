/**
 * Observation.js — Mongoose model for sensor telemetry records.
 *
 * A single Observation document represents one timestamped reading from a
 * sensor device. Three source types are supported:
 *
 *   'aq_station' — CPCB / DPCC / UPPCB continuous air quality monitors
 *   'cml'        — Commercial Microwave Link RSL attenuation readings
 *   'weather'    — Meteorological station readings (temp, RH, wind, etc.)
 */
import mongoose from 'mongoose';

const { Schema } = mongoose;

const observationSchema = new Schema(
  {
    // ── Source classification ──────────────────────────────────────
    source: {
      type: String,
      enum: ['cml', 'aq_station', 'weather'],
      required: true,
      index: true,
    },

    // ── Device identification ──────────────────────────────────────
    /** Station ID, link ID, or weather sensor ID */
    deviceId: {
      type: String,
      required: true,
      index: true,
    },

    /** Primary observation timestamp (defaults to ingestion time) */
    observedAt: {
      type: Date,
      required: true,
      index: true,
    },

    // ── Geospatial (GeoJSON Point) ─────────────────────────────────
    location: {
      type: { type: String, enum: ['Point'] },
      coordinates: [Number], // [longitude, latitude]
    },

    // ── Air quality pollutants (µg/m³ unless noted) ───────────────
    pm25: Number,
    pm10: Number,
    no2:  Number,
    so2:  Number,
    co:   Number,  // mg/m³
    o3:   Number,

    // ── Meteorological parameters ──────────────────────────────────
    temperatureC:  Number,
    humidityPct:   Number,
    windSpeedMs:   Number,
    rainfallMmHr:  Number,

    // ── CML telemetry ──────────────────────────────────────────────
    rslDbm:       Number, // Received Signal Level (dBm)
    tslDbm:       Number, // Transmitted Signal Level (dBm) — optional
    frequencyGhz: Number, // Link carrier frequency

    // ── Data quality ───────────────────────────────────────────────
    /** Quality score 0.0–1.0 (1.0 = fully validated) */
    quality: {
      type: Number,
      default: 1,
    },

    /** Raw vendor payload — preserved for debugging / re-processing */
    raw: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    // Automatically adds createdAt and updatedAt fields
    timestamps: true,
  }
);

// 2dsphere index enables geospatial queries (nearby stations, bounding box).
// sparse:true skips documents without a location field (e.g. CML links).
observationSchema.index({ location: '2dsphere' }, { sparse: true });

// Compound index for the most common query pattern: fetch latest readings for a
// given source + device, sorted by time descending
observationSchema.index({ source: 1, deviceId: 1, observedAt: -1 });

export const Observation = mongoose.model('Observation', observationSchema);
