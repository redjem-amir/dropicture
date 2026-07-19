// dropicture/apps/saas/backend/src/specs/settings.controller.spec.ts
import { ExecutionContext, INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { hash as argon2Hash } from '@node-rs/argon2';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import type { Request } from 'express';
import type { Redis } from 'ioredis';
import RedisMock from 'ioredis-mock';
import request, { type Response as TestResponse } from 'supertest';
import { AuthController } from '../controllers/auth.controller';
import { SettingsController } from '../controllers/settings.controller';
import { Account } from '../models/account.entity';
import { ARGON2_OPTIONS, AUTH_COOKIES, AuthService } from '../services/auth.service';
import { RedisService } from '../services/redis.service';
import { randomUUID } from 'crypto';

class FakeAccounts {
  readonly rows = new Map<string, Account>();

  create(dto: Partial<Account>): Account {
    return {
      id: randomUUID(),
      tokenVersion: 1,
      avatarMediaId: null,
      bio: null,
      apiKey: null,
      apiKeyCreatedAt: null,
      lastSeenAt: null,
      createdAt: new Date(),
      lastUpdate: new Date(),
      ...dto,
    } as Account;
  }

  async save(account: Account) {
    this.rows.set(account.id, { ...account });
    return { ...account };
  }

  async findOne({ where, select }: { where: unknown; select?: Record<string, boolean> }) {
    const row = this.match(where)[0];
    if (!row) return null;
    if (select) {
      const kept = Object.entries(select).filter(([, on]) => on);
      return Object.fromEntries(kept.map(([col]) => [col, (row as unknown as Record<string, unknown>)[col]]));
    }
    const { apiKey: _apiKey, ...visible } = row;
    return visible;
  }

  async exists({ where }: { where: unknown }) {
    return this.match(where).length > 0;
  }

  async update(where: unknown, patch: Partial<Account>) {
    const rows = this.match(where);
    rows.forEach((row) => this.rows.set(row.id, { ...row, ...patch }));
    return { affected: rows.length };
  }

  async delete(where: unknown) {
    const rows = this.match(where);
    rows.forEach((row) => this.rows.delete(row.id));
    return { affected: rows.length };
  }

  async increment(where: unknown, column: string, by: number) {
    const rows = this.match(where);
    rows.forEach((row) => this.rows.set(row.id, { ...row, [column]: (row as unknown as Record<string, number>)[column] + by }));
    return { affected: rows.length };
  }

  peek(id: string): Account {
    return this.rows.get(id) as Account;
  }

  peekByEmail(email: string): Account {
    return this.match({ email })[0];
  }

  private matchesClause(row: Account, clause: unknown): boolean {
    const criteria = Object.entries((clause as Record<string, unknown>) ?? {});
    if (!criteria.length) return false;
    return criteria.every(([key, value]) => (row as unknown as Record<string, unknown>)[key] === value);
  }

  private match(where: unknown): Account[] {
    if (!where) return [];
    const clauses = Array.isArray(where) ? where : [where];
    return [...this.rows.values()].filter((row) => clauses.some((clause) => this.matchesClause(row, clause)));
  }
}

const TEST_PASSWORD = 'Sup3rSecret!';
const NEW_PASSWORD = 'An0ther-Secret!';

describe('SettingsController — /api/settings', () => {
  let app: INestApplication;
  let accounts: FakeAccounts;
  let redis: Redis;
  let authService: AuthService;
  let passwordHash: string;

  let accountId: string;
  let cookie: string;
  let rawCookie: string;

  const http = () => request(app.getHttpServer());
  const cookieHeader = (raw: string) => `${AUTH_COOKIES.SESSION}=${raw}`;

  const seedAccount = (overrides: Partial<Account> = {}) =>
    accounts.save(
      accounts.create({
        firstname: 'Ada',
        lastname: 'Lovelace',
        username: 'ada_lovelace',
        email: 'ada@example.com',
        password: passwordHash,
        apiKey: 'seeded_api_key',
        apiKeyCreatedAt: new Date('2026-01-01T00:00:00.000Z'),
        ...overrides,
      }),
    );

  const openSession = async (account: Account) => {
    const { cookie: raw } = await authService.createSession(account);
    return { raw, header: cookieHeader(raw) };
  };

  const setCookie = (res: TestResponse) => {
    const found = ((res.headers['set-cookie'] ?? []) as unknown as string[]).find((c) => c.startsWith(`${AUTH_COOKIES.SESSION}=`));
    if (!found) throw new Error('aucun cookie de session dans la réponse');
    return found;
  };
  const cookieValue = (raw: string) => decodeURIComponent(raw.split(';')[0].split('=').slice(1).join('='));

  beforeAll(async () => {
    accounts = new FakeAccounts();
    redis = new RedisMock();
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController, SettingsController],
      providers: [AuthService, { provide: getRepositoryToken(Account), useValue: accounts }, { provide: RedisService, useValue: { cache: redis } }],
    })
      .overrideGuard(AuthGuard('access-token'))
      .useFactory({
        inject: [AuthService],
        factory: (auth: AuthService) => ({
          async canActivate(context: ExecutionContext) {
            const req = context.switchToHttp().getRequest<Request>();
            const raw = req.cookies?.[AUTH_COOKIES.SESSION];
            const resolved = raw ? await auth.resolveSession(raw) : null;
            if (!resolved) throw new UnauthorizedException();
            req.user = { sub: resolved.user.sub };
            return true;
          },
        }),
      })
      .compile();
    app = moduleRef.createNestApplication({ bodyParser: false, logger: false });
    app.use(bodyParser.json({ limit: '100kb' }));
    app.use(bodyParser.urlencoded({ limit: '100kb', extended: true }));
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    authService = moduleRef.get(AuthService);
    passwordHash = await argon2Hash(TEST_PASSWORD, ARGON2_OPTIONS);
  });

  beforeEach(async () => {
    accounts.rows.clear();
    await redis.flushall();
    const account = await seedAccount();
    accountId = account.id;
    const session = await openSession(account);
    rawCookie = session.raw;
    cookie = session.header;
  });

  afterAll(async () => {
    await app.close();
    redis.disconnect();
  });

  describe('authentification requise', () => {
    it.each([
      ['patch', '/api/settings/me'],
      ['patch', '/api/settings/email'],
      ['patch', '/api/settings/password'],
      ['get', '/api/settings/apikey'],
      ['post', '/api/settings/apikey'],
      ['delete', '/api/settings/apikey'],
      ['delete', '/api/settings/account'],
    ])('%s %s → 401 sans cookie', async (method, path) => {
      await http()[method as 'get'](path).send({}).expect(401);
    });
  });

  describe('PATCH /me', () => {
    it('met à jour et normalise le prénom/nom', async () => {
      const res = await http().patch('/api/settings/me').set('Cookie', cookie).send({ firstname: '  jean-luc ', lastname: 'PICARD' }).expect(200);
      expect(res.body).toEqual({ success: true, firstname: 'Jean-Luc', lastname: 'Picard' });
      const account = accounts.peek(accountId);
      expect(account.firstname).toBe('Jean-Luc');
      expect(account.lastname).toBe('Picard');
    });

    it('refuse un nom invalide → 400 INVALID_NAME', async () => {
      const res = await http().patch('/api/settings/me').set('Cookie', cookie).send({ firstname: 'Ada1', lastname: 'Lovelace' }).expect(400);
      expect(res.body.message).toContain('INVALID_NAME');
    });

    it('refuse un nom vide après normalisation → 400 INVALID_NAME', async () => {
      const res = await http().patch('/api/settings/me').set('Cookie', cookie).send({ firstname: '  a ', lastname: 'Lovelace' }).expect(400);
      expect(res.body).toEqual({ code: 'INVALID_NAME' });
    });

    it('rejette les champs non autorisés (email, password…)', async () => {
      const res = await http().patch('/api/settings/me').set('Cookie', cookie).send({ firstname: 'Ada', lastname: 'Lovelace', email: 'pirate@example.com' }).expect(400);
      expect(res.body.message.join(' ')).toMatch(/should not exist/i);
      expect(accounts.peek(accountId).email).toBe('ada@example.com');
    });

    it('renvoie 404 si le compte a été supprimé entre-temps', async () => {
      accounts.rows.clear();
      const res = await http().patch('/api/settings/me').set('Cookie', cookie).send({ firstname: 'Ada', lastname: 'Lovelace' }).expect(404);
      expect(res.body).toEqual({ code: 'ACCOUNT_NOT_FOUND' });
    });
  });

  describe('PATCH /email', () => {
    it('change l’email et le normalise', async () => {
      const res = await http().patch('/api/settings/email').set('Cookie', cookie).send({ email: '  NEW@Example.COM ' }).expect(200);
      expect(res.body).toEqual({ success: true, email: 'new@example.com' });
      expect(accounts.peek(accountId).email).toBe('new@example.com');
    });

    it('est idempotent si l’email est inchangé', async () => {
      const res = await http().patch('/api/settings/email').set('Cookie', cookie).send({ email: 'ada@example.com' }).expect(200);
      expect(res.body).toEqual({ success: true, email: 'ada@example.com' });
    });

    it('renvoie 409 si l’email appartient à un autre compte', async () => {
      await seedAccount({ email: 'grace@example.com', username: 'grace_h', apiKey: 'other_key' });
      const res = await http().patch('/api/settings/email').set('Cookie', cookie).send({ email: 'grace@example.com' }).expect(409);
      expect(res.body).toEqual({ code: 'EMAIL_ALREADY_USED' });
      expect(accounts.peek(accountId).email).toBe('ada@example.com');
    });

    it('refuse un email invalide → 400 EMAIL_INVALID', async () => {
      const res = await http().patch('/api/settings/email').set('Cookie', cookie).send({ email: 'pas-un-email' }).expect(400);
      expect(res.body.message).toContain('EMAIL_INVALID');
    });

    it('n’exige pas le mot de passe et laisse les sessions ouvertes (comportement actuel)', async () => {
      await http().patch('/api/settings/email').set('Cookie', cookie).send({ email: 'new@example.com' }).expect(200);
      await http().get('/api/auth/me').set('Cookie', cookie).expect(200);
      expect(accounts.peek(accountId).tokenVersion).toBe(1);
    });
  });

  describe('PATCH /password', () => {
    const body = { currentPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD };

    it('renvoie 401 si le mot de passe actuel est faux', async () => {
      const res = await http()
        .patch('/api/settings/password')
        .set('Cookie', cookie)
        .send({ ...body, currentPassword: 'Wr0ngPassword!' })
        .expect(401);
      expect(res.body).toEqual({ code: 'INVALID_CREDENTIALS' });
      expect(accounts.peek(accountId).tokenVersion).toBe(1);
    });

    it('refuse un nouveau mot de passe trop faible → 400', async () => {
      const res = await http()
        .patch('/api/settings/password')
        .set('Cookie', cookie)
        .send({ ...body, newPassword: 'faible' })
        .expect(400);
      expect(res.body.message).toEqual(expect.arrayContaining(['PASSWORD_TOO_SHORT', 'PASSWORD_MISSING_UPPERCASE']));
    });

    it('change le mot de passe, incrémente tokenVersion et ré-émet un cookie', async () => {
      const res = await http().patch('/api/settings/password').set('Cookie', cookie).send(body).expect(200);
      expect(res.body).toEqual({ success: true, expires_in: 300 });
      const account = accounts.peek(accountId);
      expect(account.tokenVersion).toBe(2);
      expect(account.password).toMatch(/^\$argon2id\$/);
      const fresh = cookieValue(setCookie(res));
      expect(fresh).not.toBe(rawCookie);
      await http().get('/api/auth/me').set('Cookie', cookie).expect(401);
      await http().get('/api/auth/me').set('Cookie', cookieHeader(fresh)).expect(200);
      await http().post('/api/auth/signin').send({ email: 'ada@example.com', password: TEST_PASSWORD }).expect(401);
      await http().post('/api/auth/signin').send({ email: 'ada@example.com', password: NEW_PASSWORD }).expect(200);
    });

    it('déconnecte immédiatement les autres appareils (tokenVersion vérifié à chaque résolution)', async () => {
      const other = await openSession(accounts.peek(accountId));
      await http().patch('/api/settings/password').set('Cookie', cookie).send(body).expect(200);
      await http().get('/api/auth/me').set('Cookie', other.header).expect(401);
      await http().post('/api/auth/session').set('Cookie', other.header).expect(401);
    });
  });

  describe('GET|POST|DELETE /apikey', () => {
    it('GET renvoie la clé courante et sa date', async () => {
      const res = await http().get('/api/settings/apikey').set('Cookie', cookie).expect(200);
      expect(res.body).toEqual({ apiKey: 'seeded_api_key', createdAt: '2026-01-01T00:00:00.000Z' });
    });

    it('GET renvoie null si aucune clé', async () => {
      await accounts.update({ id: accountId }, { apiKey: null, apiKeyCreatedAt: null });
      const res = await http().get('/api/settings/apikey').set('Cookie', cookie).expect(200);
      expect(res.body).toEqual({ apiKey: null, createdAt: null });
    });

    it('POST génère une nouvelle clé et la persiste', async () => {
      const res = await http().post('/api/settings/apikey').set('Cookie', cookie).expect(200);
      expect(res.body.apiKey).toMatch(/^[\w-]{32}$/);
      expect(res.body.apiKey).not.toBe('seeded_api_key');
      expect(typeof res.body.createdAt).toBe('string');
      expect(accounts.peek(accountId).apiKey).toBe(res.body.apiKey);
      const reread = await http().get('/api/settings/apikey').set('Cookie', cookie).expect(200);
      expect(reread.body.apiKey).toBe(res.body.apiKey);
    });

    it('POST deux fois de suite produit deux clés différentes', async () => {
      const first = await http().post('/api/settings/apikey').set('Cookie', cookie).expect(200);
      const second = await http().post('/api/settings/apikey').set('Cookie', cookie).expect(200);
      expect(second.body.apiKey).not.toBe(first.body.apiKey);
    });

    it('DELETE révoque la clé', async () => {
      const res = await http().delete('/api/settings/apikey').set('Cookie', cookie).expect(200);
      expect(res.body).toEqual({ success: true });
      const account = accounts.peek(accountId);
      expect(account.apiKey).toBeNull();
      expect(account.apiKeyCreatedAt).toBeNull();
    });
  });

  describe('DELETE /account', () => {
    it('renvoie 401 si le mot de passe est faux', async () => {
      const res = await http().delete('/api/settings/account').set('Cookie', cookie).send({ password: 'Wr0ngPassword!' }).expect(401);
      expect(res.body).toEqual({ code: 'INVALID_CREDENTIALS' });
      expect(accounts.peek(accountId)).toBeDefined();
    });

    it('renvoie 400 si le mot de passe est absent', async () => {
      await http().delete('/api/settings/account').set('Cookie', cookie).send({}).expect(400);
    });

    it('supprime le compte, détruit la session et efface le cookie', async () => {
      const res = await http().delete('/api/settings/account').set('Cookie', cookie).send({ password: TEST_PASSWORD }).expect(200);
      expect(res.body).toEqual({ success: true });
      expect(setCookie(res)).toMatch(/session=;/);
      expect(accounts.peek(accountId)).toBeUndefined();
      expect(await redis.get(`session:${rawCookie.split('.')[0]}`)).toBeNull();
      await http().get('/api/auth/me').set('Cookie', cookie).expect(401);
    });
  });
});
