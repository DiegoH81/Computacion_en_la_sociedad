import { create } from 'zustand';
import type { SyncStatus } from '../services/SyncService';

interface SyncState {
  status: SyncStatus | null;
  setStatus: (status: SyncStatus | null) => void;
}

/** Compartido para que el indicador de la cabecera y la pantalla de sincronización nunca difieran. */
export const useSyncStore = create<SyncState>((set) => ({
  status: null,
  setStatus: (status) => set({ status }),
}));
