export const PARTIAL_DATE_PATTERN = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;

const MISSING = '?';

export interface DateParts
{
	year: string;
	month: string;
	day: string;
}

export function days_in_month(in_month: string, in_year: string): number
{
	const year = in_year ? Number(in_year) : 2000;
	return new Date(year, Number(in_month), 0).getDate();
}

export function split_date(in_value: string | null | undefined): DateParts
{
	const [year = '', month = '', day = ''] = (in_value ?? '').split('-').map((part) => (part === MISSING ? '' : part));
	return { year, month, day };
}

export function join_date(in_parts: DateParts): string
{
	const parts = [in_parts.year, in_parts.month, in_parts.day];

	let last = parts.length - 1;
	while (last >= 0 && !parts[last])
		last--;

	return parts.slice(0, last + 1).map((part) => part || MISSING).join('-');
}

export function short_date(in_value: string | null | undefined): string
{
	if (!in_value)
		return '';

	const match = PARTIAL_DATE_PATTERN.exec(in_value);
	if (!match)
		return in_value;

	const [, year, month, day] = match;
	return [day, month, year].filter(Boolean).join('/');
}

export function date_problem(in_value: string | null | undefined): string | null
{
	if (!in_value)
		return null;

	const { year, month, day } = split_date(in_value);

	if (!year)
		return 'falta el año';

	if (day && !month)
		return 'falta el mes';

	if (!PARTIAL_DATE_PATTERN.test(in_value))
		return null;

	if (day && Number(day) > days_in_month(month, year))
		return 'ese día no existe en ese mes';

	return null;
}
