import { HttpStatus } from '@nestjs/common';
import { BaseServiceException } from 'src/common/exceptions/base-service.exception';

export enum GenderErrorCodes {
  GENDER_NOT_FOUND = 'GENDER_NOT_FOUND',
  GENDER_CODE_ALREADY_EXISTS = 'GENDER_CODE_ALREADY_EXISTS',
  GENDER_DISPLAY_NAME_ALREADY_EXISTS = 'GENDER_DISPLAY_NAME_ALREADY_EXISTS',
  GENDER_NOT_DELETED = 'GENDER_NOT_DELETED',
  GENDER_NOT_UPDATED = 'GENDER_NOT_UPDATED',
  GENDER_NOT_CREATED = 'GENDER_NOT_CREATED',
}

export class GenderException extends BaseServiceException {
  constructor(message: string, errorCode: GenderErrorCodes, status: HttpStatus, cause?: Error) {
    super(message, errorCode, status, cause);
  }
}
