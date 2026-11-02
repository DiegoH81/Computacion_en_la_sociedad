import { authenticateRequest } from './authMiddleware';
import { getDeviceKey, saveDeviceKey } from './deviceKeyService';
import {
  aplicarCambios,
  leerPagina,
  leerReferencia,
  leerRegistro,
  MAX_CAMBIOS_POR_ENVIO,
  MAX_PARTIDAS_POR_PAGINA,
} from './syncService';
import type { Autor, CambioEntrante } from './syncTypes';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

const DEVICE_KEY_PATH = /^\/api\/devices\/([^/]+)\/key$/;


export async function handleSyncRoutes(request: Request, env: Env, url: URL): Promise<Response | null> {
  const devicePath = DEVICE_KEY_PATH.exec(url.pathname);
  const isSyncRoute = url.pathname === '/api/reference' || url.pathname.startsWith('/api/sync/');
  if (!devicePath && !isSyncRoute)
    return null;

  const auth = await authenticateRequest(request, env.JWT_SECRET, env.prelatura_db);
  if (!auth.authenticated)
  {
    return jsonResponse({ message: auth.message }, auth.status);
  }
  const autor: Autor = auth.payload;

  if (url.pathname === '/api/reference' && request.method === 'GET') {
    return jsonResponse(await leerReferencia(env.prelatura_db));
  }

  if (url.pathname === '/api/sync/push' && request.method === 'POST') {
    const body = (await request.json().catch(() => null)) as { cambios?: unknown } | null;
    if (!Array.isArray(body?.cambios)) {
      return jsonResponse({ message: 'Cuerpo de la petición inválido.' }, 400);
    }
    if (body.cambios.length > MAX_CAMBIOS_POR_ENVIO) {
      return jsonResponse({ message: `Se aceptan hasta ${MAX_CAMBIOS_POR_ENVIO} cambios por envío.` }, 400);
    }
    const resultados = await aplicarCambios(env.prelatura_db, autor, body.cambios as CambioEntrante[]);
    return jsonResponse({ resultados });
  }

  if (url.pathname === '/api/sync/pull' && request.method === 'GET')
  {
    const cursor = Number.parseInt(url.searchParams.get('cursor') ?? '0', 10);
    if (!Number.isInteger(cursor) || cursor < 0) {
      return jsonResponse({ message: 'Cursor inválido.' }, 400);
    }
    return jsonResponse(await leerPagina(env.prelatura_db, cursor, MAX_PARTIDAS_POR_PAGINA));
  }

  if (url.pathname === '/api/sync/record' && request.method === 'GET')
  {
    const entidad = url.searchParams.get('entidad') ?? '';
    const clientId = url.searchParams.get('client_id') ?? '';
    const registro = await leerRegistro(env.prelatura_db, entidad, clientId);
    if (!registro)
        return jsonResponse({ message: 'Registro no encontrado.' }, 404);
    return jsonResponse({ registro });
  }

  if (devicePath)
  {
    const deviceId = devicePath[1];
    if (!env.DEVICE_KEY_SECRET) {
      console.error('Falta configurar el secreto DEVICE_KEY_SECRET.');
      return jsonResponse({ message: 'El servidor no tiene configurada la copia de claves.' }, 503);
    }

    if (request.method === 'GET') {
      const result = await getDeviceKey(env.prelatura_db, env.DEVICE_KEY_SECRET, autor, deviceId);
      return result.ok ? jsonResponse({ clave: result.clave }) : jsonResponse({ message: result.message }, result.status);
    }
    if (request.method === 'PUT') {
      const body = (await request.json().catch(() => null)) as { clave?: unknown } | null;
      const result = await saveDeviceKey(env.prelatura_db, env.DEVICE_KEY_SECRET, autor, deviceId, body?.clave);
      return result.ok
        ? jsonResponse({ parroquiaId: result.parroquiaId })
        : jsonResponse({ message: result.message }, result.status);
    }
  }

  return jsonResponse({ message: 'Not Found' }, 404);
}
