import type { User } from '../../../shared/models';

export interface UserRecord extends Omit<User, 'password' | 'parroquia_nueva' | 'parroquia_nombre'>
{
	id: number;
	password_hash: string;
	activo: number;
	created_at: string;
}
