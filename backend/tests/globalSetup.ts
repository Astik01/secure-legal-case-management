import { MongoMemoryServer } from 'mongodb-memory-server';

declare global {
  // eslint-disable-next-line no-var
  var __MONGO__: MongoMemoryServer | undefined;
}

export default async function globalSetup() {
  const mongo = await MongoMemoryServer.create();
  globalThis.__MONGO__ = mongo;
  process.env.MONGODB_URI = mongo.getUri();
}
