import { SignJWT, jwtVerify } from 'jose';

const JWT_ALGORITHM = 'HS256';
const JWT_DURATION = '8h'; // una jornada de trabajo

export type Role = 'admin' | 'usuario_parroquia';

// Lo que guarda el token: quién es el usuario y de qué parroquia.
// Los nombres de los campos no se cambian porque la app de escritorio ya los usa.
export interface TokenUser
{
	usuarioId: number;
	rol: Role;
	parroquiaId: number | null;
	[key: string]: unknown; // la librería jose lo pide
}

function secret_bytes(secret: string): Uint8Array
{
	return new TextEncoder().encode(secret);
}

export async function sign_jwt(user: TokenUser, secret: string): Promise<string>
{
	const token = new SignJWT(user)
		.setProtectedHeader({ alg: JWT_ALGORITHM })
		.setIssuedAt()
		.setExpirationTime(JWT_DURATION);

	return token.sign(secret_bytes(secret));
}

// Lanza un error si la firma no es válida o si el token ya venció.
export async function verify_jwt(token: string, secret: string): Promise<TokenUser>
{
	const result = await jwtVerify(token, secret_bytes(secret), { algorithms: [JWT_ALGORITHM] });
	return result.payload as TokenUser;
}
