import { beforeEach, describe, expect, it } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import { hash_password, sign_jwt } from '../src/utils/crypto';
import { resetDatabase } from './helpers/resetDatabase';

// Pruebas de index.ts por HTTP: qué rutas piden sesión, CORS y respuestas a peticiones mal formadas.

const PASSWORD = 'passwordCorrecta123';
const url = (path: string) => `https://example.com${path}`;

const token_parish = () => sign_jwt({ usuarioId: 1, rol: 'admin_parroquia', parroquiaId: 1 }, env.JWT_SECRET);

async function api(path: string, init: RequestInit = {}, token?: string) {
	const headers = new Headers(init.headers);
	if (token)
		headers.set('Authorization', `Bearer ${token}`);

	return SELF.fetch(url(path), { ...init, headers });
}

function login(body: unknown) {
	return SELF.fetch(url('/api/auth/login'), {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: typeof body === 'string' ? body : JSON.stringify(body),
	});
}

beforeEach(async () => {
	await resetDatabase(env.prelatura_db);
	await env.prelatura_db.batch([
		env.prelatura_db.prepare(`INSERT INTO parroquias (id, nombre, activa) VALUES (1, 'San Pedro', 1), (2, 'Abancay', 1), (3, 'Cerrada', 0)`),
		env.prelatura_db
			.prepare(
				`INSERT INTO usuarios (id, username, password_hash, nombre, apellido_paterno, apellido_materno, rol, parroquia_id, activo)
				 VALUES (1, 'ana', ?, 'Ana', 'Rojas', '', 'admin_parroquia', 1, 1)`,
			)
			.bind(await hash_password(PASSWORD)),
	]);
});

describe('CORS', () => {
	it('OPTIONS responde con los headers de CORS sin pedir sesión', async () => {
		const response = await SELF.fetch(url('/api/sync/push'), { method: 'OPTIONS' });

		expect(response.status).toBe(200);
		expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
		expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
	});

	it('también los errores llevan CORS y JSON', async () => {
		const response = await SELF.fetch(url('/no/existe'));

		expect(response.status).toBe(404);
		expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
		expect(response.headers.get('Content-Type')).toBe('application/json');
		expect(await response.json()).toEqual({ message: 'Not Found' });
	});
});

describe('POST /api/auth/login', () => {
	it('con datos correctos devuelve token y usuario', async () => {
		const response = await login({ username: 'ana', password: PASSWORD });

		expect(response.status).toBe(200);
		const body = (await response.json()) as { token: string; usuario: Record<string, unknown> };
		expect(body.token.split('.')).toHaveLength(3);
		// Sin apellido materno no queda un espacio al final.
		expect(body.usuario).toEqual({
			id: 1,
			nombre_completo: 'Ana Rojas',
			rol: 'admin_parroquia',
			parroquia_id: 1,
			parroquia_nombre: 'San Pedro',
			parroquias: [{ id: 1, nombre: 'San Pedro', rol: 'admin_parroquia' }],
		});
	});

	it('el token sirve para las rutas protegidas', async () => {
		const { token } = (await (await login({ username: 'ana', password: PASSWORD })).json()) as { token: string };
		expect((await api('/api/parishes', {}, token)).status).toBe(200);
	});

	it('cuerpo que no es JSON, o que no es un objeto, responde 400', async () => {
		for (const body of ['no es json', 'null', '"texto"', '42']) {
			const response = await login(body);
			expect(response.status).toBe(400);
			expect(await response.json()).toEqual({ message: 'Cuerpo de la petición inválido.' });
		}
	});

	it('sin usuario o sin contraseña responde 400', async () => {
		for (const body of [{}, { username: 'ana' }, { password: PASSWORD }, { username: '', password: '' }]) {
			const response = await login(body);
			expect(response.status).toBe(400);
			expect(await response.json()).toEqual({ message: 'Usuario y contraseña son requeridos.' });
		}
	});

	it('usuario inexistente y contraseña incorrecta responden igual', async () => {
		const wrong_password = await login({ username: 'ana', password: 'otra' });
		const unknown_user = await login({ username: 'nadie', password: PASSWORD });

		expect(wrong_password.status).toBe(401);
		expect(unknown_user.status).toBe(401);
		expect(await wrong_password.json()).toEqual(await unknown_user.json());
	});

	it('otro método en la ruta de login responde 404', async () => {
		expect((await SELF.fetch(url('/api/auth/login'))).status).toBe(404);
	});
});

