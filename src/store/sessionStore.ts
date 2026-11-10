import { create } from 'zustand';
import type { Role, UserParish } from '../../shared/sync';

export type Rol = Role;

interface SessionState {
  isAuthenticated: boolean;
  token: string | null;
  usuarioId: number | null;
  usuarioNombre: string | null;
  rol: Rol | null;
  parroquiaId: number | null;
  parroquiaActivaId: number | null;
  parroquiaActivaNombre: string | null;
  misParroquias: UserParish[];

  setSession: (data: {
    token: string;
    usuarioId: number;
    usuarioNombre: string;
    rol: Rol;
    parroquiaId: number | null;
    parroquiaActivaId: number;
    parroquiaActivaNombre: string;
    misParroquias: UserParish[];
  }) => void;

  setParroquiaActiva: (id: number, nombre: string) => void;

  setParroquiaTrabajo: (id: number, rol: Rol) => void;

  setToken: (token: string) => void;

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
  misParroquias: [],

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
      misParroquias: data.misParroquias,
    }),

  setParroquiaActiva: (id, nombre) =>
    set({ parroquiaActivaId: id, parroquiaActivaNombre: nombre }),

  setParroquiaTrabajo: (id, rol) => set({ parroquiaId: id, rol }),

  setToken: (token) => set({ token }),

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
      misParroquias: [],
    }),
}));