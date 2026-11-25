import mongoose from 'mongoose';
import { env } from './env';

export async function connectDb(uri: string = env.MONGODB_URI): Promise<typeof mongoose> {
  mongoose.set('strictQuery', true);
  return mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
