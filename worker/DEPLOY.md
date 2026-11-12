# Desarrollo y despliegue del Worker

## En desarrollo no hace falta una cuenta de Cloudflare

`npx wrangler dev` simula el Worker y la base D1 en tu PC. Los datos quedan en `worker/.wrangler/`.

1. Copia `.dev.vars.example` como `.dev.vars` y pon valores propios en ambos secretos.
2. Crea la base:
   - **Si es nueva:** `npm run db:setup`. Crea el modelo final con los usuarios de prueba `admin/admin123` y `parroco1/parroco123`.
   - **Si ya la tenías:** ejecuta `npx wrangler d1 execute prelatura-db --local --file=src/db/migrations/0011_sincronizacion.sql` y luego lo mismo con `0012_ministros_restricciones.sql`. La primera elimina las tablas `*_legacy` con sus datos de prueba.
   - **Después, en cualquier base que ya existía**, aplica también `0014_fecha_aproximada.sql` (la edad pasa a ser texto libre) y `0015_roles_y_correcciones.sql` (tres roles, usuarios que se crean sin internet y correcciones pendientes de aprobar), en ese orden y con el mismo comando. En la base del cliente: `npx wrangler d1 migrations apply prelatura-db --remote`. **Hay que aplicarlas antes de instalar la versión nueva de la app**: una PC actualizada sube correcciones con estado y usuarios, que un Worker sin migrar rechaza.
3. Enciende el Worker con `npx wrangler dev` y, en otra terminal, la app con `npm run dev` desde la raíz del proyecto.

Las pruebas E2E levantan su propio Worker con una base temporal, así que no tocan esta base.

## Pasar a la cuenta definitiva

Se hace una sola vez, con la cuenta del cliente. Ejecuta todo desde `worker/`.

**1. Inicia sesión en esa cuenta.** Si tenías otra abierta, cierra esa sesión primero.

```powershell
npx wrangler logout
npx wrangler login
npx wrangler whoami
```

**2. Crea la base y actualiza `wrangler.jsonc`.** Copia el `database_id` que muestra el comando. El Worker ya se llama `registro-sacramental` (`name` en `wrangler.jsonc`): de ese nombre depende la URL.

```powershell
npx wrangler d1 create prelatura-db
```

**3. Aplica las migraciones y prepara la base.** Las migraciones crean usuarios de prueba con contraseñas conocidas, y el segundo comando los elimina. Por eso va **antes de desplegar**: así el Worker nunca queda público con esas contraseñas. Guarda la contraseña que muestra, porque no se vuelve a mostrar. Ese administrador queda como el **principal**: el único que puede crear otros administradores (y pasarle la marca a otro desde la pantalla de usuarios).

```powershell
npx wrangler d1 migrations apply prelatura-db --remote
node src/scripts/bootstrap-production.mjs --admin=usuario --nombre=Nombre --paterno=Apellido --materno=Apellido
```

**4. Configura los secretos.** Pega en cada uno un valor aleatorio largo, por ejemplo el resultado de `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`, distinto para cada secreto.

```powershell
npx wrangler secret put JWT_SECRET
npx wrangler secret put DEVICE_KEY_SECRET
```

- **`JWT_SECRET`:** si cambia, las sesiones abiertas se renuevan solas.
- **`DEVICE_KEY_SECRET`:** guárdalo en un lugar seguro. Si se pierde, las copias de las claves dejan de servir, y una PC que pierda su clave tendrá que reconstruir su base desde el servidor y volver a digitar lo que no había subido.

**5. Despliega.**

```powershell
npx wrangler deploy
```

**6. Pon esa URL en la app.** Crea `resources/instalador/configuracion.json` con la URL que mostró el despliegue, `{ "servidor": "https://registro-sacramental.<subdominio>.workers.dev" }`, y arma el instalador. Si la URL cambia después, basta con editar ese archivo en las PCs (ver `resources/instalador/LEEME.md`); no hay que volver a compilar. También se puede compilar con la URL fija (`.env.production.local` con `VITE_WORKER_URL`), que se usa solo si no hay archivo.

## Entorno de pruebas (sin tocar el del padre)

El padre sigue usando `registro-sacramental` con la base `prelatura-db`. Para probar la versión nueva hay otro
Worker, `registro-sacramental-pruebas`, con su propia base `prelatura-db-pruebas` (entorno `pruebas` de
`wrangler.jsonc`). Todos los comandos llevan `--env pruebas`; sin eso, se trabaja sobre el del padre.

Una sola vez, desde `worker/`:

1. `npx wrangler d1 create prelatura-db-pruebas` y copiar el `database_id` en `env.pruebas` de `wrangler.jsonc`.
2. `npx wrangler d1 migrations apply prelatura-db-pruebas --remote --env pruebas`
3. `npx wrangler secret put JWT_SECRET --env pruebas` y lo mismo con `DEVICE_KEY_SECRET` (valores nuevos, no
   los del padre).
4. `npx wrangler deploy --env pruebas`. URL: `https://registro-sacramental-pruebas.registro-sacramental-prelatura.workers.dev`.
5. Cargar los datos de prueba (borra todo lo de la base de pruebas; sin `--env=pruebas` el script no acepta `--remote`):
   `node src/scripts/seed-prelatura.mjs --remote --env=pruebas --admin-password=<clave> --excel="../EXPORTADO - NUESTRA SÑORA DEL ROSARIO (CRUCERO).xlsx"`
6. Paquete inicial desde esa base: `npm run package:build -- --url <URL de pruebas> --user admin_general --password <clave>`
7. Poner esa URL en `resources/instalador/configuracion.json` (o en `%APPDATA%` de una sola PC) para que la app
   sincronice con pruebas.

Para desplegar cambios del Worker en pruebas: `npx wrangler deploy --env pruebas`; las migraciones nuevas, con el
comando del paso 2.

## Límites a vigilar

Vigentes al 2026-11-01 en el plan gratuito de Workers: 10 ms de CPU por petición y 50 llamadas a D1 por petición. La app sube 20 cambios por petición y descarga 50 partidas por página para respetar el límite de llamadas. El límite de CPU no se ha medido en Cloudflare real, porque `wrangler dev` no lo aplica. Si aparece el error 1102, hay que pasar al plan de pago o reducir `MAX_RECORDS_PER_PAGE` (en `src/utils/config.ts`).
