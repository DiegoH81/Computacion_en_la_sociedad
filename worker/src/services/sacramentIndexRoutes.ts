import { authenticateRequest } from './authMiddleware';
import { getIndexEntries, isSacramentType, listIndexBooks } from './sacramentIndexService';

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

/**
 * GET /api/sacrament-index/:tipo/libros?parroquiaId=  libros con partidas vigentes
 * GET /api/sacrament-index/:tipo?parroquiaId=&libro=  entradas en orden alfabético
 *
 * Imprimir el índice es exclusivo de la parroquia del usuario (o de un admin).
 */
export async function handleSacramentIndexRoutes(
  request: Request,
  env: Env,
  url: URL,
): Promise<Response | null> {
  const match = url.pathname.match(/^\/api\/sacrament-index\/([a-z]+)(\/libros)?$/);
  if (!match) {
    return null;
  }

  const auth = await authenticateRequest(request, env.JWT_SECRET, env.prelatura_db);
  if (!auth.authenticated) {
    return jsonResponse({ message: auth.message }, auth.status);
  }

  const [, tipo, booksPath] = match;
  if (!isSacramentType(tipo) || request.method !== 'GET') {
    return jsonResponse({ message: 'Not Found' }, 404);
  }

  const parroquiaId = Number(url.searchParams.get('parroquiaId'));
  if (!Number.isInteger(parroquiaId) || parroquiaId <= 0) {
    return jsonResponse({ message: 'Debe especificar la parroquia.' }, 400);
  }

  if (auth.payload.rol !== 'admin' && auth.payload.parroquiaId !== parroquiaId) {
    return jsonResponse({ message: 'No tiene permiso para imprimir el índice de otra parroquia.' }, 403);
  }

  if (booksPath) {
    return jsonResponse({ libros: await listIndexBooks(env.prelatura_db, tipo, parroquiaId) });
  }

  const libro = url.searchParams.get('libro') ?? undefined;
  return jsonResponse({ entries: await getIndexEntries(env.prelatura_db, tipo, parroquiaId, libro) });
}
