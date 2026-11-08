# Archivos que lleva el instalador

En esta carpeta van dos archivos (los dos JSON; `.gitignore` los excluye del repositorio):

- `configuracion.json`: la dirección del servidor con el que sincronizan las PCs.
- `paquete-inicial.json`: los datos con los que arranca una PC nueva (ver más abajo).

## Dirección del servidor (`configuracion.json`)

```json
{ "servidor": "https://registro-sacramental.<subdominio>.workers.dev" }
```

La app busca la dirección en este orden y usa la primera que encuentra:

1. `%APPDATA%\Registro Sacramental\configuracion.json`: para cambiarla en **una sola PC**.
2. Este archivo, que viene con el instalador: la que usan **todas** las PCs.
3. La que se compiló en la app (`VITE_WORKER_URL`), y si no hay, `http://localhost:8787` (desarrollo).

Si el servidor cambia de dirección, no hace falta volver a compilar: se edita el archivo (o se crea el
de la PC) y se cierra y abre la app. Si el archivo tiene un error, la app lo anota en su registro y usa
la siguiente opción.

# Paquete inicial del instalador

Muchas parroquias no tienen internet. Para que la app funcione desde el primer día, el instalador puede
llevar un **paquete inicial**: parroquias, usuarios (solo el hash de sus contraseñas), ministros y partidas.

## Cómo armar el instalador con el paquete

1. Genere el paquete desde la base online, con una cuenta de **administrador general**. Desde `worker/`:

   ```
   npm run package:build -- --url https://<el-worker> --user <admin general> --password <su clave>
   ```

   Sin `--url` usa el Worker local (`http://localhost:8787`). El archivo queda en esta carpeta como
   `paquete-inicial.json`.
2. Arme el instalador: `npm run dist`. Queda en la carpeta `release/`.

(También se puede generar desde la app: **Configuración → Generar paquete inicial**, entrando como
administrador general en una PC sincronizada, y copiar el archivo aquí.)

Al abrir la app por primera vez en la PC de la parroquia, la base local está vacía: la app encuentra el
paquete y lo carga sola, sin preguntar nada. Desde ese momento los usuarios entran sin internet. Cuando la PC
tenga conexión, sube lo suyo y baja lo que cambió desde que se generó el paquete.

En desarrollo (`npm run dev`) la app también lo carga desde esta carpeta si la base local está vacía.

Para probarlo sin armar el instalador, la variable de entorno `PRELATURA_PAQUETE` puede indicar otro archivo.

## Respaldos

El paquete inicial solo se carga desde el instalador. Para pasar los datos de una PC a otra (por ejemplo,
porque se dañó) se usa un **respaldo**: en **Configuración → Exportar respaldo** un administrador guarda
todo lo de la PC, también lo que todavía no se subió, en un archivo `.respaldo` protegido con una contraseña.

Se restaura en **Configuración → Restaurar respaldo** (reemplaza los datos de la PC y pide volver a entrar)
o, en una PC sin usuarios, con el botón **Restaurar respaldo** de la pantalla de inicio de sesión.

## Cuidado

- El paquete tiene **datos personales** (nombres, DNI) y los hash de las contraseñas. No lo suba al
  repositorio (`.gitignore` ya lo excluye) y no lo deje en una USB que circule.
- Solo se carga en una PC **sin usuarios**. En una PC que ya se usa, no hace nada.
- Un usuario creado o una contraseña cambiada después de generar el paquete no estará en la PC hasta
  que esta sincronice con internet.
