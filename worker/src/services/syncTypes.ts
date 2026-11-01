export type TipoSacramento = 'bautismo' | 'confirmacion' | 'matrimonio';
export type EntidadSync = TipoSacramento | 'ministro';

export interface PersonaSync {
  client_id: string;
  dni: string | null;
  nombres: string;
  apellido_paterno: string;
  apellido_materno: string;
  fecha_nacimiento: string | null;
  edad: number | null;
  lugar_nacimiento: string | null;
  padre: string | null;
  madre: string | null;
}

export interface CambioSync {
  client_id: string;
  persona_client_id: string;
  usuario_id: number;
  campo_cambio: string;
  valor_anterior: string | null;
  valor_nuevo: string | null;
  fecha_cambio: string;
}

export interface PartidaSync {
  tipo: TipoSacramento;
  client_id: string;
  parroquia_id: number;
  ministro_client_id: string | null;
  libro: string;
  folio: string;
  numero: string;
  fecha_emision: string;
  fecha_evento: string | null;
  anotaciones: string | null;
  estado: 'vigente' | 'anulado';
  anulado_por_usuario_id: number | null;
  anulado_en: string | null;
  motivo_anulacion: string | null;
  version?: number;
  created_at?: string;
  updated_at?: string;
  personas: PersonaSync[];
  detalle: Record<string, string | null>;
  cambios: CambioSync[];
}

export interface MinistroSync {
  client_id: string;
  parroquia_id: number;
  titulo: string | null;
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string;
  activo: number;
  version?: number;
  updated_at?: string;
}

export interface CambioEntrante {
  entidad: EntidadSync;
  client_id: string;
  version_base: number | null;
  cola_id: string;
  datos: PartidaSync | MinistroSync;
}

export type ResultadoSync =
  | { entidad: EntidadSync; client_id: string; estado: 'aplicado'; version: number }
  | { entidad: EntidadSync; client_id: string; estado: 'conflicto'; version: number; motivo: string }
  | { entidad: EntidadSync; client_id: string; estado: 'rechazado'; motivo: string };

export interface Autor {
  usuarioId: number;
  rol: 'admin' | 'usuario_parroquia';
  parroquiaId: number | null;
}
