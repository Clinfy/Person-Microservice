import { HttpStatus } from '@nestjs/common';
import { BaseServiceException } from 'src/common/exceptions/base-service.exception';

export enum GeoapifyErrorCodes {
  UNTRUSTED_LOCATION = 'UNTRUSTED_LOCATION',
  ADDRESS_NOT_FOUND = 'ADDRESS_NOT_FOUND',
}

export class GeoapifyException extends BaseServiceException {
  constructor(message: string, errorCode: GeoapifyErrorCodes, status: HttpStatus, cause?: Error) {
    super(message, errorCode, status, cause);
  }
}
