import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { AuthUser } from 'src/clients/auth/auth-client.interface';

export interface RequestContext {
  user: AuthUser | null;
}

@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestContext>();

  run<T>(callback: () => T): T {
    return this.storage.run({ user: null }, callback);
  }

  setUser(user: AuthUser): void {
    const store = this.storage.getStore();
    if (store) {
      store.user = user;
    }
  }

  getCurrentUser(): AuthUser | null {
    return this.storage.getStore()?.user ?? null;
  }
}
