/**
 * db/check.js — Verify Atlas connection and show what data is stored.
 *
 * Usage:  node db/check.js
 */
import 'dotenv/config';
import mongoose from 'mongoose';

const URI = process.env.MONGODB_URI;

console.log('\n========================================');
console.log(' CLOVER - MongoDB Atlas Connection Check');
console.log('========================================');
console.log('Connecting to Atlas...\n');

try {
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 8000 });
} catch (err) {
  console.error('FAILED to connect:', err.message);
  process.exit(1);
}

const db    = mongoose.connection.db;
const state = mongoose.connection.readyState;

console.log('Status    :', state === 1 ? 'CONNECTED' : 'NOT CONNECTED');
console.log('Host      :', mongoose.connection.host);
console.log('Database  :', mongoose.connection.name);
console.log('');

// ── Collections + doc counts ─────────────────────────────────────────────────
const cols = await db.listCollections().toArray();
console.log('Collections in "' + mongoose.connection.name + '":');
console.log('--------------------------------------------');

if (cols.length === 0) {
  console.log('  (empty — no collections found)');
} else {
  for (const col of cols) {
    const count = await db.collection(col.name).countDocuments();
    console.log('  ' + col.name.padEnd(22) + count + ' documents');
  }
}

console.log('');

// ── Sample docs ──────────────────────────────────────────────────────────────
for (const col of cols) {
  const sample = await db.collection(col.name).findOne({}, {
    projection: { __v: 0, raw: 0 },
  });

  if (!sample) continue;

  console.log('[' + col.name + '] - latest sample document:');
  console.log(JSON.stringify(sample, null, 2));
  console.log('');
}

// ── AQ Observation breakdown ──────────────────────────────────────────────────
if (cols.find(c => c.name === 'observations')) {
  const obs = db.collection('observations');

  const sources = await obs.aggregate([
    { $group: { _id: '$source', count: { $sum: 1 }, latestAt: { $max: '$observedAt' } } },
    { $sort: { count: -1 } },
  ]).toArray();

  console.log('Observations breakdown by source:');
  console.log('--------------------------------------------');
  for (const s of sources) {
    const lat = s.latestAt ? new Date(s.latestAt).toISOString() : 'N/A';
    console.log(`  ${String(s._id || 'null').padEnd(14)} ${s.count} docs   latest: ${lat}`);
  }
  console.log('');

  // Top 5 AQ readings sorted by PM2.5 descending
  const top = await obs
    .find({ source: 'aq_station' }, { projection: { deviceId: 1, pm25: 1, pm10: 1, no2: 1, observedAt: 1 } })
    .sort({ pm25: -1 })
    .limit(5)
    .toArray();

  if (top.length) {
    console.log('Top 5 PM2.5 readings (highest first):');
    console.log('--------------------------------------------');
    for (const r of top) {
      console.log(
        '  ' + String(r.deviceId).padEnd(26) +
        'PM2.5: ' + String(r.pm25).padEnd(8) +
        'PM10: '  + String(r.pm10 || '-').padEnd(8) +
        'NO2: '   + (r.no2 || '-')
      );
    }
    console.log('');
  }
}

await mongoose.disconnect();
console.log('Disconnected. Check complete.\n');
