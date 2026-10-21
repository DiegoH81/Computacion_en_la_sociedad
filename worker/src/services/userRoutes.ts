import { authenticateRequest } from './authMiddleware';
import {
  searchUsers,
  createUser,
  updateUser,
  toggleUserActive,
  type CreateUserInput,
  type UpdateUserInput,
} from './userService';

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

/** Entero dentro de [min, max]; si no es un número válido, devuelve el valor por defecto. */
function boundedInt(raw: string | null, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(raw ?? '', 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

/**
 * Maneja todas las rutas bajo /api/users. Devuelve null si la ruta no
 * corresponde a este módulo, para que index.ts pruebe otros routers.
 *
 * La restricción "solo admin" la aplica userService en cada operación; aquí
 * solo se autentica y se traduce HTTP <-> Service.
 */
export async function handleUserRoutes(
  request: Request,
  env: Env,
  url: URL,
): Promise<Response | null> {
  if (!url.pathname.startsWith('/api/users')) {
    return null;
  }

  const auth = await authenticateRequest(request, env.JWT_SECRET, env.prelatura_db);
  if (!auth.authenticated) {
    return jsonResponse({ message: auth.message }, auth.status);
  }

  const ctx = { rol: auth.payload.rol, usuarioId: auth.payload.usuarioId };

  // --- GET /api/users (búsqueda/listado) ---
  if (url.pathname === '/api/users' && request.method === 'GET') {
    const params = url.searchParams;
    const result = await searchUsers(env.prelatura_db, ctx, {
      nombre: params.get('nombre') ?? undefined,
      apellidoPaterno: params.get('apellidoPaterno') ?? undefined,
      apellidoMaterno: params.get('apellidoMaterno') ?? undefined,
      sortBy: (params.get('sortBy') as 'nombre' | 'apellido_paterno' | 'apellido_materno') ?? 'nombre',
      sortDirection: (params.get('sortDirection') as 'asc' | 'desc') ?? 'asc',
      page: boundedInt(params.get('page'), 1, 1, 100_000),
      pageSize: boundedInt(params.get('pageSize'), 20, 1, 100),
    });

    if (!result.success) {
      return jsonResponse({ message: result.message }, result.status);
    }
    return jsonResponse({ users: result.users, totalPages: result.totalPages });
  }

  // --- POST /api/users (crear) ---
  if (url.pathname === '/api/users' && request.method === 'POST') {
    let body: CreateUserInput;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ message: 'Cuerpo de la petición inválido.' }, 400);
    }

    const result = await createUser(env.prelatura_db, ctx, body);

    if (!result.success) {
      return jsonResponse({ message: result.message }, result.status);
    }
    return jsonResponse({ id: result.id }, 201);
  }

  // --- PUT /api/users/:id (editar) ---
  const editMatch = url.pathname.match(/^\/api\/users\/(\d+)$/);
  if (editMatch && request.method === 'PUT') {
    let body: UpdateUserInput;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ message: 'Cuerpo de la petición inválido.' }, 400);
    }

    const result = await updateUser(env.prelatura_db, ctx, Number(editMatch[1]), body);

    if (!result.success) {
      return jsonResponse({ message: result.message }, result.status);
    }
    return jsonResponse({ success: true });
  }

  // --- PATCH /api/users/:id/toggle-active ---
  const toggleMatch = url.pathname.match(/^\/api\/users\/(\d+)\/toggle-active$/);
  if (toggleMatch && request.method === 'PATCH') {
    const result = await toggleUserActive(env.prelatura_db, ctx, Number(toggleMatch[1]));

    if (!result.success) {
      return jsonResponse({ message: result.message }, result.status);
    }
    return jsonResponse({ success: true });
  }

  return jsonResponse({ message: 'Not Found' }, 404);
}
