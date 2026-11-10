import type { PublicRoutes } from '../utils/middleware';
import { server_url } from '../utils/server_address';

export const server_routes: PublicRoutes =
{
	'app.server': () =>
	{
		return { servidor: server_url() };
	},
};
