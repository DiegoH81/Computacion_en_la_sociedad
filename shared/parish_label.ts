export interface ParishName
{
	nombre: string;
	ubicacion?: string | null;
}

export function parish_label(parish: ParishName): string
{
	const place = parish.ubicacion?.trim();
	return place ? `${parish.nombre} (${place})` : parish.nombre;
}

export function parish_label_sql(alias: string): string
{
	return `CASE WHEN TRIM(IFNULL(${alias}.ubicacion, '')) = '' THEN ${alias}.nombre ELSE ${alias}.nombre || ' (' || TRIM(${alias}.ubicacion) || ')' END`;
}
