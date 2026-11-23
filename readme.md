# Registro Sacramental — Prelatura de Ayaviri

Aplicación de escritorio para registrar y consultar las partidas de **bautismo, confirmación y matrimonio**
de las parroquias de la Prelatura de Ayaviri (decanaturas de Melgar y Carabaya).

Funciona **sin internet**: cada PC guarda sus datos en una base cifrada propia. Cuando hay conexión,
sincroniza con un servidor en Cloudflare, y así todas las parroquias comparten lo mismo.

---

## Contenido

1. [Cómo está armado](#cómo-está-armado)
2. [Uso de la aplicación](#uso-de-la-aplicación)
3. [Desarrollo](#desarrollo)
4. [Pruebas automáticas](#pruebas-automáticas)
5. [Servidores: local, pruebas y producción](#servidores-local-pruebas-y-producción)
6. [Datos de prueba (capacitación)](#datos-de-prueba-capacitación)
7. [El instalador](#el-instalador)
8. [Mantenimiento y recuperación](#mantenimiento-y-recuperación)
9. [Cuidados importantes](#cuidados-importantes)

---

## Estructura

```
electron/     Electron: base local SQLite cifrada, sincronización, respaldos y Excel
src/          Interfaz en React
shared/       Tipos y reglas compartidas
worker/       Servidor: Cloudflare Worker (Hono) con base D1
tests/        Pruebas unitarias, de sincronización y end-to-end (Playwright)
```

### Roles

| Rol | Qué hace |
|---|---|
| **Administrador general** | Crea parroquias y cuentas y consulta todas las parroquias. No registra ni modifica partidas. Uno de ellos es el **principal**: el único que crea otros administradores generales. |
| **Administrador de parroquia** | Registra y corrige las partidas de su parroquia, aprueba los cambios pedidos y crea usuarios. El **principal** de la parroquia también gestiona a los demás administradores de ella. |
| **Usuario** | Registra partidas. En una partida ya guardada no cambia nada directamente: **pide el cambio**, y un administrador de la parroquia lo aprueba. |

---

## Uso de la aplicación

### Instalar en una PC

1. Ejecutar `Registro Sacramental ... Setup 1.0.0.exe`.
2. Al abrirla por primera vez, la app carga el paquete inicial.

Requisito: Windows 10 o superior

### Sincronización

- Con internet, la PC sube lo que registró y baja lo que cambiaron las otras PCs.
- Sin internet, todo queda pendiente en la PC y se sube cuando vuelve la conexión. Al cerrar la app también intenta subir lo pendiente.
- Conflictos: si dos PCs cambiaron la misma partida, la pantalla "Sincronización" muestra las dos versiones lado a lado.

### Módulos

- **Bautismos, Confirmaciones, Matrimonios:** registrar, buscar, imprimir la partida y el índice de un libro.
- **Cambios por aprobar:** los cambios que pidieron los usuarios.
- **Configuración:**
  - **Exportar e importar:** exportación e importación de los datos de los usuarios.
  - **Modificaciones:** Trazabilidad de todos los movimientos realizados en el sistema.
- **Estadísticas:** por año y por celebrante.

---

## Desarrollo

Requisitos: **Node.js 24** o superior (los scripts del Worker ejecutan TypeScript directamente) y Windows.

```powershell
npm install
cd worker; npm install; cd ..
```

### Encender todo en la PC

1. **Worker local**, desde `worker/`:
   ```powershell
   copy .dev.vars.example .dev.vars
   npx wrangler d1 migrations apply prelatura-db --local
   npx wrangler dev
   ```
2. **App**, desde la raíz: `npm run dev`.

### A qué servidor se conecta la app

La app usa la primera dirección que encuentra, en este orden:

1. La variable de entorno `PRELATURA_API_URL`.
2. `%APPDATA%\computacion-en-la-sociedad\configuracion.json`: sirve para cambiarla en una sola PC.
3. `resources/instalador/configuracion.json`: viene con el instalador y es la que usan todas las PCs.
4. La compilada en la app (`VITE_WORKER_URL` en `.env.production.local`).
5. `http://localhost:8787`.


### Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Abre la aplicación |
| `npm run build` | Compila la aplicación |
| `npm run dist` | Compila y arma el instalador en `release/` |
| `npx vitest run tests/unit` | Pruebas unitarias |
| `npm run test:sync` | Pruebas de sincronización |
| `npx playwright test` | Pruebas end-to-end |
| `cd worker; npx vitest run` | Pruebas del Worker |

---


### Actualizar un servidor (código nuevo o migraciones nuevas)

```powershell
# Test
npx wrangler d1 migrations apply prelatura-db-pruebas --remote --env pruebas
npx wrangler deploy --env pruebas

# Producción
npx wrangler d1 migrations apply prelatura-db --remote
npx wrangler deploy
```

### Límites del plan gratuito de Cloudflare

Al 2026-11, el plan gratuito permite 10 ms de CPU y 50 llamadas a D1 por petición. Por eso la app sube 20 cambios y baja 50 partidas por petición. Si aparece el error 1102, hay que pasar al plan de pago o reducir `MAX_RECORDS_PER_PAGE` (en `worker/src/utils/config.ts`).

---

## El instalador

Lleva dos archivos de `resources/instalador/`:

- `configuracion.json`: la dirección del servidor con el que sincronizan las PCs.
- `paquete-inicial.json`: los datos con los que arranca una PC nueva. Tiene parroquias, cuentas con sus parroquias, ministros y partidas.

### Armarlo

1. Generar el paquete inicial desde el servidor que van a usar las PCs, o desde la base local si es una copia
   exacta, como en pruebas. Se hace con una cuenta de administrador general, desde `worker/`:
   ```powershell
   npm run package:build -- --url <URL del Worker> --user <admin general> --password <clave>
   ```
   También se puede generar desde la app, en **Configuración -> Generar paquete inicial**, y copiarlo a
   `resources/instalador/`.
2. Poner en `resources/instalador/configuracion.json` la URL de ese servidor.
3. Revisar `.env.production.local` (`VITE_WORKER_URL`). Solo se usa si falta el archivo anterior, pero
   conviene que apunte al mismo servidor.
4. `npm run dist`. El instalador queda en `release/`.


---

## Mantenimiento y recuperación

### Recuperar una cuenta (sobre todo, la del administrador general principal)

Desde la app nadie puede cambiarle la contraseña al administrador general principal. Si se pierde, la
recupera quien tenga acceso a la cuenta de Cloudflare, desde cualquier PC con este proyecto y Node:

```powershell
cd worker
npx wrangler login
node src/scripts/recuperar-admin.mjs --usuario=admin_general --remote                  # producción
node src/scripts/recuperar-admin.mjs --usuario=admin_general --remote --env=pruebas    # pruebas
node src/scripts/recuperar-admin.mjs --usuario=admin_general --local                   # Worker local
```

- Pone una **contraseña nueva aleatoria** y la muestra una sola vez.
- Si la cuenta estaba deshabilitada, la habilita.
- Con `--principal`, además le devuelve la marca de principal.
- Queda anotado en "Modificaciones".
- Las PCs reciben la contraseña nueva al sincronizar.

### Scripts del Worker (`worker/src/scripts/`)

| Script | Para qué |
|---|---|
| `seed-prelatura.mjs` | Carga los datos de prueba de la prelatura. Borra todo. Solo acepta `--remote` con `--env=pruebas`. |
| `copiar-local-a-pruebas.mjs` | Copia la base local, tal cual, a la de pruebas. |
| `build-package.mjs` (`npm run package:build`) | Genera el paquete inicial del instalador. |
| `bootstrap-production.mjs` | Prepara una base de producción nueva: quita las cuentas de prueba y crea el administrador principal. |
| `recuperar-admin.mjs` | Recupera una cuenta: contraseña nueva, la habilita y, si se pide, le devuelve la marca de principal. |
| `seed-dev.mjs`, `seed-demo.mjs` | Datos de desarrollo y de demostración. |
