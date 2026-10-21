import { authenticateRequest } from './authMiddleware';
import {
  searchPriests,
  createPriest,
  updatePriest,
  togglePriestActive,
} from '../services/priestService';

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
 * Maneja todas las rutas bajo /api/priests. Devuelve null si la ruta
 * no corresponde a este módulo, para que index.ts pruebe otros routers.
 */
export async function handlePriestRoutes(
  request: Request,
  env: Env,
  url: URL,
): Promise<Response | null> {
  if (!url.pathname.startsWith('/api/priests')) {
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

  // --- GET /api/priests (búsqueda/listado) ---
  if (url.pathname === '/api/priests' && request.method === 'GET') {
    const params = url.searchParams;
    const result = await searchPriests(env.prelatura_db, {
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

  // --- POST /api/priests (crear) ---
  if (url.pathname === '/api/priests' && request.method === 'POST') {
    let body: {
      nombre?: string;
      apellidoPaterno?: string;
      apellidoMaterno?: string;
      parroquiaId?: number;
    };
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ message: 'Cuerpo de la petición inválido.' }, 400);
    }

    if (!body.nombre || !body.apellidoPaterno || !body.apellidoMaterno) {
      return jsonResponse({ message: 'Todos los campos son requeridos.' }, 400);
    }

    const result = await createPriest(
      env.prelatura_db,
      authContext,
      {
        nombre: body.nombre,
        apellidoPaterno: body.apellidoPaterno,
        apellidoMaterno: body.apellidoMaterno,
      },
      body.parroquiaId,
    );

    if (!result.success) {
      return jsonResponse({ message: result.message }, result.status);
    }
    return jsonResponse({ id: result.id }, 201);
  }

  // --- PUT /api/priests/:id (editar) ---
  const editMatch = url.pathname.match(/^\/api\/priests\/(\d+)$/);
  if (editMatch && request.method === 'PUT') {
    const priestId = Number(editMatch[1]);
    let body: { nombre?: string; apellidoPaterno?: string; apellidoMaterno?: string };
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ message: 'Cuerpo de la petición inválido.' }, 400);
    }

    if (!body.nombre || !body.apellidoPaterno || !body.apellidoMaterno) {
      return jsonResponse({ message: 'Todos los campos son requeridos.' }, 400);
    }

    const result = await updatePriest(env.prelatura_db, authContext, priestId, {
      nombre: body.nombre,
      apellidoPaterno: body.apellidoPaterno,
      apellidoMaterno: body.apellidoMaterno,
    });

    if (!result.success) {
      return jsonResponse({ message: result.message }, result.status);
    }
    return jsonResponse({ success: true });
  }

  // --- PATCH /api/priests/:id/toggle-active ---
  const toggleMatch = url.pathname.match(/^\/api\/priests\/(\d+)\/toggle-active$/);
  if (toggleMatch && request.method === 'PATCH') {
    const priestId = Number(toggleMatch[1]);
    const result = await togglePriestActive(env.prelatura_db, authContext, priestId);

    if (!result.success) {
      return jsonResponse({ message: result.message }, result.status);
    }
    return jsonResponse({ success: true });
  }

  return jsonResponse({ message: 'Not Found' }, 404);
}
