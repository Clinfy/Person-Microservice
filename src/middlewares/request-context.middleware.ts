import { HttpException, Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { RequestContextService } from 'src/common/context/request-context.service';
import { isAxiosError } from 'axios';
import { REQUEST_CONTEXT_AUTH_ERROR_KEY } from 'src/common/context/request-context.constants';
import { AuthClientService } from 'src/clients/auth/auth-client.service';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(
    private readonly contextService: RequestContextService,
    private readonly authClientService: AuthClientService,
  ) {}

  use(req: Request, _res: Response, next: NextFunction) {
    this.contextService.start(async () => {
      const authHeader = req.headers['authorization'] ?? req.headers['Authorization'];
      if (!authHeader || (typeof authHeader === 'string' && authHeader.trim().length === 0)) {
        next();
        return;
      }

      try {
        const user = await this.authClientService.getMe(req);
        this.contextService.setUser(user);
        delete (req as any)[REQUEST_CONTEXT_AUTH_ERROR_KEY];
        next();
      } catch (error) {
        const unauthorizedError = this.mapUnauthorizedError(error);
        if (unauthorizedError) {
          (req as any)[REQUEST_CONTEXT_AUTH_ERROR_KEY] = unauthorizedError;
          next();
          return;
        }
        next(error);
      }
    });
  }

  private mapUnauthorizedError(error: unknown): UnauthorizedException | null {
    if (error instanceof UnauthorizedException) return error;
    if (error instanceof HttpException && error.getStatus() === 401) {
      return new UnauthorizedException(error.getResponse());
    }
    if (isAxiosError(error) && error.response?.status === 401) {
      const message = typeof error.response.data === 'string' ? error.response.data : 'Invalid authorization token';
      return new UnauthorizedException(message);
    }
    return null;
  }
}
