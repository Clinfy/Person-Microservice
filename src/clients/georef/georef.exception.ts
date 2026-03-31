import { HttpStatus } from '@nestjs/common';
import { BaseServiceException } from 'src/common/exceptions/base-service.exception';

export enum GeorefErrorCodes {
  ADDRESS_NOT_FOUND = 'ADDRESS_NOT_FOUND',
  ADDRESS_FORMAT_ERROR = 'ADDRESS_FORMAT_ERROR',
  ADDRESS_NOT_EXACTLY_MATCHED = 'ADDRESS_NOT_EXACTLY_MATCHED',
}

export class GeorefException extends BaseServiceException {
  constructor(message: string, errorCode: GeorefErrorCodes, status: HttpStatus, cause?: Error) {
    super(message, errorCode, status, cause);
  }
}
