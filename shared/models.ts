import type { Role, SacramentType } from './sync';

export interface User
{
	id?: number;
	username: string;
	rol: Role;
	parroquia_id: number | null;
	nombre: string;
	apellido_paterno: string;
	apellido_materno: string;
	activo?: number;
	principal?: number;
	parroquia_nombre?: string | null;
	password?: string;
	parroquia_nueva?: string;
}

export interface Parish
{
	id: number;
	nombre: string;
	ubicacion: string | null;
	activa: number;
}

export interface Minister
{
	id?: number;
	client_id?: string;
	parroquia_id?: number;
	titulo: string | null;
	nombre: string;
	apellido_paterno: string;
	apellido_materno: string;
	activo?: number;
	version?: number;
	created_at?: string;
	updated_at?: string;
	parroquia?: Parish;
}

export interface PersonChange
{
	id?: number;
	client_id?: string;
	persona_id?: number;
	sacramento_id?: number | null;
	usuario_id?: number;
	campo_cambio: 'nombres' | 'apellido_paterno' | 'apellido_materno';
	valor_anterior?: string | null;
	valor_nuevo: string | null;
	fecha_cambio?: string;
}


export interface Person
{
	id?: number;
	client_id?: string;
	parroquia_id?: number;
	dni: string | null;
	nombres: string;
	apellido_paterno: string;
	apellido_materno: string;
	fecha_nacimiento: string | null;
	edad: number | null;
	lugar_nacimiento: string | null;
	padre: string | null;
	madre: string | null;
	version?: number;
	created_at?: string;
	updated_at?: string;
	cambios: PersonChange[];
}

export interface Sacrament
{
	id?: number;
	client_id?: string;
	tipo: SacramentType;
	parroquia_id?: number;
	ministro_id: number | null;
	libro: string;
	folio: string;
	numero: string;
	fecha_emision: string;
	fecha_evento: string | null;
	anotaciones: string | null;
	estado?: 'vigente' | 'anulado';
	anulado_por_usuario_id?: number | null;
	anulado_en?: string | null;
	motivo_anulacion?: string | null;
	version?: number;
	created_at?: string;
	updated_at?: string;
	parroquia?: Parish;         // al leer
	ministro?: Minister | null; // al leer: el celebrante, si tiene
}


export interface Baptism
{
	sacramento: Sacrament;
	persona: Person;
	padrino_1: string | null;
	padrino_2: string | null;
}

export type Confirmation = Baptism;


export interface Marriage
{
	sacramento: Sacrament;
	conyuge_1: Person;
	conyuge_2: Person;
	lugar: string | null;
	testigo_1: string | null;
	testigo_2: string | null;
	testigo_3: string | null;
	testigo_4: string | null;
	conyuge_1_bautismo_parroquia: string | null;
	conyuge_1_bautismo_fecha: string | null;
	conyuge_2_bautismo_parroquia: string | null;
	conyuge_2_bautismo_fecha: string | null;
}

export type SacramentRecord = Baptism | Marriage;

// Search Filters

export type NameColumn = 'nombres' | 'apellido_paterno' | 'apellido_materno';

export interface SearchFilters
{
	nombres?: string;
	apellido_paterno?: string;
	apellido_materno?: string;
	orden?: NameColumn;
	direccion?: 'asc' | 'desc';
	pagina?: number;
	parroquia_id?: number;
}

export interface SearchPage<T>
{
	resultados: T[];
	total_paginas: number;
}

// Duplicates in search
export type DuplicateQuery = Pick<Person, 'dni' | 'nombres' | 'apellido_paterno' | 'apellido_materno' | 'fecha_nacimiento' | 'padre' | 'madre'> & { para: string };

export interface DuplicateMatch
{
	sacramento_id: number;
	para: string;
	nivel: 'alta' | 'posible';
	porcentaje: number;
	coincide: string[];
	nombre_completo: string;
	parroquia_nombre: string;
	libro: string;
	folio: string;
	numero: string;
}

export type IndexEntry = Pick<Person, 'nombres' | 'apellido_paterno' | 'apellido_materno'> & Pick<Sacrament, 'libro' | 'folio' | 'numero'>;
