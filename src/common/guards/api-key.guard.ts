import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { extractApiKey } from 'src/common/utils/extract-api-key.util';
import { AuthErrorCodes, AuthException } from 'src/common/guards/auth.exception';
import { EndpointKey } from 'src/common/decorators/endpoint-key.decorator';
import { Request } from 'express';
import { AuthClientService } from 'src/clients/auth/auth-client.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authClient: AuthClientService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: Request = context.switchToHttp().getRequest();
    const rawApiKey = extractApiKey(request);

    const endpointKey = this.reflector.getAllAndOverride<string>(EndpointKey, [context.getHandler(), context.getClass()]);
    const requiredPermissions = await this.authClient.getEndpointPermissions(endpointKey, request);

    if (!requiredPermissions || requiredPermissions.length === 0) return true;

    const apiCanDo = await Promise.all(
      requiredPermissions.map((permission: string) => this.authClient.apiKeyCanDo(permission, rawApiKey, request)),
    );

    if (!apiCanDo.some(Boolean)) {
      throw new AuthException(
        'The provided API key does not have permission to access this resource.',
        AuthErrorCodes.INSUFFICIENT_PERMISSIONS,
        HttpStatus.UNAUTHORIZED,
      );
    }

    return apiCanDo.some(Boolean);
  }
}
