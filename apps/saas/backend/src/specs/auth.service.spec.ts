// dropicture/apps/saas/backend/src/specs/auth.service.spec.ts
import { Logger, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Redis } from 'ioredis';
import RedisMock from 'ioredis-mock';
import type { Repository } from 'typeorm';
import { Account } from '../models/account.entity';
import { ABSOLUTE_TIMEOUT_SECONDS, ACCESS_TOKEN_TTL_SECONDS, AuthService, IDLE_TIMEOUT_SECONDS, REFRESH_GRACE_WINDOW_SECONDS, generateApiKey, type SessionRecord } from '../services/auth.service';
import { RedisService } from '../services/redis.service';

class FakeAccounts {
  readonly rows = new Map<string, Account>();

  seed(overrides: Partial<Account> = {}): Account {
    const account = {
      id: randomUUID(),
      firstname: 'Ada',
      lastname: 'Lovelace',
      username: 'ada_lovelace',
      email: 'ada@example.com',
      password: '$argon2id$fake',
      tokenVersion: 1,
      avatarMediaId: null,
      bio: null,
      apiKey: null,
      apiKeyCreatedAt: null,
      lastSeenAt: null,
      createdAt: new Date(),
      lastUpdate: new Date(),
      ...overrides,
    };
    this.rows.set(account.id, account);
    return { ...account };
  }
  peek(id: string): Account {
    return this.rows.get(id) as Account;
  }
  async findOne({ where }: any) {
    const row = this.match(where)[0];
    return row ? { ...row } : null;
  }
  async update(where: any, patch: any) {
    const rows = this.match(where);
    rows.forEach((row) => this.rows.set(row.id, { ...row, ...patch }));
    return { affected: rows.length };
  }
  async increment(where: any, column: string, by: number) {
    const rows = this.match(where);
    rows.forEach((row) => this.rows.set(row.id, { ...row, [column]: (row as any)[column] + by }));
    return { affected: rows.length };
  }
  private match(where: any): Account[] {
    const criteria = Object.entries(where ?? {});
    if (!criteria.length) return [];
    return [...this.rows.values()].filter((row) => criteria.every(([key, value]) => (row as any)[key] === value));
  }
}

const now = () => Math.floor(Date.now() / 1000);
const split = (cookie: string) => ({
  sid: cookie.split('.')[0],
  nonce: cookie.split('.')[1],
});

