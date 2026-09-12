import 'dotenv/config';
import mongoose from 'mongoose';
const URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/clover';
await mongoose.connect(URI);
console.log('Connected to:', URI.replace(/:([^@]+)@/, ':***@'));
const db = mongoose.connection.db;
const col = db.collection('observations');

// Drop the bad non-sparse 2dsphere index if it exists
try {
  await col.dropIndex('location_2dsphere');
  console.log('Dropped old location_2dsphere index');
} catch(e) {
  console.log('Index not found or already dropped:', e.code, e.codeName);
}

// Delete CML docs that have empty coordinates arrays (broken from previous runs)
const badDocs = await col.find({ source: 'cml' }).toArray();
let deleted = 0;
for (const doc of badDocs) {
  if (doc.location && Array.isArray(doc.location.coordinates) && doc.location.coordinates.length === 0) {
    await col.deleteOne({ _id: doc._id });
    deleted++;
  }
}
console.log('Deleted', deleted, 'bad CML observation docs');
await mongoose.disconnect();
console.log('Cleanup done');
