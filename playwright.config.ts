import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: false, // Electron E2E no se beneficia de paralelismo agresivo
  workers: 1, // Todas las pruebas comparten el mismo Worker de pruebas
  retries: 0,
  reporter: 'list',
  globalSetup: './tests/e2e/global-setup.ts',
});
