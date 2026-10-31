// Este binding solo existe en el entorno de test (definido en vitest.config.mts),
// nunca en wrangler.jsonc real ni en producción. Se declara aquí para que
// TypeScript reconozca env.TEST_MIGRATIONS dentro de los archivos de test.
declare module 'cloudflare:test' {
  interface ProvidedEnv extends Env {
    TEST_MIGRATIONS: D1Migration[];
  }
}
