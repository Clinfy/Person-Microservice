import { HttpStatus } from '@nestjs/common';
import { BaseServiceException } from 'src/common/exceptions/base-service.exception';

export enum PersonErrorCodes {
  PERSON_NOT_FOUND = 'PERSON_NOT_FOUND',
  PERSON_ALREADY_EXISTS = 'PERSON_ALREADY_EXISTS',
  PERSON_CREATION_FAILED = 'PERSON_CREATION_FAILED',
  PERSON_UPDATE_ROLES_FAILED = 'PERSON_UPDATE_ROLES_FAILED',
  REQUEST_BATCH_SIZE_EXCEEDED = 'REQUEST_BATCH_SIZE_EXCEEDED',
}

export class PersonException extends BaseServiceException {
  constructor(message: string, errorCode: PersonErrorCodes, status: HttpStatus, cause?: Error) {
    super(message, errorCode, status, cause);
  }
}
