import type { SearchFilters } from '../../../shared/models';
import { PAGE_SIZE } from './config';
import { ServiceError } from './errors';

export function clean_text(value: unknown): string | null
{
	if (typeof value !== 'string')
		return null;

	const trimmed = value.trim();
	if (trimmed === '')
		return null;

	return trimmed;
}

export function positive_id(value: unknown, not_found_message: string = 'Partida no encontrada.'): number
{
	if (!Number.isInteger(value) || (value as number) <= 0)
		throw new ServiceError(not_found_message, 404);

	return value as number;
}

// Current page and total
export function page_of(filters: SearchFilters, total_rows: number): { offset: number; total_pages: number }
{
	let page = 1;
	if (Number.isInteger(filters.pagina) && (filters.pagina as number) > 0)
		page = filters.pagina as number;

	return {
		offset: (page - 1) * PAGE_SIZE,
		total_pages: Math.max(1, Math.ceil(total_rows / PAGE_SIZE)),
	};
}

export function sort_direction(filters: SearchFilters): 'ASC' | 'DESC'
{
	if (filters.direccion === 'desc')
		return 'DESC';

	return 'ASC';
}

export function full_name(first_name: string | null, father_last_name: string | null, mother_last_name: string | null): string
{
	return [first_name, father_last_name, mother_last_name].filter((part) => part).join(' ');
}
