// Prepara una base recién migrada para producción: las migraciones crean datos de prueba con
// contraseñas conocidas (admin/admin123, parroco1/parroco123). Este script los quita y crea un
// administrador real con una contraseña aleatoria, que se muestra una sola vez.
//
// Uso, desde worker/:
//   node src/scripts/bootstrap-production.mjs --admin=usuario --nombre=Ana --paterno=Quispe --materno=Mamani
//
// Por defecto trabaja sobre la base remota. Para probarlo en local:
//   ... --local --persist-to=carpeta

import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';

const PBKDF2_ITERATIONS = 100_000; // Igual que worker/src/lib/password.ts.

const { values } = parseArgs({
  options: {
    admin: { type: 'string' },
    nombre: { type: 'string' },
    paterno: { type: 'string' },
    materno: { type: 'string', default: '' },
    local: { type: 'boolean', default: false },
    'persist-to': { type: 'string' },
  },
});

if (!values.admin || !values.nombre || !values.paterno) {
  console.error('Faltan datos. Uso: --admin=usuario --nombre=Ana --paterno=Quispe [--materno=Mamani]');
  process.exit(1);
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' }, material, 256);
  return `${PBKDF2_ITERATIONS}:${Buffer.from(salt).toString('base64')}:${Buffer.from(bits).toString('base64')}`;
}

const sqlText = (value) => `'${String(value).replaceAll("'", "''")}'`;

const password = randomBytes(18).toString('base64url');
const hash = await hashPassword(password);

// Solo se borra lo que nada usa: si ya hay partidas, las filas referenciadas se quedan.
const sql = `
DELETE FROM usuarios WHERE username IN ('admin', 'parroco1')
  AND id NOT IN (SELECT usuario_id FROM cambios_persona)
  AND id NOT IN (SELECT anulado_por_usuario_id FROM sacramentos WHERE anulado_por_usuario_id IS NOT NULL);

DELETE FROM ministros WHERE nombre IN ('Braulio', 'Manuel') AND apellido_paterno IN ('Guido', 'Torres')
  AND id NOT IN (SELECT ministro_id FROM sacramentos WHERE ministro_id IS NOT NULL);

DELETE FROM parroquias WHERE nombre IN ('Parroquia 1', 'Parroquia 2', 'Parroquia 3')
  AND id NOT IN (SELECT parroquia_id FROM usuarios WHERE parroquia_id IS NOT NULL)
  AND id NOT IN (SELECT parroquia_id FROM ministros)
  AND id NOT IN (SELECT parroquia_id FROM sacramentos)
  AND id NOT IN (SELECT parroquia_id FROM personas);

INSERT INTO usuarios (username, password_hash, rol, parroquia_id, nombre, apellido_paterno, apellido_materno)
VALUES (${sqlText(values.admin)}, ${sqlText(hash)}, 'admin', NULL, ${sqlText(values.nombre)}, ${sqlText(values.paterno)}, ${sqlText(values.materno)});
`;

const directory = mkdtempSync(path.join(tmpdir(), 'prelatura-bootstrap-'));
const file = path.join(directory, 'bootstrap.sql');
writeFileSync(file, sql);

const target = values.local ? '--local' : '--remote';
const persist = values['persist-to'] ? `--persist-to "${values['persist-to']}"` : '';
const result = spawnSync(`npx wrangler d1 execute prelatura-db ${target} ${persist} --yes --file="${file}"`, {
  shell: true,
  encoding: 'utf8',
  input: '',
});
rmSync(directory, { recursive: true, force: true });

if (result.status !== 0) {
  console.error(result.stdout, result.stderr);
  console.error('No se pudo preparar la base. No se creó el administrador.');
  process.exit(1);
}

console.log('Base preparada: se quitaron los datos de prueba y se creó el administrador.');
console.log(`  Usuario:    ${values.admin}`);
console.log(`  Contraseña: ${password}`);
console.log('Guárdela ahora: no se vuelve a mostrar.');
