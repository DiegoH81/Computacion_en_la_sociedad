import type { Role } from '../../../shared/sync';

export interface User
{
	id: number;
	parroquia_id: number | null;
	username: string;
	rol: Role;
	nombre: string;
	apellido_paterno: string;
	apellido_materno: string;
	activo: number;
}
