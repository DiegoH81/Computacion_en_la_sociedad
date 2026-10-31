import { applyD1Migrations, env } from 'cloudflare:test';

// La base de test arranca completamente vacía (sin tablas).
// Este setup aplica las mismas migraciones que usa `wrangler d1 execute`
// en desarrollo, contra el binding TEST_MIGRATIONS definido en vitest.config.mts.
await applyD1Migrations(env.prelatura_db, env.TEST_MIGRATIONS);
