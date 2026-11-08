import type { Role } from './sync';
import { ROLES } from './sync';

export const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,50}$/;

export function is_role(value: unknown): value is Role
{
	return ROLES.includes(value as Role);
}

export interface Actor
{
	id: number;
	rol: Role;
	parroquia_id: number | null;
	principal: boolean;
}

export interface TargetUser
{
	id?: number;
	rol: Role;
	parroquia_id: number | null;
	principal?: boolean;
}

export function role_parish_error(target: TargetUser): string | null
{
	if (target.rol === 'admin_general' && target.parroquia_id !== null)
		return 'Un administrador general no pertenece a ninguna parroquia.';

	if (target.rol !== 'admin_general' && target.parroquia_id === null)
		return 'Debe seleccionar una parroquia.';

	return null;
}

function parish_admin_reason(actor: Actor, target: TargetUser, action: 'crear' | 'modificar'): string | null
{
	if (target.parroquia_id !== actor.parroquia_id)
		return `Solo puede ${action} cuentas de su propia parroquia.`;

	if (target.rol === 'usuario')
		return null;

	if (target.rol === 'admin_parroquia' && actor.principal)
		return null;

	if (target.rol === 'admin_parroquia')
		return `Solo el administrador principal de la parroquia puede ${action} a otros administradores.`;

	return 'El administrador de una parroquia no gestiona administradores generales.';
}

export function cannot_create(actor: Actor, target: TargetUser): string | null
{
	if (actor.rol === 'admin_general')
	{
		if (target.rol === 'admin_general' && !actor.principal)
			return 'Solo el administrador principal puede crear administradores generales.';

		return null;
	}

	if (actor.rol === 'admin_parroquia')
		return parish_admin_reason(actor, target, 'crear');

	return 'No tiene permiso para gestionar usuarios.';
}

export function cannot_modify(actor: Actor, target: TargetUser): string | null
{
	if (target.id === actor.id)
		return null;

	if (actor.rol === 'admin_general')
	{
		if (target.rol === 'admin_general' && !actor.principal)
			return 'Solo el administrador principal puede modificar a otros administradores generales.';

		return null;
	}

	if (actor.rol === 'admin_parroquia')
		return parish_admin_reason(actor, target, 'modificar');

	return 'No tiene permiso para gestionar usuarios.';
}

export function cannot_disable(target: TargetUser): string | null
{
	if (target.principal)
		return 'No se puede deshabilitar al administrador principal: primero pase la marca de principal a otro administrador.';

	return null;
}

export function cannot_make_principal(actor: Actor, target: TargetUser): string | null
{
	if (target.principal)
		return 'Esta cuenta ya es la principal.';

	if (target.rol === 'admin_general')
	{
		if (actor.rol === 'admin_general' && actor.principal)
			return null;

		return 'Solo el administrador principal puede pasar su marca a otro administrador general.';
	}

	if (target.rol !== 'admin_parroquia')
		return 'La marca de principal solo se pasa a un administrador.';

	if (actor.rol === 'admin_general')
		return null;

	if (actor.rol === 'admin_parroquia' && actor.principal && actor.parroquia_id === target.parroquia_id)
		return null;

	return 'Solo el administrador principal de la parroquia, o un administrador general, puede pasar la marca.';
}

export function can_manage_users(role: Role): boolean
{
	return role === 'admin_general' || role === 'admin_parroquia';
}
