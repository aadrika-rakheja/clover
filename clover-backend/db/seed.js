/**
 * seed.js — Populates MongoDB with Clover reference data.
 *
 * Seeds:
 *  - CPCB monitoring stations (from clover-frontend/src/delhiData.js)
 *  - CML link topology (from delhiData.js)
 *  - Sample AQ observations for each station (current-hour snapshot)
 *
 * Usage:
 *   node db/seed.js
 *
 * Safe to run multiple times — uses upsert so existing records are updated
 * rather than duplicated.
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';

// ── Station and CML data (mirrors delhiData.js on the frontend) ─────────────
// Kept here so the seeder is self-contained and doesn't need a browser context.
const STATIONS = [
  { stationId: 'ncr_gnoida_kp3',    name: 'Knowledge Park III, Greater Noida',    district: 'Gautam Buddha Nagar', type: 'Residential',   lat: 28.474, lon: 77.504 },
  { stationId: 'ncr_gnoida_sec1',   name: 'Sector 1, Greater Noida',              district: 'Gautam Buddha Nagar', type: 'Residential',   lat: 28.499, lon: 77.549 },
  { stationId: 'ncr_gnoida_pari',   name: 'Pari Chowk, Greater Noida',            district: 'Gautam Buddha Nagar', type: 'Traffic Node',  lat: 28.459, lon: 77.519 },
  { stationId: 'ncr_noida_sec62',   name: 'Sector 62, Noida',                     district: 'Gautam Buddha Nagar', type: 'Industrial',    lat: 28.615, lon: 77.364 },
  { stationId: 'ncr_noida_sec1',    name: 'Sector 1, Noida',                      district: 'Gautam Buddha Nagar', type: 'Residential',   lat: 28.584, lon: 77.325 },
  { stationId: 'ncr_delhi_ihbas',   name: 'IHBAS, Dilshad Garden, Delhi',         district: 'East Delhi',          type: 'Institutional', lat: 28.681, lon: 77.317 },
  { stationId: 'ncr_delhi_anand',   name: 'Anand Vihar, Delhi',                   district: 'East Delhi',          type: 'Traffic Node',  lat: 28.647, lon: 77.316 },
  { stationId: 'ncr_gh_moh',        name: 'Mohan Nagar, Ghaziabad',               district: 'Ghaziabad',           type: 'Industrial',    lat: 28.682, lon: 77.446 },
  { stationId: 'ncr_gh_vasun',      name: 'Vasundhara, Ghaziabad',                district: 'Ghaziabad',           type: 'Residential',   lat: 28.651, lon: 77.374 },
  { stationId: 'ncr_faridabad_sec', name: 'Sector 11, Faridabad',                 district: 'Faridabad',           type: 'Residential',   lat: 28.415, lon: 77.312 },
];

const CML_LINKS = [
  { linkId: 'cml_gn_01', from: { id: 'twr_gn_01', lat: 28.474, lon: 77.504 }, to: { id: 'twr_gn_02', lat: 28.499, lon: 77.549 }, frequencyGhz: 18.0, baselineRslDbm: -45.2 },
  { linkId: 'cml_gn_02', from: { id: 'twr_gn_02', lat: 28.499, lon: 77.549 }, to: { id: 'twr_gn_03', lat: 28.459, lon: 77.519 }, frequencyGhz: 23.0, baselineRslDbm: -48.7 },
  { linkId: 'cml_gn_03', from: { id: 'twr_gn_03', lat: 28.459, lon: 77.519 }, to: { id: 'twr_no_01', lat: 28.615, lon: 77.364 }, frequencyGhz: 38.0, baselineRslDbm: -62.1 },
  { linkId: 'cml_no_01', from: { id: 'twr_no_01', lat: 28.615, lon: 77.364 }, to: { id: 'twr_no_02', lat: 28.584, lon: 77.325 }, frequencyGhz: 18.0, baselineRslDbm: -43.8 },
  { linkId: 'cml_dl_01', from: { id: 'twr_dl_01', lat: 28.681, lon: 77.317 }, to: { id: 'twr_dl_02', lat: 28.647, lon: 77.316 }, frequencyGhz: 23.0, baselineRslDbm: -51.3 },
  { linkId: 'cml_gh_01', from: { id: 'twr_gh_01', lat: 28.682, lon: 77.446 }, to: { id: 'twr_gh_02', lat: 28.651, lon: 77.374 }, frequencyGhz: 18.0, baselineRslDbm: -46.9 },
];

// Typical PM2.5 base values for each station (realistic Greater Noida values)
const STATION_PM25 = {
  'ncr_gnoida_kp3':   115,
  'ncr_gnoida_sec1':  128,
  'ncr_gnoida_pari':  168,
  'ncr_noida_sec62':  198,
  'ncr_noida_sec1':   142,
  'ncr_delhi_ihbas':  182,
  'ncr_delhi_anand':  215,
  'ncr_gh_moh':       224,
  'ncr_gh_vasun':     158,
  'ncr_faridabad_sec': 172,
};

// ── Mongoose schemas (inline for seeder self-containment) ───────────────────

const StationSchema = new mongoose.Schema({
  stationId: { type: String, required: true, unique: true, index: true },
  name: String, district: String, type: String, active: { type: Boolean, default: true },
  location: { type: { type: String, enum: ['Point'], default: 'Point' }, coordinates: [Number] },
}, { timestamps: true });
StationSchema.index({ location: '2dsphere' });

const CmlLinkSchema = new mongoose.Schema({
  linkId: { type: String, required: true, unique: true },
  from: { id: String, lat: Number, lon: Number },
  to: { id: String, lat: Number, lon: Number },
  frequencyGhz: Number, baselineRslDbm: Number, active: { type: Boolean, default: true },
}, { timestamps: true });

const ObsSchema = new mongoose.Schema({
  source: { type: String, enum: ['cml', 'aq_station', 'weather'], required: true },
  deviceId: { type: String, required: true },
  observedAt: { type: Date, required: true },
  location: { type: { type: String, enum: ['Point'] }, coordinates: [Number] },
  pm25: Number, pm10: Number, no2: Number, so2: Number, co: Number, o3: Number,
  temperatureC: Number, humidityPct: Number, windSpeedMs: Number,
  rslDbm: Number, frequencyGhz: Number, quality: { type: Number, default: 1 },
}, { timestamps: true });
ObsSchema.index({ location: '2dsphere' }, { sparse: true });

const Station    = mongoose.model('Station',     StationSchema);
const CmlLink    = mongoose.model('CmlLink',     CmlLinkSchema);
const Observation = mongoose.model('Observation', ObsSchema);

// ── Main seeder ──────────────────────────────────────────────────────────────

async function seed() {
  await mongoose.connect(env.mongoUri);
  console.log('✅ MongoDB connected →', env.mongoUri);

  // 1. Upsert stations
  let stationCount = 0;
  for (const st of STATIONS) {
    await Station.findOneAndUpdate(
      { stationId: st.stationId },
      {
        stationId: st.stationId,
        name: st.name,
        district: st.district,
        type: st.type,
        active: true,
        location: { type: 'Point', coordinates: [st.lon, st.lat] },
      },
      { upsert: true, new: true, runValidators: true }
    );
    stationCount++;
  }
  console.log(`✅ Upserted ${stationCount} monitoring stations`);

  // 2. Upsert CML links
  let cmlCount = 0;
  for (const link of CML_LINKS) {
    await CmlLink.findOneAndUpdate(
      { linkId: link.linkId },
      { ...link, active: true },
      { upsert: true, new: true, runValidators: true }
    );
    cmlCount++;
  }
  console.log(`✅ Upserted ${cmlCount} CML links`);

  // 3. Insert current-hour AQ observations for each station
  const now = new Date();
  const aqObs = STATIONS.map(st => {
    const pm25 = STATION_PM25[st.stationId] || 150;
    const pm10 = Math.round(pm25 * 1.55);
    return {
      source: 'aq_station',
      deviceId: st.stationId,
      observedAt: now,
      location: { type: 'Point', coordinates: [st.lon, st.lat] },
      pm25, pm10,
      no2:  Math.round(40 + Math.random() * 40),
      so2:  Math.round(15 + Math.random() * 20),
      co:   +(0.5 + Math.random() * 1.0).toFixed(2),
      o3:   Math.round(50 + Math.random() * 40),
      quality: 1,
    };
  });
  await Observation.insertMany(aqObs, { ordered: false });
  console.log(`✅ Inserted ${aqObs.length} AQ station observations`);

  // 4. Insert one weather observation
  await Observation.create({
    source: 'weather',
    deviceId: 'weather_gnoida_main',
    observedAt: now,
    location: { type: 'Point', coordinates: [77.504, 28.474] },
    temperatureC: 29,
    humidityPct: 68,
    windSpeedMs: 2.1,
    quality: 1,
  });
  console.log('✅ Inserted weather observation');

  // 5. Insert CML RSL observations
  const cmlObs = CML_LINKS.map(link => ({
    source: 'cml',
    deviceId: link.linkId,
    observedAt: now,
    // CML links span two towers — no single GPS point; omit location field
    rslDbm: +(link.baselineRslDbm - 1.5 - Math.random() * 3).toFixed(1),
    frequencyGhz: link.frequencyGhz,
    quality: 0.9,
  }));
  await Observation.insertMany(cmlObs, { ordered: false });
  console.log(`✅ Inserted ${cmlObs.length} CML link observations`);

  console.log('\n🎉 Seed complete. Backend now has real data to return.');
  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
