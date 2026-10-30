import mongoose from 'mongoose';
import { config } from './config.js';

/** Hide the password before a connection string ever reaches the logs. */
function redact(uri) {
  return uri.replace(/\/\/([^:@/]+):[^@/]*@/, '//$1:****@');
}

export async function connectDatabase() {
  mongoose.set('strictQuery', true);

  mongoose.connection.on('disconnected', () => console.warn('[db] disconnected'));
  mongoose.connection.on('reconnected', () => console.log('[db] reconnected'));
  mongoose.connection.on('error', (err) => console.error('[db] error:', err.message));

  await mongoose.connect(config.mongoUri, {
    // Default is 30s, which makes a wrong URI feel like a hang. 8s is plenty.
    serverSelectionTimeoutMS: 8000,
  });

  console.log(`[db] connected to ${redact(config.mongoUri)}`);
}

/**
 * 1 === connected. Checked before touching a collection so that a database
 * that went away returns a clean 503 instead of a 10s buffering timeout.
 */
export function isDatabaseReady() {
  return mongoose.connection.readyState === 1;
}

export async function disconnectDatabase() {
  await mongoose.connection.close();
}
