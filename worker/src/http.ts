// Funciones pequeñas para responder peticiones HTTP. Todas las rutas las usan.

// La app de escritorio llama al Worker desde otro origen, por eso cada respuesta lleva estos headers.
export const CORS_HEADERS =
{
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export function json_response(body: unknown, status: number = 200): Response
{
	const headers = { 'Content-Type': 'application/json', ...CORS_HEADERS };
	return new Response(JSON.stringify(body), { status: status, headers: headers });
}

// Un objeto que llegó por la red. Sus campos pueden traer cualquier cosa, por eso se revisan uno por uno.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JsonObject = Record<string, any>;

// Todos los errores se mandan igual: { message: '...' }
export function error_response(message: string, status: number): Response
{
	return json_response({ message: message }, status);
}

export function bad_body_response(): Response
{
	return error_response('Cuerpo de la petición inválido.', 400);
}

export function not_found_response(): Response
{
	return error_response('Not Found', 404);
}

// Lee el cuerpo como JSON. Devuelve null si no es JSON o si no es un objeto.
export async function read_json_body(request: Request): Promise<JsonObject | null>
{
	try
	{
		const body = await request.json();
		if (typeof body !== 'object' || body === null)
			return null;

		return body;
	}
	catch
	{
		return null;
	}
}
