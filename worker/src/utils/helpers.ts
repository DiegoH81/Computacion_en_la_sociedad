import type { Context } from 'hono';
import { ServiceError } from './middleware';

export type JsonObject = Record<string, any>;


export async function read_json_body(c: Context): Promise<JsonObject | null>
{
	try
	{
		const body = await c.req.json();
		if (typeof body !== 'object' || body === null)
			return null;

		return body;
	}
	catch
	{
		return null;
	}
}

export async function require_json_body(c: Context): Promise<JsonObject>
{
	const body = await read_json_body(c);
	if (!body)
		throw new ServiceError('Cuerpo de la petición inválido.', 400);

	return body;
}

export function read_int(text: string | undefined, default_value: number, min: number, max: number): number
{
	const value = Number.parseInt(text ?? '', 10);
	if (Number.isNaN(value))
		return default_value;

	return Math.min(max, Math.max(min, value));
}

export function clean_text(value: unknown): string
{
	if (typeof value !== 'string')
		return '';

	return value.trim();
}
