import { SignJWT, jwtVerify } from 'jose';

const JWT_ALGORITHM = 'HS256';
const JWT_EXPIRATION = '8h'; // acordado: jornada laboral, sin persistencia entre reinicios

export interface JwtPayload {
  usuarioId: number;
  rol: 'admin' | 'usuario_parroquia';
  parroquiaId: number | null;
  [key: string]: unknown; // requerido por la firma de tipos de jose (JWTPayload extiende esto)
}

export async function signJwt(payload: JwtPayload, secret: string): Promise<string> {
  const secretKey = new TextEncoder().encode(secret);

  return new SignJWT(payload)
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRATION)
    .sign(secretKey);
}

export async function verifyJwt(token: string, secret: string): Promise<JwtPayload> {
  const secretKey = new TextEncoder().encode(secret);
  const { payload } = await jwtVerify(token, secretKey, { algorithms: [JWT_ALGORITHM] });
  return payload as JwtPayload;
}