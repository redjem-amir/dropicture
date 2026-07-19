// dropicture/apps/saas/backend/src/services/auth.service.ts
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { CookieOptions } from 'express';
import { Account } from '../models/account.entity';
import { RedisService } from './redis.service';

export const AUTH_COOKIES = { SESSION: 'session' } as const;

export const ACCESS_TOKEN_TTL_SECONDS = 5 * 60;
export const IDLE_TIMEOUT_SECONDS = 30 * 60;
export const ABSOLUTE_TIMEOUT_SECONDS = 8 * 60 * 60;
export const REFRESH_GRACE_WINDOW_SECONDS = 30;

const SESSION_SLIDING_WRITE_THROTTLE_SECONDS = 30;
const ROTATE_LOCK_TTL_SECONDS = 5;
const ROTATE_LOCK_WAIT_ATTEMPTS = 6;
const ROTATE_LOCK_WAIT_INTERVAL_MS = 25;
const LAST_SEEN_THROTTLE_MS = 5 * 60 * 1000;

const isProd = process.env.NODE_ENV === 'production';

export const ARGON2_OPTIONS = {
  algorithm: 2,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
};

const API_KEY_BYTES = 24;

export function generateApiKey(): string {
  return `${randomBytes(API_KEY_BYTES).toString('base64url')}`;
}

export const SESSION_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax',
  path: '/',
};

export interface AuthenticatedUser {
  sub: string;
}

export interface SessionContext {
  userAgent?: string;
  ip?: string;
}

export interface SessionRecord {
  nonce: string;
  accountId: string;
  tokenVersion: number;
  startedAt: number;
  lastUsedAt: number;
  absoluteExpiresAt: number;
  accessExpiresAt: number;
  userAgent?: string;
  ip?: string;
}

export interface IssuedSession {
  cookie: string;
  maxAgeSeconds: number;
}

export interface ResolvedSession {
  user: AuthenticatedUser;
  accessExpiresAt: number;
  absoluteExpiresAt: number;
}

