import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { AuthUser } from 'src/clients/auth/auth-client.interface';

export interface RequestContext {
  user: AuthUser | null;
}

@Injectable()
export class RequestContextService {
  private readonly asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

  start<T>(callback: () => T): T {
    return this.asyncLocalStorage.run({ user: null }, callback);
  }

  private getContext(): RequestContext | null {
    return this.asyncLocalStorage.getStore() ?? null;
  }

  setUser(user: AuthUser): void {
    const context = this.getContext();
    if (!context) {
      throw new Error('RequestContext not initialized');
    }
    context.user = user;
  }

  getCurrentUser(): AuthUser | null {
    return this.getContext()?.user ?? null;
  }
}
