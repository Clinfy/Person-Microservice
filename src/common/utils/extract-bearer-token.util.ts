import { Request } from 'express';
import { AuthErrorCodes, AuthException } from 'src/common/guards/auth.exception';

export function extractAuthToken(request: Request): string {
  const cookie = request.cookies?.['auth_token'];
  if (cookie) return cookie;

  const authorization = request.headers['authorization'];
  if (authorization?.startsWith('Bearer ')) {
    return authorization.slice(7);
  }

  throw new AuthException(
    'Authentication cookie is missing, expired, or invalid.',
    AuthErrorCodes.AUTH_COOKIE_EXPIRED_INVALID,
    401,
  );
}