function sessionTtl(absoluteExpiresAt: number, now: number): number {
  return Math.max(1, Math.min(IDLE_TIMEOUT_SECONDS, absoluteExpiresAt - now));
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    private readonly redis: RedisService,
  ) { }

  async createSession(
    account: Account,
    ctx: SessionContext = {},
  ): Promise<IssuedSession> {
    const now = Math.floor(Date.now() / 1000);
    const sid = randomBytes(32).toString('base64url');
    const nonce = randomBytes(16).toString('base64url');
    const absoluteExpiresAt = now + ABSOLUTE_TIMEOUT_SECONDS;
    const ttl = sessionTtl(absoluteExpiresAt, now);
    const record: SessionRecord = {
      nonce,
      accountId: account.id,
      tokenVersion: account.tokenVersion,
      startedAt: now,
      lastUsedAt: now,
      absoluteExpiresAt,
      accessExpiresAt: now + ACCESS_TOKEN_TTL_SECONDS,
      userAgent: ctx.userAgent?.slice(0, 200),
      ip: ctx.ip,
    };
    await this.redis.cache.setex(`session:${sid}`, ttl, JSON.stringify(record));
    return { cookie: `${sid}.${nonce}`, maxAgeSeconds: ttl };
  }

  async resolveSession(cookie: string): Promise<ResolvedSession | null> {
    const dot = cookie.indexOf('.');
    if (dot <= 0 || dot === cookie.length - 1) return null;
    const sid = cookie.slice(0, dot);
    const nonce = cookie.slice(dot + 1);
    const now = Math.floor(Date.now() / 1000);
    const raw = await this.redis.cache.get(`session:${sid}`);
    if (!raw) return null;
    let record: SessionRecord;
    try {
      record = JSON.parse(raw) as SessionRecord;
    } catch {
      await this.redis.cache.del(`session:${sid}`).catch(() => undefined);
      return null;
    }
    if (record.nonce !== nonce) {
      const grace = await this.redis.cache.get(
        `session:rotated:${sid}:${nonce}`,
      );
      if (!grace) {
        this.logger.warn(
          `Session nonce mismatch (possible theft) sid=${sid} account=${record.accountId}`,
        );
        await this.redis.cache.del(`session:${sid}`);
        await this.revokeAllTokens(record.accountId);
        return null;
      }
    }
    if (now >= record.absoluteExpiresAt) {
      await this.redis.cache.del(`session:${sid}`);
      return null;
    }
    const account = await this.accountRepository.findOne({
      where: { id: record.accountId },
      select: { tokenVersion: true },
    });
    if (account && account.tokenVersion !== record.tokenVersion) {
      await this.redis.cache.del(`session:${sid}`);
      return null;
    }
    if (now - record.lastUsedAt > SESSION_SLIDING_WRITE_THROTTLE_SECONDS) {
      record.lastUsedAt = now;
      await this.redis.cache
        .setex(
          `session:${sid}`,
          sessionTtl(record.absoluteExpiresAt, now),
          JSON.stringify(record),
        )
        .catch(() => undefined);
    }
    return {
      user: { sub: record.accountId },
      accessExpiresAt: record.accessExpiresAt,
      absoluteExpiresAt: record.absoluteExpiresAt,
    };
  }

  async rotateSession(
    cookie: string,
    ctx: SessionContext = {},
  ): Promise<IssuedSession> {
    const dot = cookie.indexOf('.');
    if (dot <= 0 || dot === cookie.length - 1)
      throw new UnauthorizedException('Invalid session');
    const sid = cookie.slice(0, dot);
    const nonce = cookie.slice(dot + 1);
    const now = Math.floor(Date.now() / 1000);
    const lock = await this.redis.cache.set(
      `lock:rotate:${sid}`,
      '1',
      'EX',
      ROTATE_LOCK_TTL_SECONDS,
      'NX',
    );
    if (lock !== 'OK') {
      for (let i = 0; i < ROTATE_LOCK_WAIT_ATTEMPTS; i++) {
        await new Promise((r) => setTimeout(r, ROTATE_LOCK_WAIT_INTERVAL_MS));
        const rotated = await this.redis.cache.get(
          `session:rotated:${sid}:${nonce}`,
        );
        if (!rotated) continue;

        let absoluteExpiresAt = now + IDLE_TIMEOUT_SECONDS;
        const raw = await this.redis.cache.get(`session:${sid}`);
        if (raw) {
          try {
            absoluteExpiresAt = (JSON.parse(raw) as SessionRecord)
              .absoluteExpiresAt;
          } catch {
            /* on garde la valeur par défaut */
          }
        }
        return {
          cookie: rotated,
          maxAgeSeconds: sessionTtl(absoluteExpiresAt, now),
        };
      }
      throw new UnauthorizedException('Rotation in progress');
    }
    try {
      const raw = await this.redis.cache.get(`session:${sid}`);
      if (!raw) throw new UnauthorizedException('Session expired (idle)');
      let record: SessionRecord;
      try {
        record = JSON.parse(raw) as SessionRecord;
      } catch {
        await this.redis.cache.del(`session:${sid}`);
        throw new UnauthorizedException('Corrupt session');
      }
      if (record.nonce !== nonce) {
        const rotated = await this.redis.cache.get(
          `session:rotated:${sid}:${nonce}`,
        );
        if (rotated) {
          return {
            cookie: rotated,
            maxAgeSeconds: sessionTtl(record.absoluteExpiresAt, now),
          };
        }
        this.logger.warn(
          `Refresh reuse detected sid=${sid} account=${record.accountId}`,
        );
        await this.redis.cache.del(`session:${sid}`);
        await this.revokeAllTokens(record.accountId);
        throw new UnauthorizedException('Refresh token reuse detected');
      }
      if (now >= record.absoluteExpiresAt) {
        await this.redis.cache.del(`session:${sid}`);
        throw new UnauthorizedException('Session absolute expired');
      }
      const account = await this.accountRepository.findOne({
        where: { id: record.accountId },
      });
      if (!account) throw new UnauthorizedException('Account not found');
      if (account.tokenVersion !== record.tokenVersion) {
        await this.redis.cache.del(`session:${sid}`);
        throw new UnauthorizedException('Token revoked');
      }
      const oldNonce = record.nonce;
      record.nonce = randomBytes(16).toString('base64url');
      record.lastUsedAt = now;
      record.accessExpiresAt = now + ACCESS_TOKEN_TTL_SECONDS;
      if (ctx.userAgent) record.userAgent = ctx.userAgent.slice(0, 200);
      if (ctx.ip) record.ip = ctx.ip;
      const newCookie = `${sid}.${record.nonce}`;
      const ttl = sessionTtl(record.absoluteExpiresAt, now);
      await this.redis.cache
        .pipeline()
        .setex(`session:${sid}`, ttl, JSON.stringify(record))
        .setex(
          `session:rotated:${sid}:${oldNonce}`,
          REFRESH_GRACE_WINDOW_SECONDS,
          newCookie,
        )
        .exec();
      if (
        !account.lastSeenAt ||
        Date.now() - account.lastSeenAt.getTime() > LAST_SEEN_THROTTLE_MS
      ) {
        this.accountRepository
          .update({ id: account.id }, { lastSeenAt: new Date() })
          .catch(() => undefined);
      }
      return { cookie: newCookie, maxAgeSeconds: ttl };
    } finally {
      await this.redis.cache.del(`lock:rotate:${sid}`).catch(() => undefined);
    }
  }

  async revokeSessionCookie(cookie: string): Promise<void> {
    const dot = cookie.indexOf('.');
    if (dot <= 0) return;
    await this.redis.cache.del(`session:${cookie.slice(0, dot)}`);
  }

  async revokeAllTokens(accountId: string): Promise<void> {
    await this.accountRepository.increment(
      { id: accountId },
      'tokenVersion',
      1,
    );
  }
}
