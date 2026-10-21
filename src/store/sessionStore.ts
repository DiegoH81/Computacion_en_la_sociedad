import { create } from 'zustand';

export type Rol = 'admin' | 'usuario_parroquia';

interface SessionState {
  isAuthenticated: boolean;
  token: string | null;
  usuarioId: number | null;
  usuarioNombre: string | null;
  rol: Rol | null;
  parroquiaId: number | null; // parroquia de pertenencia del usuario (inmutable en la sesión)
  parroquiaActivaId: number | null; // parroquia que se está viendo (mutable, solo UI)
  parroquiaActivaNombre: string | null;

  setSession: (data: {
    token: string;
    usuarioId: number;
    usuarioNombre: string;
    rol: Rol;
    parroquiaId: number | null;
    parroquiaActivaId: number;
    parroquiaActivaNombre: string;
  }) => void;

  setParroquiaActiva: (id: number, nombre: string) => void;

  clearSession: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  isAuthenticated: false,
  token: null,
  usuarioId: null,
  usuarioNombre: null,
  rol: null,
  parroquiaId: null,
  parroquiaActivaId: null,
  parroquiaActivaNombre: null,

  setSession: (data) =>
    set({
      isAuthenticated: true,
      token: data.token,
      usuarioId: data.usuarioId,
      usuarioNombre: data.usuarioNombre,
      rol: data.rol,
      parroquiaId: data.parroquiaId,
      parroquiaActivaId: data.parroquiaActivaId,
      parroquiaActivaNombre: data.parroquiaActivaNombre,
    }),

  setParroquiaActiva: (id, nombre) =>
    set({ parroquiaActivaId: id, parroquiaActivaNombre: nombre }),

  clearSession: () =>
    set({
      isAuthenticated: false,
      token: null,
      usuarioId: null,
      usuarioNombre: null,
      rol: null,
      parroquiaId: null,
      parroquiaActivaId: null,
      parroquiaActivaNombre: null,
    }),
}));