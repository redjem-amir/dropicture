// dropicture/app/backend/src/services/auth.service.ts
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { CookieOptions } from 'express';
import { Account, AccountStatus } from '../models/account.model';
import { RedisService } from './redis.service';

export const AUTH_COOKIES = { SESSION: 'session' } as const;

export const ACCESS_TOKEN_TTL_SECONDS = 5 * 60;
export const IDLE_TIMEOUT_SECONDS = 30 * 60;
export const ABSOLUTE_TIMEOUT_SECONDS = 8 * 60 * 60;
export const REFRESH_GRACE_WINDOW_SECONDS = 30;
export const SESSION_TTL_SECONDS = IDLE_TIMEOUT_SECONDS;

const SESSION_SLIDING_WRITE_THROTTLE_SECONDS = 30;
const ROTATE_LOCK_TTL_SECONDS = 5;
const ROTATE_LOCK_WAIT_ATTEMPTS = 6;
const ROTATE_LOCK_WAIT_INTERVAL_MS = 25;

const isProd = process.env.NODE_ENV === 'production';

export const ARGON2_OPTIONS = {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
    outputLen: 32,
};

export const SESSION_COOKIE_OPTIONS: CookieOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
};

export interface AuthenticatedUser {
    sub: string;
    scope: string;
    roles: string[];
}

export interface SessionRecord {
    sid: string;
    nonce: string;
    accountId: string;
    scope: string;
    roles: string[];
    tokenVersion: number;
    startedAt: number;
    lastUsedAt: number;
    absoluteExpiresAt: number;
    accessExpiresAt: number;
    userAgent?: string;
    ipHash?: string;
    ipAddress?: string;
    firstname?: string;
    lastname?: string;
}

export interface SessionContext {
    userAgent?: string;
    ip?: string;
}

export interface IssuedSession {
    cookie: string;
    maxAgeSeconds: number;
    firstname?: string;
    lastname?: string;
}

export interface ResolvedSession {
    user: AuthenticatedUser;
    accessExpiresAt: number;
    absoluteExpiresAt: number;
}

function mergeScopes(account: Account): string[] {
    const set = new Set<string>();
    for (const role of account.roles ?? []) {
        for (const s of role.scopes ?? []) {
            set.add(s);
        }
    }
    return Array.from(set);
}

