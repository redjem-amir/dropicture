// dropicture/app/backend/src/guards/scopes.guard.ts
import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedUser } from '../services/auth.service';

export const SCOPES = {
    ACCOUNTS_READ: 'read:accounts',
    ACCOUNTS_WRITE: 'write:accounts',
    ROLES_READ: 'read:roles',
    ROLES_WRITE: 'write:roles',
} as const;

export type Scope = typeof SCOPES[keyof typeof SCOPES];

export const ALL_SCOPES = Object.values(SCOPES) as Scope[];

export const SCOPES_KEY = 'scopes';

export const RequireScopes = (...scopes: Scope[]) =>
    SetMetadata(SCOPES_KEY, scopes);

@Injectable()
export class ScopesGuard implements CanActivate {
    private readonly logger = new Logger(ScopesGuard.name);

    constructor(private readonly reflector: Reflector) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const required = this.reflector.getAllAndOverride<Scope[]>(
            SCOPES_KEY,
            [context.getHandler(), context.getClass()],
        );
        if (!required || required.length === 0) return true;
        const req = context.switchToHttp().getRequest();
        const user = req.user as AuthenticatedUser | undefined;
        if (!user?.sub) {
            throw new ForbiddenException('Missing user');
        }
        const userScopes = new Set((user.scope ?? '').split(' ').filter(Boolean));
        const hasAll = required.every((s) => userScopes.has(s));
        if (!hasAll) {
            this.logger.warn(`insufficient_scope for ${user.sub}: required="${required.join(' ')}", has="${[...userScopes].join(' ')}"`);
            throw new ForbiddenException('insufficient_scope');
        }
        return true;
    }
}