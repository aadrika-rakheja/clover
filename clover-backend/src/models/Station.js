/**
 * Station.js — Mongoose model for CPCB/DPCC/UPPCB monitoring stations.
 *
 * A Station record is a persistent, mostly-static entity describing a
 * physical air quality monitoring station. Sensor readings are stored
 * separately in the Observation collection and linked via `stationId`.
 */
import mongoose from 'mongoose';

const { Schema } = mongoose;

const stationSchema = new Schema(
  {
    /** Unique human-readable identifier, e.g. "ncr_gnoida_kp3" */
    stationId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    /** Official station name, e.g. "Knowledge Park III, Greater Noida" */
    name: {
      type: String,
      required: true,
    },

    /** Administrative district the station belongs to */
    district: String,

    /** Station category, e.g. "Institutional", "Industrial", "Residential" */
    type: String,

    /** GeoJSON Point — enables geospatial queries */
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
    },

    /** Set to false to soft-delete a station without dropping its history */
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// 2dsphere index for proximity queries (e.g. "stations within 10 km")
stationSchema.index({ location: '2dsphere' });

export const Station = mongoose.model('Station', stationSchema);
