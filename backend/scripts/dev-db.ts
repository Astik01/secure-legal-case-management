/**
 * Starts a persistent local MongoDB (via mongodb-memory-server's real mongod binary) for development
 * when MongoDB is not installed. Data is kept in backend/.devdb across restarts.
 * To use your own MongoDB/Atlas instead, set MONGODB_URI and skip this script.
 */
import { MongoMemoryServer } from 'mongodb-memory-server';
import fs from 'fs';
import path from 'path';

async function main() {
  const dbPath = path.resolve(__dirname, '../.devdb');
  fs.mkdirSync(dbPath, { recursive: true });
  const port = Number(process.env.DEV_DB_PORT || 27017);
  const server = await MongoMemoryServer.create({
    instance: { port, dbPath, storageEngine: 'wiredTiger' },
  });
  console.log(`[dev-db] MongoDB running at ${server.getUri()} (data: ${dbPath})`);
  console.log('[dev-db] Press Ctrl+C to stop.');
  const stop = async () => {
    await server.stop({ doCleanup: false });
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((e) => {
  console.error('[dev-db] failed:', e);
  process.exit(1);
});
