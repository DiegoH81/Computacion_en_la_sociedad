import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';
import path from 'node:path';

const migrationsPath = path.join(import.meta.dirname, 'src/db/migrations');
const migrations = await readD1Migrations(migrationsPath);

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        bindings: {
          TEST_MIGRATIONS: migrations,
          DEVICE_KEY_SECRET: 'secreto-de-prueba',
        },
      },
    }),
  ],
  test: {
    setupFiles: ['./test/apply-migrations.ts'],
  },
});
