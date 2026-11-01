# Desarrollo y despliegue del Worker

## En desarrollo no hace falta una cuenta de Cloudflare

`npx wrangler dev` simula el Worker y la base D1 en tu PC. Los datos quedan en `worker/.wrangler/`.

1. Copia `.dev.vars.example` como `.dev.vars` y pon valores propios en ambos secretos.
2. Crea la base:
   - **Si es nueva:** `npm run db:setup`. Crea el modelo final con los usuarios de prueba `admin/admin123` y `parroco1/parroco123`.
   - **Si ya la tenías:** ejecuta `npx wrangler d1 execute prelatura-db --local --file=src/db/migrations/0011_sincronizacion.sql` y luego lo mismo con `0012_ministros_restricciones.sql`. La primera elimina las tablas `*_legacy` con sus datos de prueba.
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

**2. Crea la base y actualiza `wrangler.jsonc`.** Copia el `database_id` que muestra el comando. Cambia también `name`, que hoy es el genérico `worker`, porque de él depende la URL.

```powershell
npx wrangler d1 create prelatura-db
```

**3. Aplica las migraciones y prepara la base.** Las migraciones crean usuarios de prueba con contraseñas conocidas, y el segundo comando los elimina. Por eso va **antes de desplegar**: así el Worker nunca queda público con esas contraseñas. Guarda la contraseña que muestra, porque no se vuelve a mostrar.

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

**6. Compila la app apuntando a esa URL.** En la raíz del proyecto, copia `.env.example` como `.env.production.local`, pon la URL que mostró el despliegue y ejecuta `npm run build`.

## Límites a vigilar

Vigentes al 2026-11-01 en el plan gratuito de Workers: 10 ms de CPU por petición y 50 llamadas a D1 por petición. La app sube 20 cambios por petición y descarga 50 partidas por página para respetar el límite de llamadas. El límite de CPU no se ha medido en Cloudflare real, porque `wrangler dev` no lo aplica. Si aparece el error 1102, hay que pasar al plan de pago o reducir `MAX_PARTIDAS_POR_PAGINA`.
