import { HttpStatus } from '@nestjs/common';
import { BaseServiceException } from 'src/common/exceptions/base-service.exception';

export enum PersonErrorCodes {
  PERSON_NOT_FOUND = 'PERSON_NOT_FOUND',
  PERSON_ALREADY_EXISTS = 'PERSON_ALREADY_EXISTS',
}

export class PersonException extends BaseServiceException {
  constructor(message: string, errorCode: PersonErrorCodes, status: HttpStatus, cause?: Error) {
    super(message, errorCode, status, cause);
  }
}
