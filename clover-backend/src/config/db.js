/**
 * db.js — Alias for database connection configuration module.
 */
import { connectDatabase } from './database.js';
import mongoose from 'mongoose';

export { connectDatabase, mongoose };
export default connectDatabase;
