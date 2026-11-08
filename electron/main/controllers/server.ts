// La dirección del servidor que usa esta PC (ver utils/server_address.ts). La pide la pantalla para
// las pocas llamadas que hace directo al Worker, así las dos usan la misma. No pide sesión.

import type { PublicRoutes } from '../utils/middleware';
import { server_url } from '../utils/server_address';

export const server_routes: PublicRoutes =
{
	'app.server': () =>
	{
		return { servidor: server_url() };
	},
};
