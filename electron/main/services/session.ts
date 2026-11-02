import { OFFLINE_TOKEN } from '../../shared';
import { getLocalDb, localDatabaseNeedsRecovery, recoverLocalDb, uploadCurrentKeyCopy } from '../localDb';
import { ServiceError, type Session } from './common';
import { saveCredential, verifyOffline } from './credentials';
import { isConnectivityError, remoteRequest } from './remote';
import { readQueueSummary, refreshReference, resolveConflict, runSync, setSyncValue, type ConflictChoice } from './syncEngine';
import type { SyncEntity } from './syncQueue';

const LOGIN_TIMEOUT_MS = 10_000;
const SYNC_INTERVAL_MS = 5 * 60 * 1000;

interface LoginResponse {
  token: string;
  usuario: {
    id: number;
    nombreCompleto: string;
    rol: Session['rol'];
    parroquiaId: number | null;
    parroquiaNombre: string | null;
  };
}

export type ConnectionMode = 'en-linea' | 'sin-conexion' | 'requiere-login' | 'error';

let session: Session | null = null;
let credentials: { username: string; password: string } | null = null;
let mode: ConnectionMode = 'sin-conexion';
let lastError: string | null = null;
let running: Promise<void> | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

export function requireSession(): Session {
  if (!session)
    throw new ServiceError('Sesión no válida.', 401);

  return session;
}

function requestLogin(username: string, password: string): Promise<LoginResponse> {
  return remoteRequest<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: { username, password },
    timeoutMs: LOGIN_TIMEOUT_MS,
  });
}

function startSession(next: Session, username: string, password: string): void {
  session = next;
  credentials = { username, password };
  timer ??= setInterval(() => void syncNow(), SYNC_INTERVAL_MS);
}

async function loginOnline(response: LoginResponse, username: string, password: string): Promise<LoginResponse> {
  const { token, usuario } = response;
  if (localDatabaseNeedsRecovery())
    await recoverLocalDb(remoteRequest, token);

  const db = getLocalDb();

  try {
    await refreshReference(db, remoteRequest, token);
  } catch (error) {
    // Sin su propio usuario en la base local no se puede registrar nada a su nombre.
    if (!db.prepare('SELECT 1 FROM usuarios WHERE id = ?').get(usuario.id)) throw error;
  }

  await saveCredential(db, usuario.id, password);
  startSession({ usuarioId: usuario.id, rol: usuario.rol, parroquiaId: usuario.parroquiaId, token }, username, password);
  mode = 'en-linea';
  await syncNow();
  return response;
}

async function loginOffline(username: string, password: string): Promise<LoginResponse> {
  const result = await verifyOffline(getLocalDb(), username, password);
  if (!result.ok) {
    throw new ServiceError(
      result.reason === 'sin-credencial'
        ? 'Sin conexión: este usuario debe iniciar sesión con internet la primera vez en esta PC.'
        : 'Usuario o contraseña incorrectos.',
      401,
    );
  }

  const { usuario } = result;
  startSession({ usuarioId: usuario.id, rol: usuario.rol, parroquiaId: usuario.parroquiaId, token: '' }, username, password);
  mode = 'sin-conexion';
  return { token: OFFLINE_TOKEN, usuario };
}

export async function login(payload: { username: string; password: string }): Promise<LoginResponse> {
  const { username, password } = payload;
  let response: LoginResponse;
  try {
    response = await requestLogin(username, password);
  } catch (error) {
    if (isConnectivityError(error))
        return loginOffline(username, password);
    
    throw error;
  }
  return loginOnline(response, username, password);
}

/** Devuelve un token válido o null. Actualiza el estado de conexión. */
async function renewToken(): Promise<string | null> {
  if (!session || !credentials) return null;
  try {
    const { token, usuario } = await requestLogin(credentials.username, credentials.password);
    session.token = token;
    session.rol = usuario.rol;
    session.parroquiaId = usuario.parroquiaId;
    return token;
  } catch (error) {
    session.token = '';
    if (isConnectivityError(error)) {
      mode = 'sin-conexion';
      return null;
    }
    mode = 'requiere-login';
    lastError = 'La contraseña cambió o la cuenta se desactivó. Inicie sesión de nuevo para sincronizar.';
    return null;
  }
}

async function runWithToken(action: (token: string) => Promise<void>): Promise<void> {
  const token = session?.token || (await renewToken());
  if (!token) return;
  try {
    await action(token);
  } catch (error) {
    if (!(error instanceof ServiceError && error.status === 401)) throw error;
    // El token venció: venció la jornada de 8 horas, no la sesión de la PC.
    const renewed = await renewToken();
    if (renewed) await action(renewed);
  }
}

async function performSync(): Promise<void> {
  lastError = null;
  try {
    let completed = false;
    await runWithToken(async (token) => {
      const db = getLocalDb();
      await runSync(db, remoteRequest, token);
      completed = true;
      await uploadCurrentKeyCopy(remoteRequest, token, session?.parroquiaId ?? null).catch((error) => {
        console.error('No se pudo subir la copia de la clave:', error);
      });
    });
    if (completed) mode = 'en-linea';
  } catch (error) {
    if (isConnectivityError(error)) {
      mode = 'sin-conexion';
    } else {
      console.error('Falló la sincronización:', error);
      mode = 'error';
      lastError = error instanceof ServiceError ? error.message : 'Ocurrió un error al sincronizar.';
    }
  }
}

/** Nunca falla: lo que no se pudo subir sigue en la cola y el estado queda en getSyncStatus. */
export function syncNow(): Promise<void> {
  if (!session) return Promise.resolve();
  running ??= performSync().finally(() => {
    running = null;
  });
  return running;
}

export function getSyncStatus() {
  requireSession();
  return {
    ...readQueueSummary(getLocalDb()),
    modo: mode,
    enCurso: running !== null,
    mensaje: lastError,
    token: session?.token || OFFLINE_TOKEN,
  };
}

export async function resolveSyncConflict(entidad: SyncEntity, clientId: string, choice: ConflictChoice): Promise<void> {
  requireSession();
  let done = false;
  await runWithToken(async (token) => {
    await resolveConflict(getLocalDb(), remoteRequest, token, entidad, clientId, choice);
    done = true;
  });
  if (!done) throw new ServiceError('Se necesita conexión para resolver el conflicto.', 0);
  await syncNow();
}

export function dismissSyncNotice(): void {
  requireSession();
  setSyncValue(getLocalDb(), 'aviso', null);
}

/** Al cerrar la app: intenta subir lo pendiente sin retener el cierre más de unos segundos. */
export async function syncBeforeQuit(limitMs: number): Promise<void> {
  if (!session) return;
  const { pendientes } = readQueueSummary(getLocalDb());
  if (pendientes === 0) return;
  await Promise.race([syncNow(), new Promise((resolve) => setTimeout(resolve, limitMs))]);
}

/**
 * Vuelve al estado previo al login: no sincroniza ni toca la base local. Lo pendiente sigue en la
 * cola, y la verificación guardada permite volver a entrar sin internet.
 */
export function logout(): void {
  stopPeriodicSync();
  session = null;
  credentials = null;
  mode = 'sin-conexion';
  lastError = null;
}

export function stopPeriodicSync(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
