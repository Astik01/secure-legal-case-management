// Runs in every test worker before modules are loaded.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret-not-for-production-use';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
