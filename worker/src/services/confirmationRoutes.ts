import { authenticateRequest } from './authMiddleware';
import {
  searchConfirmations,
  createConfirmation,
  updateConfirmation,
  annulConfirmation,
  getConfirmationById,
  type CreateConfirmationInput,
} from './confirmationService';

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

export async function handleConfirmationRoutes(
  request: Request,
  env: Env,
  url: URL,
): Promise<Response | null> {
  if (!url.pathname.startsWith('/api/confirmations')) {
    return null;
  }

  const auth = await authenticateRequest(request, env.JWT_SECRET, env.prelatura_db);
  if (!auth.authenticated) {
    return jsonResponse({ message: auth.message }, auth.status);
  }

  const authContext = {
    rol: auth.payload.rol,
    parroquiaId: auth.payload.parroquiaId,
  };

  if (url.pathname === '/api/confirmations' && request.method === 'GET') {
    const params = url.searchParams;
    const result = await searchConfirmations(env.prelatura_db, {
      nombre: params.get('nombre') ?? undefined,
      apellidoPaterno: params.get('apellidoPaterno') ?? undefined,
      apellidoMaterno: params.get('apellidoMaterno') ?? undefined,
      sortBy: (params.get('sortBy') as 'nombre' | 'apellido_paterno' | 'apellido_materno') ?? 'nombre',
      sortDirection: (params.get('sortDirection') as 'asc' | 'desc') ?? 'asc',
      page: Number(params.get('page') ?? '1'),
      pageSize: Number(params.get('pageSize') ?? '20'),
    });
    return jsonResponse(result);
  }

  const getMatch = url.pathname.match(/^\/api\/confirmations\/(\d+)$/);
  if (getMatch && request.method === 'GET') {
    const confirmation = await getConfirmationById(env.prelatura_db, Number(getMatch[1]));
    if (!confirmation) {
      return jsonResponse({ message: 'Partida no encontrada.' }, 404);
    }
    return jsonResponse({ confirmation });
  }

  if (url.pathname === '/api/confirmations' && request.method === 'POST') {
    let body: CreateConfirmationInput & { parroquiaId?: number };
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ message: 'Cuerpo de la petición inválido.' }, 400);
    }

    const result = await createConfirmation(env.prelatura_db, authContext, body, body.parroquiaId);

    if (!result.success) {
      return jsonResponse({ message: result.message }, result.status);
    }
    return jsonResponse({ id: result.id }, 201);
  }

  const editMatch = url.pathname.match(/^\/api\/confirmations\/(\d+)$/);
  if (editMatch && request.method === 'PUT') {
    const confirmationId = Number(editMatch[1]);
    let body: CreateConfirmationInput;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ message: 'Cuerpo de la petición inválido.' }, 400);
    }

    const result = await updateConfirmation(env.prelatura_db, authContext, confirmationId, body);

    if (!result.success) {
      return jsonResponse({ message: result.message }, result.status);
    }
    return jsonResponse({ success: true });
  }

  const annulMatch = url.pathname.match(/^\/api\/confirmations\/(\d+)\/annul$/);
  if (annulMatch && request.method === 'PATCH') {
    const confirmationId = Number(annulMatch[1]);
    let body: { motivo?: string };
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ message: 'Cuerpo de la petición inválido.' }, 400);
    }

    if (!body.motivo) {
      return jsonResponse({ message: 'El motivo de anulación es requerido.' }, 400);
    }

    const result = await annulConfirmation(
      env.prelatura_db,
      authContext,
      confirmationId,
      body.motivo,
      auth.payload.usuarioId,
    );

    if (!result.success) {
      return jsonResponse({ message: result.message }, result.status);
    }
    return jsonResponse({ success: true });
  }

  return jsonResponse({ message: 'Not Found' }, 404);
}
