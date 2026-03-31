import { HttpStatus } from '@nestjs/common';
import { BaseServiceException } from 'src/common/exceptions/base-service.exception';

export enum GenderErrorCodes {
  GENDER_NOT_FOUND = 'ROLE_NOT_FOUND',
  GENDER_ALREADY_EXISTS = 'ROLE_ALREADY_EXISTS',
  GENDER_ASSIGN_ERROR = 'ROLE_PERMISSION_ASSIGN_ERROR',
  GENDER_NOT_DELETED = 'ROLE_NOT_DELETED',
  GENDER_NOT_UPDATED = 'ROLE_NOT_UPDATED',
  GENDER_NOT_CREATED = 'ROLE_NOT_CREATED',
}

export class GenderException extends BaseServiceException {
  constructor(message: string, errorCode: GenderErrorCodes, status: HttpStatus, cause?: Error) {
    super(message, errorCode, status, cause);
  }
}