function roleNames(account: Account): string[] {
    return (account.roles ?? []).map((r) => r.name);
}

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        @InjectRepository(Account)
        private readonly accountRepository: Repository<Account>,
        private readonly redisService: RedisService,
    ) { }

    private hashIp(ip: string): string {
        return createHash('sha256').update(ip).digest('hex').slice(0, 16);
    }

    private nowSec(): number {
        return Math.floor(Date.now() / 1000);
    }

    private computeIdleTtl(absoluteExpiresAt: number): number {
        return Math.max(1, Math.min(IDLE_TIMEOUT_SECONDS, absoluteExpiresAt - this.nowSec()));
    }

    private accountSessionsKey(accountId: string): string {
        return `account:sessions:${accountId}`;
    }

    private sessionKey(sid: string): string {
        return `session:${sid}`;
    }

    private rotatedKey(sid: string, nonce: string): string {
        return `session:rotated:${sid}:${nonce}`;
    }

    private rotateLockKey(sid: string): string {
        return `lock:rotate:${sid}`;
    }

    private async indexSession(accountId: string, sid: string): Promise<void> {
        const key = this.accountSessionsKey(accountId);
        try {
            await this.redisService.sadd(key, sid);
            await this.redisService.expire(key, ABSOLUTE_TIMEOUT_SECONDS);
        } catch (err) {
            this.logger.error(`indexSession failed: ${err instanceof Error ? err.message : err}`);
        }
    }

    private async unindexSession(accountId: string, sid: string): Promise<void> {
        try {
            await this.redisService.srem(this.accountSessionsKey(accountId), sid);
        } catch (err) {
            this.logger.warn(`unindexSession failed: ${err instanceof Error ? err.message : err}`);
        }
    }

    private buildUser(rec: SessionRecord): AuthenticatedUser {
        return {
            sub: rec.accountId,
            scope: rec.scope ?? '',
            roles: rec.roles ?? [],
        };
    }

    private async writeSession(rec: SessionRecord): Promise<void> {
        const idleTtl = this.computeIdleTtl(rec.absoluteExpiresAt);
        await this.redisService.setex(this.sessionKey(rec.sid), idleTtl, JSON.stringify(rec));
        await this.indexSession(rec.accountId, rec.sid);
    }

    private parseCookie(cookie: string): { sid: string; nonce: string } | null {
        const i = cookie.indexOf('.');
        if (i <= 0 || i === cookie.length - 1) return null;
        return { sid: cookie.slice(0, i), nonce: cookie.slice(i + 1) };
    }

    async createSession(account: Account, ctx: SessionContext = {}): Promise<IssuedSession> {
        const now = this.nowSec();
        const sid = randomBytes(32).toString('base64url');
        const nonce = randomBytes(16).toString('base64url');
        const absoluteExpiresAt = now + ABSOLUTE_TIMEOUT_SECONDS;
        const rec: SessionRecord = {
            sid,
            nonce,
            accountId: account.id,
            scope: mergeScopes(account).join(' '),
            roles: roleNames(account),
            tokenVersion: account.tokenVersion,
            startedAt: now,
            lastUsedAt: now,
            absoluteExpiresAt,
            accessExpiresAt: now + ACCESS_TOKEN_TTL_SECONDS,
            userAgent: ctx.userAgent?.slice(0, 200),
            ipHash: ctx.ip ? this.hashIp(ctx.ip) : undefined,
            ipAddress: ctx.ip ?? undefined,
            firstname: account.firstname,
            lastname: account.lastname,
        };
        await this.writeSession(rec);
        return {
            cookie: `${sid}.${nonce}`,
            maxAgeSeconds: this.computeIdleTtl(absoluteExpiresAt),
            firstname: account.firstname,
            lastname: account.lastname,
        };
    }

    async resolveSession(cookie: string): Promise<ResolvedSession | null> {
        const parsed = this.parseCookie(cookie);
        if (!parsed) return null;
        const raw = await this.redisService.get(this.sessionKey(parsed.sid));
        if (!raw) return null;
        let rec: SessionRecord;
        try {
            rec = JSON.parse(raw);
        } catch {
            await this.redisService.del(this.sessionKey(parsed.sid)).catch(() => undefined);
            return null;
        }
        if (rec.nonce !== parsed.nonce) {
            const grace = await this.redisService.get(this.rotatedKey(parsed.sid, parsed.nonce));
            if (!grace) {
                this.logger.warn(`Session nonce mismatch (possible theft) sid=${parsed.sid} firstname=${rec.firstname ?? '?'} lastname=${rec.lastname ?? '?'}`);
                await this.terminateSession(rec.sid, rec.accountId);
                await this.revokeAllTokens(rec.accountId);
                return null;
            }
        }
        const now = this.nowSec();
        if (now >= rec.absoluteExpiresAt) {
            await this.terminateSession(rec.sid, rec.accountId);
            return null;
        }
        if (now - rec.lastUsedAt > SESSION_SLIDING_WRITE_THROTTLE_SECONDS) {
            rec.lastUsedAt = now;
            await this.writeSession(rec).catch(() => undefined);
        }
        return {
            user: this.buildUser(rec),
            accessExpiresAt: rec.accessExpiresAt,
            absoluteExpiresAt: rec.absoluteExpiresAt,
        };
    }

    async rotateSession(cookie: string, ctx: SessionContext = {}): Promise<IssuedSession> {
        const parsed = this.parseCookie(cookie);
        if (!parsed) throw new UnauthorizedException('Invalid session');
        const lockAcquired = await this.redisService.set(
            this.rotateLockKey(parsed.sid),
            '1',
            'EX',
            ROTATE_LOCK_TTL_SECONDS,
            'NX',
        );
        if (lockAcquired !== 'OK') {
            for (let i = 0; i < ROTATE_LOCK_WAIT_ATTEMPTS; i++) {
                await new Promise(r => setTimeout(r, ROTATE_LOCK_WAIT_INTERVAL_MS));
                const cached = await this.redisService.get(this.rotatedKey(parsed.sid, parsed.nonce));
                if (cached) {
                    const raw = await this.redisService.get(this.sessionKey(parsed.sid));
                    let abs = this.nowSec() + IDLE_TIMEOUT_SECONDS;
                    let firstname: string | undefined;
                    let lastname: string | undefined;
                    if (raw) {
                        try {
                            const prev = JSON.parse(raw) as SessionRecord;
                            abs = prev.absoluteExpiresAt;
                            firstname = prev.firstname;
                            lastname = prev.lastname;
                        } catch { /* défaut */ }
                    }
                    return { cookie: cached, maxAgeSeconds: this.computeIdleTtl(abs), firstname, lastname };
                }
            }
            throw new UnauthorizedException('Rotation in progress');
        }
        try {
            const raw = await this.redisService.get(this.sessionKey(parsed.sid));
            if (!raw) throw new UnauthorizedException('Session expired (idle)');
            let rec: SessionRecord;
            try {
                rec = JSON.parse(raw);
            } catch {
                await this.redisService.del(this.sessionKey(parsed.sid));
                throw new UnauthorizedException('Corrupt session');
            }
            if (rec.nonce !== parsed.nonce) {
                const cached = await this.redisService.get(this.rotatedKey(parsed.sid, parsed.nonce));
                if (cached) {
                    return {
                        cookie: cached,
                        maxAgeSeconds: this.computeIdleTtl(rec.absoluteExpiresAt),
                        firstname: rec.firstname,
                        lastname: rec.lastname,
                    };
                }
                this.logger.warn(`Refresh reuse detected sid=${parsed.sid} firstname=${rec.firstname ?? '?'} lastname=${rec.lastname ?? '?'}`);
                await this.terminateSession(rec.sid, rec.accountId);
                await this.revokeAllTokens(rec.accountId);
                throw new UnauthorizedException('Refresh token reuse detected');
            }
            const now = this.nowSec();
            if (now >= rec.absoluteExpiresAt) {
                await this.terminateSession(rec.sid, rec.accountId);
                throw new UnauthorizedException('Session absolute expired');
            }
            const account = await this.accountRepository.findOne({
                where: { id: rec.accountId },
                relations: { roles: true },
            });
            if (!account) throw new UnauthorizedException('Account not found');
            if (account.status !== AccountStatus.ACTIVE) throw new UnauthorizedException('Account inactive');
            if (account.tokenVersion !== rec.tokenVersion) {
                await this.terminateSession(rec.sid, rec.accountId);
                throw new UnauthorizedException('Token revoked');
            }
            const oldNonce = rec.nonce;
            rec.nonce = randomBytes(16).toString('base64url');
            rec.scope = mergeScopes(account).join(' ');
            rec.roles = roleNames(account);
            rec.firstname = account.firstname;
            rec.lastname = account.lastname;
            rec.lastUsedAt = now;
            rec.accessExpiresAt = now + ACCESS_TOKEN_TTL_SECONDS;
            if (ctx.userAgent) rec.userAgent = ctx.userAgent.slice(0, 200);
            if (ctx.ip) {
                rec.ipHash = this.hashIp(ctx.ip);
                rec.ipAddress = ctx.ip;
            }
            const newCookie = `${rec.sid}.${rec.nonce}`;
            await this.writeSession(rec);
            await this.redisService.setex(
                this.rotatedKey(rec.sid, oldNonce),
                REFRESH_GRACE_WINDOW_SECONDS,
                newCookie,
            );
            if (!account.lastSeenAt || Date.now() - account.lastSeenAt.getTime() > 5 * 60 * 1000) {
                this.accountRepository
                    .update({ id: account.id }, { lastSeenAt: new Date() })
                    .catch(() => undefined);
            }
            return {
                cookie: newCookie,
                maxAgeSeconds: this.computeIdleTtl(rec.absoluteExpiresAt),
                firstname: account.firstname,
                lastname: account.lastname,
            };
        } finally {
            await this.redisService.del(this.rotateLockKey(parsed.sid)).catch(() => undefined);
        }
    }

    async revokeSessionCookie(cookie: string): Promise<{ firstname?: string; lastname?: string }> {
        const parsed = this.parseCookie(cookie);
        if (!parsed) return {};
        const raw = await this.redisService.get(this.sessionKey(parsed.sid)).catch(() => null);
        let accountId: string | undefined;
        let firstname: string | undefined;
        let lastname: string | undefined;
        if (raw) {
            try {
                const rec = JSON.parse(raw) as SessionRecord;
                accountId = rec.accountId;
                firstname = rec.firstname;
                lastname = rec.lastname;
            } catch {
                /* ignore */
            }
        }
        await this.terminateSession(parsed.sid, accountId);
        return { firstname, lastname };
    }

    async terminateSession(sid: string, accountId?: string): Promise<void> {
        if (!accountId) {
            try {
                const raw = await this.redisService.get(this.sessionKey(sid));
                if (raw) accountId = (JSON.parse(raw) as SessionRecord).accountId;
            } catch {
                /* ignore */
            }
        }
        await this.redisService.del(this.sessionKey(sid));
        if (accountId) await this.unindexSession(accountId, sid);
    }

    async revokeAllTokens(accountId: string): Promise<void> {
        await this.accountRepository.increment({ id: accountId }, 'tokenVersion', 1);
    }

    async listAccountSessions(accountId: string): Promise<SessionRecord[]> {
        let sids: string[] = [];
        try {
            sids = await this.redisService.smembers(this.accountSessionsKey(accountId));
        } catch (err) {
            this.logger.error(
                `listAccountSessions: SMEMBERS failed: ${err instanceof Error ? err.message : err}`,
            );
            return [];
        }
        const records: SessionRecord[] = [];
        for (const sid of sids) {
            const raw = await this.redisService.get(this.sessionKey(sid));
            if (!raw) {
                await this.unindexSession(accountId, sid);
                continue;
            }
            try {
                const rec = JSON.parse(raw) as SessionRecord;
                if (rec.accountId === accountId) records.push(rec);
            } catch {
                await this.redisService.del(this.sessionKey(sid)).catch(() => undefined);
                await this.unindexSession(accountId, sid);
            }
        }
        records.sort((a, b) => b.lastUsedAt - a.lastUsedAt);
        return records;
    }

    async revokeAccountSession(accountId: string, sid: string): Promise<boolean> {
        const raw = await this.redisService.get(this.sessionKey(sid));
        if (!raw) {
            await this.unindexSession(accountId, sid);
            return false;
        }
        let rec: SessionRecord;
        try {
            rec = JSON.parse(raw);
        } catch {
            await this.redisService.del(this.sessionKey(sid)).catch(() => undefined);
            await this.unindexSession(accountId, sid);
            return false;
        }
        if (rec.accountId !== accountId) {
            this.logger.warn(
                `revokeAccountSession: account=${accountId} attempted to revoke session of ${rec.accountId}`,
            );
            return false;
        }
        await this.terminateSession(sid, accountId);
        return true;
    }

    async revokeOtherAccountSessions(accountId: string, keepSid: string): Promise<number> {
        const records = await this.listAccountSessions(accountId);
        let revoked = 0;
        for (const rec of records) {
            if (rec.sid === keepSid) continue;
            await this.terminateSession(rec.sid, accountId);
            revoked++;
        }
        return revoked;
    }

    async applyScopesToActiveSessions(accountId: string): Promise<number> {
        const account = await this.accountRepository.findOne({
            where: { id: accountId },
            relations: { roles: true },
        });
        if (!account) return 0;
        const scope = mergeScopes(account).join(' ');
        const roles = roleNames(account);
        let sids: string[] = [];
        try {
            sids = await this.redisService.smembers(this.accountSessionsKey(accountId));
        } catch (err) {
            this.logger.error(
                `applyScopesToActiveSessions: SMEMBERS failed: ${err instanceof Error ? err.message : err}`,
            );
            return 0;
        }
        let updated = 0;
        for (const sid of sids) {
            const raw = await this.redisService.get(this.sessionKey(sid));
            if (!raw) {
                await this.unindexSession(accountId, sid);
                continue;
            }
            let rec: SessionRecord;
            try {
                rec = JSON.parse(raw);
            } catch {
                await this.redisService.del(this.sessionKey(sid)).catch(() => undefined);
                await this.unindexSession(accountId, sid);
                continue;
            }
            if (rec.accountId !== accountId) continue;
            rec.scope = scope;
            rec.roles = roles;
            await this.writeSession(rec).catch(() => undefined);
            updated++;
        }
        return updated;
    }
}