describe('AuthService', () => {
  let redis: Redis;
  let accounts: FakeAccounts;
  let service: AuthService;
  let account: Account;
  let warn: jest.SpyInstance;

  const readRecord = async (sid: string): Promise<SessionRecord> => JSON.parse((await redis.get(`session:${sid}`)) as string) as SessionRecord;

  const writeRecord = async (sid: string, patch: Partial<SessionRecord>) => {
    const record = await readRecord(sid);
    await redis.setex(`session:${sid}`, IDLE_TIMEOUT_SECONDS, JSON.stringify({ ...record, ...patch }));
  };

  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    redis = new RedisMock();
    accounts = new FakeAccounts();
    service = new AuthService(accounts as unknown as Repository<Account>, { cache: redis } as unknown as RedisService);
    account = accounts.seed();
  });

  afterEach(() => {
    redis.disconnect();
    jest.restoreAllMocks();
  });

  describe('createSession', () => {
    it('émet un cookie sid.nonce et stocke la session dans Redis', async () => {
      const { cookie, maxAgeSeconds } = await service.createSession(account, {
        userAgent: 'jest',
        ip: '10.0.0.1',
      });
      const { sid, nonce } = split(cookie);
      expect(sid).toHaveLength(43);
      expect(nonce).toHaveLength(22);
      expect(maxAgeSeconds).toBe(IDLE_TIMEOUT_SECONDS);
      expect(await redis.ttl(`session:${sid}`)).toBe(IDLE_TIMEOUT_SECONDS);
      const record = await readRecord(sid);
      expect(record).toMatchObject({
        nonce,
        accountId: account.id,
        tokenVersion: 1,
        userAgent: 'jest',
        ip: '10.0.0.1',
      });
      expect(record.absoluteExpiresAt).toBeCloseTo(now() + ABSOLUTE_TIMEOUT_SECONDS, -1);
      expect(record.accessExpiresAt).toBeCloseTo(now() + ACCESS_TOKEN_TTL_SECONDS, -1);
    });

    it('tronque le user-agent à 200 caractères', async () => {
      const { cookie } = await service.createSession(account, {
        userAgent: 'x'.repeat(500),
      });
      expect((await readRecord(split(cookie).sid)).userAgent).toHaveLength(200);
    });

    it('deux sessions du même compte ont des sid distincts', async () => {
      const a = await service.createSession(account);
      const b = await service.createSession(account);
      expect(split(a.cookie).sid).not.toBe(split(b.cookie).sid);
    });
  });

  describe('resolveSession', () => {
    it('résout une session valide', async () => {
      const { cookie } = await service.createSession(account);
      const resolved = await service.resolveSession(cookie);

      expect(resolved).toMatchObject({ user: { sub: account.id } });
      expect(resolved?.accessExpiresAt).toBeCloseTo(now() + ACCESS_TOKEN_TTL_SECONDS, -1);
    });

    it.each([
      ['sans point', 'abcdef'],
      ['point en tête', '.nonce'],
      ['point en fin', 'sid.'],
      ['vide', ''],
    ])('renvoie null pour un cookie malformé (%s)', async (_label, cookie) => {
      expect(await service.resolveSession(cookie)).toBeNull();
    });

    it('renvoie null si la session n’existe plus dans Redis', async () => {
      expect(await service.resolveSession('inconnu.nonce')).toBeNull();
    });

    it('purge et renvoie null si l’enregistrement est corrompu', async () => {
      await redis.setex('session:corrompu', 60, 'ceci-n-est-pas-du-json');
      expect(await service.resolveSession('corrompu.nonce')).toBeNull();
      expect(await redis.get('session:corrompu')).toBeNull();
    });

    it('détruit la session et révoque tous les tokens si le nonce ne correspond pas', async () => {
      const { cookie } = await service.createSession(account);
      const { sid } = split(cookie);
      expect(await service.resolveSession(`${sid}.nonceVole`)).toBeNull();
      expect(await redis.get(`session:${sid}`)).toBeNull();
      expect(accounts.peek(account.id).tokenVersion).toBe(2);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('Session nonce mismatch'));
    });

    it('accepte un ancien nonce tant que la fenêtre de grâce est ouverte', async () => {
      const { cookie } = await service.createSession(account);
      const { sid, nonce: oldNonce } = split(cookie);
      await service.rotateSession(cookie);
      const resolved = await service.resolveSession(cookie);
      expect(resolved).toMatchObject({ user: { sub: account.id } });
      expect(await redis.get(`session:rotated:${sid}:${oldNonce}`)).not.toBeNull();
      expect(accounts.peek(account.id).tokenVersion).toBe(1);
    });

    it('renvoie null et purge la session au-delà du timeout absolu', async () => {
      const { cookie } = await service.createSession(account);
      const { sid } = split(cookie);
      await writeRecord(sid, { absoluteExpiresAt: now() - 1 });
      expect(await service.resolveSession(cookie)).toBeNull();
      expect(await redis.get(`session:${sid}`)).toBeNull();
    });

    it('renvoie null et purge la session si tokenVersion a été incrémenté (révocation globale)', async () => {
      const { cookie } = await service.createSession(account);
      const { sid } = split(cookie);
      await service.revokeAllTokens(account.id);
      expect(await service.resolveSession(cookie)).toBeNull();
      expect(await redis.get(`session:${sid}`)).toBeNull();
    });

    it('prolonge le TTL (sliding window) après 30 s d’inactivité', async () => {
      const { cookie } = await service.createSession(account);
      const { sid } = split(cookie);
      await writeRecord(sid, { lastUsedAt: now() - 31 });
      await redis.expire(`session:${sid}`, 60);
      await service.resolveSession(cookie);
      expect(await redis.ttl(`session:${sid}`)).toBe(IDLE_TIMEOUT_SECONDS);
      expect((await readRecord(sid)).lastUsedAt).toBeCloseTo(now(), -1);
    });

    it('n’écrit pas dans Redis si la session vient d’être utilisée (throttle 30 s)', async () => {
      const { cookie } = await service.createSession(account);
      const { sid } = split(cookie);
      await redis.expire(`session:${sid}`, 60);
      await service.resolveSession(cookie);
      expect(await redis.ttl(`session:${sid}`)).toBe(60);
    });
  });

  describe('rotateSession', () => {
    it('renouvelle le nonce, garde le sid et ouvre une fenêtre de grâce', async () => {
      const { cookie } = await service.createSession(account);
      const { sid, nonce: oldNonce } = split(cookie);
      const rotated = await service.rotateSession(cookie);
      const next = split(rotated.cookie);
      expect(next.sid).toBe(sid);
      expect(next.nonce).not.toBe(oldNonce);
      expect(rotated.maxAgeSeconds).toBe(IDLE_TIMEOUT_SECONDS);
      const record = await readRecord(sid);
      expect(record.nonce).toBe(next.nonce);
      expect(record.accessExpiresAt).toBeCloseTo(now() + ACCESS_TOKEN_TTL_SECONDS, -1);
      expect(await redis.get(`session:rotated:${sid}:${oldNonce}`)).toBe(rotated.cookie);
      expect(await redis.ttl(`session:rotated:${sid}:${oldNonce}`)).toBe(REFRESH_GRACE_WINDOW_SECONDS);
    });

    it('est idempotente pendant la fenêtre de grâce (rejeu du même ancien cookie)', async () => {
      const { cookie } = await service.createSession(account);
      const first = await service.rotateSession(cookie);
      const replay = await service.rotateSession(cookie);
      expect(replay.cookie).toBe(first.cookie);
      expect(accounts.peek(account.id).tokenVersion).toBe(1);
    });

    it('détecte le rejeu hors fenêtre de grâce → révocation totale', async () => {
      const { cookie } = await service.createSession(account);
      const { sid, nonce: oldNonce } = split(cookie);
      await service.rotateSession(cookie);
      await redis.del(`session:rotated:${sid}:${oldNonce}`);
      await expect(service.rotateSession(cookie)).rejects.toThrow(UnauthorizedException);
      expect(await redis.get(`session:${sid}`)).toBeNull();
      expect(accounts.peek(account.id).tokenVersion).toBe(2);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('Refresh reuse detected'));
    });

    it('rejette un cookie malformé', async () => {
      await expect(service.rotateSession('pas-de-point')).rejects.toThrow('Invalid session');
    });

    it('rejette une session absente (timeout d’inactivité)', async () => {
      await expect(service.rotateSession('inconnu.nonce')).rejects.toThrow('Session expired (idle)');
    });

    it('rejette au-delà du timeout absolu et purge la session', async () => {
      const { cookie } = await service.createSession(account);
      const { sid } = split(cookie);
      await writeRecord(sid, { absoluteExpiresAt: now() - 1 });
      await expect(service.rotateSession(cookie)).rejects.toThrow('Session absolute expired');
      expect(await redis.get(`session:${sid}`)).toBeNull();
    });

    it('rejette si le compte n’existe plus', async () => {
      const { cookie } = await service.createSession(account);
      accounts.rows.clear();
      await expect(service.rotateSession(cookie)).rejects.toThrow('Account not found');
    });

    it('rejette si tokenVersion a été incrémenté (révocation globale)', async () => {
      const { cookie } = await service.createSession(account);
      const { sid } = split(cookie);
      await service.revokeAllTokens(account.id);
      await expect(service.rotateSession(cookie)).rejects.toThrow('Token revoked');
      expect(await redis.get(`session:${sid}`)).toBeNull();
    });

    it('plafonne maxAgeSeconds sur l’échéance absolue restante', async () => {
      const { cookie } = await service.createSession(account);
      const { sid } = split(cookie);
      await writeRecord(sid, { absoluteExpiresAt: now() + 60 });
      const rotated = await service.rotateSession(cookie);
      expect(rotated.maxAgeSeconds).toBeLessThanOrEqual(60);
      expect(rotated.maxAgeSeconds).toBeGreaterThan(50);
    });

    it('met à jour lastSeenAt (throttlé à 5 min)', async () => {
      const { cookie } = await service.createSession(account);
      await service.rotateSession(cookie);
      await new Promise((r) => setTimeout(r, 10));
      expect(accounts.peek(account.id).lastSeenAt).toBeInstanceOf(Date);
    });

    it('sérialise les rotations concurrentes : les deux appelants reçoivent le même cookie', async () => {
      const { cookie } = await service.createSession(account);
      const [first, second] = await Promise.all([service.rotateSession(cookie), service.rotateSession(cookie)]);
      expect(second.cookie).toBe(first.cookie);
      expect(accounts.peek(account.id).tokenVersion).toBe(1);
    });

    it('libère le verrou même en cas d’erreur', async () => {
      const { cookie } = await service.createSession(account);
      const { sid } = split(cookie);
      await redis.del(`session:${sid}`);
      await expect(service.rotateSession(cookie)).rejects.toThrow(UnauthorizedException);
      expect(await redis.get(`lock:rotate:${sid}`)).toBeNull();
    });
  });

  describe('révocation', () => {
    it('revokeSessionCookie supprime la session', async () => {
      const { cookie } = await service.createSession(account);
      const { sid } = split(cookie);

      await service.revokeSessionCookie(cookie);

      expect(await redis.get(`session:${sid}`)).toBeNull();
      expect(await service.resolveSession(cookie)).toBeNull();
    });

    it('revokeSessionCookie ignore un cookie malformé', async () => {
      await expect(service.revokeSessionCookie('malforme')).resolves.toBeUndefined();
    });

    it('revokeAllTokens incrémente tokenVersion', async () => {
      await service.revokeAllTokens(account.id);
      await service.revokeAllTokens(account.id);
      expect(accounts.peek(account.id).tokenVersion).toBe(3);
    });
  });

  describe('generateApiKey', () => {
    it('génère une clé unique, compatible varchar(64)', () => {
      const keys = new Set(Array.from({ length: 100 }, generateApiKey));
      expect(keys.size).toBe(100);
      for (const key of keys) {
        expect(key).toMatch(/^[A-Za-z0-9_-]{32}$/);
        expect(key.length).toBeLessThanOrEqual(64);
      }
    });
  });
});
