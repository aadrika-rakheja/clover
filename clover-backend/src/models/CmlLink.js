/**
 * CmlLink.js — Mongoose model for Commercial Microwave Link (CML) metadata.
 *
 * A CmlLink document describes the static configuration of one microwave hop
 * between two telecom tower nodes. The dynamic RSL telemetry for each link is
 * stored in the Observation collection with `source: 'cml'` and
 * `deviceId: <linkId>`.
 */
import mongoose from 'mongoose';

const { Schema } = mongoose;

const cmlLinkSchema = new Schema(
  {
    /** Unique identifier, e.g. "cml_gn_01" */
    linkId: {
      type: String,
      required: true,
      unique: true,
    },

    /** Origin tower endpoint */
    from: {
      id:  String,  // Tower ID reference
      lat: Number,
      lon: Number,
    },

    /** Destination tower endpoint */
    to: {
      id:  String,
      lat: Number,
      lon: Number,
    },

    /** Carrier frequency in GHz (e.g. 18.0, 23.0, 38.0) */
    frequencyGhz: {
      type: Number,
      required: true,
    },

    /**
     * Clear-sky baseline Received Signal Level in dBm.
     * Attenuation = baselineRslDbm − currentRslDbm.
     */
    baselineRslDbm: {
      type: Number,
      required: true,
    },

    /** Set to false to decommission a link without losing its history */
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export const CmlLink = mongoose.model('CmlLink', cmlLinkSchema);