describe('rutas protegidas', () => {
	it('sin token responden 401, y una ruta desconocida responde 404 sin pedir token', async () => {
		for (const path of ['/api/parishes', '/api/reference', '/api/sync/pull', '/api/sync/otra', '/api/users', '/api/devices/x/key']) {
			const response = await SELF.fetch(url(path));
			expect(response.status, path).toBe(401);
			expect(await response.json()).toEqual({ message: 'Token no proporcionado.' });
		}

		expect((await SELF.fetch(url('/api/otra-cosa'))).status).toBe(404);
		// DELETE a parroquias no es una ruta: no se revisa el token.
		expect((await SELF.fetch(url('/api/parishes'), { method: 'DELETE' })).status).toBe(404);
	});

	it('un token mal firmado responde 401', async () => {
		const forged = await sign_jwt({ usuarioId: 1, rol: 'admin_general', parroquiaId: null }, 'otro-secreto');
		const response = await api('/api/parishes', {}, forged);

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ message: 'Sesión inválida o expirada.' });
	});

	it('GET /api/parishes lista solo las activas, por nombre', async () => {
		const response = await api('/api/parishes', {}, await token_parish());
		expect(await response.json()).toEqual({ parishes: [{ id: 2, nombre: 'Abancay' }, { id: 1, nombre: 'San Pedro' }] });
	});

	it('GET /api/reference manda el password_hash de la propia cuenta, para entrar sin internet', async () => {
		const response = await api('/api/reference', {}, await token_parish());
		const body = (await response.json()) as { parroquias: unknown[]; ministros: unknown[]; usuarios: Record<string, unknown>[] };

		expect(body.parroquias).toHaveLength(3);
		expect(body.ministros).toEqual([]);
		expect(body.usuarios).toHaveLength(1);
		expect(String(body.usuarios[0].password_hash)).toMatch(/^100000:/);
	});

	it('una ruta de sincronización desconocida, con sesión, responde 404', async () => {
		expect((await api('/api/sync/otra', {}, await token_parish())).status).toBe(404);
		expect((await api('/api/sync/pull', { method: 'POST' }, await token_parish())).status).toBe(404);
	});
});

describe('sincronización: peticiones mal formadas', () => {
	it('push sin lista de cambios responde 400', async () => {
		for (const body of ['no es json', '{}', '{"cambios": "x"}', 'null']) {
			const response = await api('/api/sync/push', { method: 'POST', body }, await token_parish());
			expect(response.status).toBe(400);
		}
	});

	it('push con más de 20 cambios responde 400', async () => {
		const cambios = Array.from({ length: 21 }, (_, i) => ({ entidad: 'ministro', client_id: `m-${i}`, cola_id: `c-${i}` }));
		const response = await api('/api/sync/push', { method: 'POST', body: JSON.stringify({ cambios }) }, await token_parish());

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ message: 'Se aceptan hasta 20 cambios por envío.' });
	});

	it('cada cambio inválido se rechaza por separado, sin cortar a los demás', async () => {
		const cambios = [
			null,
			{ entidad: 'otra', client_id: 'x', cola_id: 'c1' },
			{ entidad: 'ministro', client_id: '', cola_id: 'c2' },
			{
				entidad: 'ministro',
				client_id: 'm-1',
				cola_id: 'c3',
				version_base: null,
				datos: { client_id: 'm-1', parroquia_id: 1, titulo: null, nombre: 'Luis', apellido_paterno: 'Paz', apellido_materno: 'Vega', activo: 1 },
			},
		];
		const response = await api('/api/sync/push', { method: 'POST', body: JSON.stringify({ cambios }) }, await token_parish());
		const { resultados } = (await response.json()) as { resultados: { estado: string; motivo?: string }[] };

		expect(resultados.map((result) => result.estado)).toEqual(['rechazado', 'rechazado', 'rechazado', 'aplicado']);
		expect(resultados[0].motivo).toBe('El cambio no identifica su registro.');
		expect(resultados[1].motivo).toBe('Tipo de registro no reconocido.');
	});

	it('pull con un cursor que no es un número positivo responde 400', async () => {
		for (const cursor of ['abc', '-1']) {
			const response = await api(`/api/sync/pull?cursor=${cursor}`, {}, await token_parish());
			expect(response.status).toBe(400);
			expect(await response.json()).toEqual({ message: 'Cursor inválido.' });
		}
	});

	it('pull sin cursor empieza desde el principio', async () => {
		const response = await api('/api/sync/pull', {}, await token_parish());
		expect(await response.json()).toEqual({ partidas: [], cursor: 0, hayMas: false });
	});

	it('record de algo que no existe responde 404', async () => {
		for (const query of ['entidad=bautismo&client_id=nada', 'entidad=ministro&client_id=nada', '']) {
			const response = await api(`/api/sync/record?${query}`, {}, await token_parish());
			expect(response.status).toBe(404);
			expect(await response.json()).toEqual({ message: 'Registro no encontrado.' });
		}
	});

	it('la clave de una PC solo acepta GET y PUT', async () => {
		const response = await api('/api/devices/11111111-2222-4333-8444-555555555555/key', { method: 'PATCH' }, await token_parish());
		expect(response.status).toBe(404);
	});
});
