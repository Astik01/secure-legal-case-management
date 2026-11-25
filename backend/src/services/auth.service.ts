import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { Role } from '../utils/constants';

const BCRYPT_ROUNDS = env.isTest ? 4 : 12;
// Used to keep login timing similar when the email does not exist.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', BCRYPT_ROUNDS);

export const hashPassword = (plain: string) => bcrypt.hash(plain, BCRYPT_ROUNDS);
export const verifyPassword = (plain: string, hash?: string) => bcrypt.compare(plain, hash ?? DUMMY_HASH);

export interface TokenPayload {
  sub: string;
  role: Role;
}

export function signToken(userId: string, role: Role): string {
  const options: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'], algorithm: 'HS256' };
  return jwt.sign({ sub: userId, role } satisfies TokenPayload, env.JWT_SECRET, options);
}

export function verifyToken(token: string): TokenPayload & { exp: number } {
  return jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as TokenPayload & { exp: number };
}

export const COOKIE_NAME = 'token';

export function cookieOptions(token: string) {
  const exp = (jwt.decode(token) as { exp?: number } | null)?.exp;
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: env.isProd,
    path: '/',
    maxAge: exp ? exp * 1000 - Date.now() : undefined,
  };
}
