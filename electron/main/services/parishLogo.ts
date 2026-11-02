import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ServiceError, type Session } from './common';

// Unos 300 KB de imagen. Sin SVG: puede contener código y solo se necesitan imágenes simples.
const MAX_LOGO_LENGTH = 400_000;
const LOGO_FORMAT = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

const logoFile = (userDataDir: string, parroquiaId: number) =>
  path.join(userDataDir, 'logos', `parroquia-${parroquiaId}.txt`);

/**
 * El logo se guarda solo en esta PC, fuera de la base local: así no se sincroniza
 * y sigue disponible si la base se reconstruye desde el servidor.
 */
export function readParishLogo(userDataDir: string, parroquiaId: number): string | null {
  try {
    return readFileSync(logoFile(userDataDir, parroquiaId), 'utf8');
  } catch {
    return null;
  }
}

export function saveParishLogo(userDataDir: string, session: Session, parroquiaId: number, logo: unknown): void {
  if (session.rol !== 'admin' && session.parroquiaId !== parroquiaId) {
    throw new ServiceError('Solo puede cambiar el logo de su propia parroquia.', 403);
  }

  const file = logoFile(userDataDir, parroquiaId);
  if (logo === null) {
    rmSync(file, { force: true });
    return;
  }
  if (typeof logo !== 'string' || logo.length > MAX_LOGO_LENGTH || !LOGO_FORMAT.test(logo)) {
    throw new ServiceError('El logo debe ser una imagen PNG, JPG o WEBP de hasta 300 KB.', 400);
  }

  mkdirSync(path.dirname(file), { recursive: true });
  // Con el archivo temporal, un corte de luz no deja un logo a medio escribir.
  const temporary = `${file}.tmp`;
  writeFileSync(temporary, logo, 'utf8');
  renameSync(temporary, file);
}
