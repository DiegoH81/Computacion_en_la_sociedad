import { login } from './services/authService';
import { authenticateRequest } from './services/authMiddleware';
import { handlePriestRoutes } from './services/priestRoutes';
import { handleMarriageRoutes } from './services/marriageRoutes';
import { handleBaptismRoutes } from './services/baptismRoutes';
import { handleConfirmationRoutes } from './services/confirmationRoutes';
import { handleUserRoutes } from './services/userRoutes';
import { handleSacramentIndexRoutes } from './services/sacramentIndexRoutes';

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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // --- POST /api/auth/login (público) ---
    if (url.pathname === '/api/auth/login' && request.method === 'POST') {
      let body: { username?: string; password?: string };
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ message: 'Cuerpo de la petición inválido.' }, 400);
      }

      if (!body.username || !body.password) {
        return jsonResponse({ message: 'Usuario y contraseña son requeridos.' }, 400);
      }

      const result = await login(env.prelatura_db, env.JWT_SECRET, body.username, body.password);

      if (!result.success) {
        return jsonResponse({ message: result.message }, 401);
      }

      return jsonResponse({ token: result.token, usuario: result.usuario });
    }

    // --- GET /api/parishes (protegido) ---
    if (url.pathname === '/api/parishes' && request.method === 'GET') {
      const auth = await authenticateRequest(request, env.JWT_SECRET, env.prelatura_db);
      if (!auth.authenticated) {
        return jsonResponse({ message: auth.message }, auth.status);
      }

      const { results } = await env.prelatura_db
        .prepare('SELECT id, nombre FROM parroquias WHERE activa = 1 ORDER BY nombre ASC')
        .all<{ id: number; nombre: string }>();

      return jsonResponse({ parishes: results });
    }

    // --- /api/priests/* (delegado al router de sacerdotes) ---
    const priestResponse = await handlePriestRoutes(request, env, url);
    if (priestResponse) {
      return priestResponse;
    }

    // --- /api/marriages/* (delegado al router de matrimonios) ---
    const marriageResponse = await handleMarriageRoutes(request, env, url);
    if (marriageResponse) {
      return marriageResponse;
    }

    // --- /api/baptisms/* (delegado al router de bautismos) ---
    const baptismResponse = await handleBaptismRoutes(request, env, url);
    if (baptismResponse) {
      return baptismResponse;
    }

    // --- /api/confirmations/* (delegado al router de confirmaciones) ---
    const confirmationResponse = await handleConfirmationRoutes(request, env, url);
    if (confirmationResponse) {
      return confirmationResponse;
    }

    // --- /api/users/* (delegado al router de usuarios, solo admin) ---
    const userResponse = await handleUserRoutes(request, env, url);
    if (userResponse) {
      return userResponse;
    }

    // --- /api/sacrament-index/* (índices alfabéticos para imprimir) ---
    const indexResponse = await handleSacramentIndexRoutes(request, env, url);
    if (indexResponse) {
      return indexResponse;
    }

    return jsonResponse({ message: 'Not Found' }, 404);
  },
};
