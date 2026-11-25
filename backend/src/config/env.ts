import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load repo-root .env first, then backend/.env (existing variables are never overridden).
dotenv.config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });
dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  STORAGE_DIR: z.string().default('./storage'),
  MAX_UPLOAD_MB: z.coerce.number().default(10),
  BLOCKCHAIN_RPC_URL: z.string().default('http://127.0.0.1:8545'),
  BLOCKCHAIN_DEPLOYMENT_FILE: z.string().default('../blockchain/deployments/localhost.json'),
  BLOCKCHAIN_PRIVATE_KEY: z.string().optional(),
  RATE_LIMIT_ENABLED: z.string().default('true'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
  throw new Error(`Invalid environment configuration: ${issues}`);
}

const e = parsed.data;
if (e.NODE_ENV === 'production' && (e.JWT_SECRET.length < 32 || /change-me/i.test(e.JWT_SECRET))) {
  throw new Error('JWT_SECRET must be a strong random value in production');
}

export const env = {
  ...e,
  isProd: e.NODE_ENV === 'production',
  isTest: e.NODE_ENV === 'test',
  rateLimitEnabled: e.RATE_LIMIT_ENABLED !== 'false',
  storageDir: path.resolve(process.cwd(), e.STORAGE_DIR),
  maxUploadBytes: e.MAX_UPLOAD_MB * 1024 * 1024,
  deploymentFile: path.resolve(process.cwd(), e.BLOCKCHAIN_DEPLOYMENT_FILE),
};
