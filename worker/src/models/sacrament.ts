import type { SacramentType } from '../../../shared/sync';

export function is_sacrament_type(value: unknown): value is SacramentType
{
	return value === 'bautismo' || value === 'confirmacion' || value === 'matrimonio';
}

export function people_count(type: SacramentType): number
{
	if (type === 'matrimonio')
		return 2;

	return 1;
}
