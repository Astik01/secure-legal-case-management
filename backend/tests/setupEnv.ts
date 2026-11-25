// Runs in every test worker before modules are loaded.
import fs from 'fs';
import os from 'os';
import path from 'path';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret-not-for-production-use';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
// Isolated private storage per test worker.
process.env.STORAGE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'legal-storage-test-'));
