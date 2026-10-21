import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import electron from 'vite-plugin-electron/simple';
import { defineConfig } from 'vitest/config';

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    electron({
      main: {
        entry: 'electron/main/index.ts',
      },
      preload: {
        input: 'electron/preload/index.ts',
      },
      renderer: {},
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './tests/unit/setup.ts',
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});