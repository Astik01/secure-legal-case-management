import { createApp } from './app';
import { connectDb } from './config/db';
import { env } from './config/env';

async function main() {
  await connectDb();
  console.log('[db] connected');
  const app = createApp();
  app.listen(env.PORT, () => console.log(`[api] listening on http://localhost:${env.PORT} (${env.NODE_ENV})`));
}

main().catch((err) => {
  console.error('[fatal] failed to start server:', err instanceof Error ? err.message : err);
  process.exit(1);
});
