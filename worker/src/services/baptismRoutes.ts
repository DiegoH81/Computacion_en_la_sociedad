import { authenticateRequest } from './authMiddleware';
import {
  searchBaptisms,
  createBaptism,
  updateBaptism,
  annulBaptism,
  getBaptismById,
  type CreateBaptismInput,
} from './baptismService';

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

export async function handleBaptismRoutes(
  request: Request,
  env: Env,
  url: URL,
): Promise<Response | null> {
  if (!url.pathname.startsWith('/api/baptisms')) {
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

  // --- GET /api/baptisms (búsqueda/listado) ---
  if (url.pathname === '/api/baptisms' && request.method === 'GET') {
    const params = url.searchParams;
    const result = await searchBaptisms(env.prelatura_db, {
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

  // --- GET /api/baptisms/:id (detalle) ---
  const getMatch = url.pathname.match(/^\/api\/baptisms\/(\d+)$/);
  if (getMatch && request.method === 'GET') {
    const baptism = await getBaptismById(env.prelatura_db, Number(getMatch[1]));
    if (!baptism) {
      return jsonResponse({ message: 'Partida no encontrada.' }, 404);
    }
    return jsonResponse({ baptism });
  }

  // --- POST /api/baptisms (crear) ---
  if (url.pathname === '/api/baptisms' && request.method === 'POST') {
    let body: CreateBaptismInput & { parroquiaId?: number };
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ message: 'Cuerpo de la petición inválido.' }, 400);
    }

    const result = await createBaptism(env.prelatura_db, authContext, body, body.parroquiaId);

    if (!result.success) {
      return jsonResponse({ message: result.message }, result.status);
    }
    return jsonResponse({ id: result.id }, 201);
  }

  // --- PUT /api/baptisms/:id (editar) ---
  const editMatch = url.pathname.match(/^\/api\/baptisms\/(\d+)$/);
  if (editMatch && request.method === 'PUT') {
    const baptismId = Number(editMatch[1]);
    let body: CreateBaptismInput;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ message: 'Cuerpo de la petición inválido.' }, 400);
    }

    const result = await updateBaptism(env.prelatura_db, authContext, baptismId, body);

    if (!result.success) {
      return jsonResponse({ message: result.message }, result.status);
    }
    return jsonResponse({ success: true });
  }

  // --- PATCH /api/baptisms/:id/annul ---
  const annulMatch = url.pathname.match(/^\/api\/baptisms\/(\d+)\/annul$/);
  if (annulMatch && request.method === 'PATCH') {
    const baptismId = Number(annulMatch[1]);
    let body: { motivo?: string };
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ message: 'Cuerpo de la petición inválido.' }, 400);
    }

    if (!body.motivo) {
      return jsonResponse({ message: 'El motivo de anulación es requerido.' }, 400);
    }

    const result = await annulBaptism(
      env.prelatura_db,
      authContext,
      baptismId,
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
