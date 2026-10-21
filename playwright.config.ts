import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: false, // Electron E2E no se beneficia de paralelismo agresivo
  retries: 0,
  reporter: 'list',
});