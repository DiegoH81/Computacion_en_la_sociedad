//   GET  /api/reference                                Parishes, ministers, users
//   POST /api/sync/push         { cambios: [...] }  ->  { resultados: [...] }
//   GET  /api/sync/pull?cursor=N                    ->  { partidas, cursor, hayMas }
//   GET  /api/sync/record?entidad=...&client_id=... ->  { registro }

import { Hono } from 'hono';
import { read_page, read_record, read_reference } from '../sync/pull';
import { apply_changes } from '../sync/push';
import { MAX_CHANGES_PER_PUSH, MAX_RECORDS_PER_PAGE } from '../utils/config';
import { require_json_body } from '../utils/helpers';
import { ServiceError, type AppEnv } from '../utils/middleware';

export const sync_router = new Hono<AppEnv>();

sync_router.get('/reference', async (c) =>
{
	return c.json(await read_reference(c.env.prelatura_db, c.get('user')));
});

sync_router.post('/sync/push', async (c) =>
{
	const body = await require_json_body(c);
	if (!Array.isArray(body.cambios))
		throw new ServiceError('Cuerpo de la petición inválido.', 400);

	if (body.cambios.length > MAX_CHANGES_PER_PUSH)
		throw new ServiceError(`Se aceptan hasta ${MAX_CHANGES_PER_PUSH} cambios por envío.`, 400);

	const results = await apply_changes(c.env.prelatura_db, c.get('user'), body.cambios);
	return c.json({ resultados: results });
});

sync_router.get('/sync/pull', async (c) =>
{
	const cursor = Number.parseInt(c.req.query('cursor') ?? '0', 10);
	if (!Number.isInteger(cursor) || cursor < 0)
		throw new ServiceError('Cursor inválido.', 400);

	return c.json(await read_page(c.env.prelatura_db, cursor, MAX_RECORDS_PER_PAGE));
});

sync_router.get('/sync/record', async (c) =>
{
	const entity = c.req.query('entidad') ?? '';
	const client_id = c.req.query('client_id') ?? '';

	const record = await read_record(c.env.prelatura_db, entity, client_id);
	if (!record)
		throw new ServiceError('Registro no encontrado.', 404);

	return c.json({ registro: record });
});
