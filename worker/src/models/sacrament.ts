import type { SacramentType } from '../../../shared/sync';

export function is_sacrament_type(value: unknown): value is SacramentType
{
	return value === 'bautismo' || value === 'confirmacion' || value === 'matrimonio';
}

const GODPARENT_COLUMNS = ['padrino_1', 'padrino_2'];

const MARRIAGE_COLUMNS =
[
	'lugar',
	'testigo_1',
	'testigo_2',
	'testigo_3',
	'testigo_4',
	'conyuge_1_bautismo_parroquia',
	'conyuge_1_bautismo_fecha',
	'conyuge_2_bautismo_parroquia',
	'conyuge_2_bautismo_fecha',
];

export function detail_columns(type: SacramentType): string[]
{
	if (type === 'matrimonio')
		return MARRIAGE_COLUMNS;

	return GODPARENT_COLUMNS;
}

export function people_count(type: SacramentType): number
{
	if (type === 'matrimonio')
		return 2;

	return 1;
}
