import { HttpStatus } from '@nestjs/common';
import { BaseServiceException } from 'src/common/exceptions/base-service.exception';

export enum AuthErrorCodes {
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  AUTH_COOKIE_EXPIRED_INVALID = 'AUTH_COOKIE_EXPIRED_INVALID',
  API_KEY_INVALID = 'API_KEY_INVALID',
  API_KEY_HEADER_MISSING = 'API_KEY_HEADER_MISSING',
}

export class AuthException extends BaseServiceException {
  constructor(message: string, errorCode: AuthErrorCodes, status: HttpStatus, cause?: Error) {
    super(message, errorCode, status, cause);
  }
}
