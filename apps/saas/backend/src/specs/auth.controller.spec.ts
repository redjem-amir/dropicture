// dropicture/apps/saas/backend/src/specs/auth.controller.spec.ts
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
import { randomUUID } from 'crypto';
import { AuthController } from '../controllers/auth.controller';
import { Account } from '../models/account.entity';
import { ARGON2_OPTIONS, AUTH_COOKIES, AuthService } from '../services/auth.service';
import { RedisService } from '../services/redis.service';

class FakeAccounts {
  readonly rows = new Map<string, Account>();

  create(dto: Partial<Account>): Account {
    return {
      id: randomUUID(),
      tokenVersion: 1,
      avatarMediaId: null,
      bio: null,
      apiKey: null,
      apiKeyIssuedAt: null,
      lastSeenAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
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
    const { passwordHash: _p, apiKey: _k, ...visible } = row as Account & Record<string, unknown>;
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
    rows.forEach((row) =>
      this.rows.set(row.id, {
        ...row,
        [column]: (row as unknown as Record<string, number>)[column] + by,
      }),
    );
    return { affected: rows.length };
  }

  createQueryBuilder(_alias?: string) {
    const params: Record<string, unknown> = {};
    const rows = () => [...this.rows.values()];
    const qb = {
      select: () => qb,
      addSelect: () => qb,
      where: (_clause: string, p?: Record<string, unknown>) => (Object.assign(params, p), qb),
      andWhere: (_clause: string, p?: Record<string, unknown>) => (Object.assign(params, p), qb),
      getOne: async () => {
        if (!Object.keys(params).length) return null;
        const found = rows().find(
          (r) => (params.email === undefined || r.email === params.email) && (params.sub === undefined || r.id === params.sub) && (params.id === undefined || r.id === params.id),
        );
        return found ? { ...found } : null;
      },
    };
    return qb;
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

describe('AuthController /api/auth', () => {
  let app: INestApplication;
  let accounts: FakeAccounts;
  let redis: Redis;
  let authService: AuthService;
  let passwordHash: string;

  const http = () => request(app.getHttpServer());
  const cookieHeader = (raw: string) => `${AUTH_COOKIES.SESSION}=${raw}`;

  const seedAccount = (overrides: Partial<Account> = {}) =>
    accounts.save(
      accounts.create({
        firstname: 'Ada',
        lastname: 'Lovelace',
        username: 'ada_lovelace',
        email: 'ada@example.com',
        passwordHash,
        ...overrides,
      }),
    );

  const openSession = async (account: Account) => {
    const { cookie } = await authService.createSession(account);
    return { raw: cookie, header: cookieHeader(cookie) };
  };

  const sessionCookies = (res: TestResponse) => ((res.headers['set-cookie'] ?? []) as unknown as string[]).filter((c) => c.startsWith(`${AUTH_COOKIES.SESSION}=`));

  const setCookie = (res: TestResponse) => {
    const [found] = sessionCookies(res);
    if (!found) throw new Error('aucun cookie de session dans la réponse');
    return found;
  };

  const cookieValue = (raw: string) => decodeURIComponent(raw.split(';')[0].split('=').slice(1).join('='));

  beforeAll(async () => {
    accounts = new FakeAccounts();
    redis = new RedisMock();
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [AuthService, { provide: getRepositoryToken(Account), useValue: accounts }, { provide: RedisService, useValue: { cache: redis } }],
    })
      .overrideGuard(AuthGuard('access-token'))
      .useFactory({
        inject: [AuthService],
        factory: (auth: AuthService) => ({
          async canActivate(context: ExecutionContext) {
            const req = context.switchToHttp().getRequest<Request>();
            const cookie = req.cookies?.[AUTH_COOKIES.SESSION];
            const resolved = cookie ? await auth.resolveSession(cookie) : null;
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
  });

  afterAll(async () => {
    await app.close();
    redis.disconnect();
  });

  describe('POST /signup', () => {
    const payload = {
      firstname: 'Ada',
      lastname: 'Lovelace',
      username: 'ada_lovelace',
      email: 'ada@example.com',
      password: TEST_PASSWORD,
    };

    it('crée le compte, hashe le mot de passe et génère une clé API', async () => {
      const res = await http().post('/api/auth/signup').send(payload).expect(201);
      expect(res.body).toEqual({ success: true });
      const account = accounts.peekByEmail('ada@example.com');
      expect(account).toBeDefined();
      expect(account.username).toBe('ada_lovelace');
      expect(account.passwordHash).toMatch(/^\$argon2id\$/);
      expect(account.passwordHash).not.toContain(TEST_PASSWORD);
      expect(account.apiKey).toMatch(/^[\w-]{32}$/);
      expect(account.apiKeyIssuedAt).toBeInstanceOf(Date);
      expect(account.tokenVersion).toBe(1);
    });

    it('normalise l’email et le username (casse + espaces)', async () => {
      await http()
        .post('/api/auth/signup')
        .send({ ...payload, email: '  ADA@Example.COM  ', username: '  ADA_Lovelace ' })
        .expect(201);
      const account = accounts.peekByEmail('ada@example.com');
      expect(account).toBeDefined();
      expect(account.username).toBe('ada_lovelace');
    });

    it.each([
      ['jean-luc', 'PICARD', 'Jean-Luc', 'Picard'],
      ['  marie   claire  ', "o'neill", 'Marie Claire', "O'neill"],
      ['McCoy', 'van Der Berg', 'McCoy', 'Van Der Berg'],
      ["o'NEILL", 'mcCOY', "o'NEILL", 'mcCOY'],
    ])('normalise la casse des noms (%s / %s)', async (firstname, lastname, expectedFirst, expectedLast) => {
      await http()
        .post('/api/auth/signup')
        .send({ ...payload, firstname, lastname })
        .expect(201);
      const account = accounts.peekByEmail('ada@example.com');
      expect(account.firstname).toBe(expectedFirst);
      expect(account.lastname).toBe(expectedLast);
    });

    it('renvoie 409 EMAIL_ALREADY_USED si l’email existe déjà', async () => {
      await seedAccount();
      const res = await http().post('/api/auth/signup').send(payload).expect(409);
      expect(res.body).toEqual({ code: 'EMAIL_ALREADY_USED' });
      expect(accounts.rows.size).toBe(1);
    });

    it('renvoie 409 USERNAME_ALREADY_USED si le username est pris (email différent)', async () => {
      await seedAccount({ email: 'grace@example.com', username: 'ada_lovelace' });
      const res = await http().post('/api/auth/signup').send(payload).expect(409);
      expect(res.body).toEqual({ code: 'USERNAME_ALREADY_USED' });
      expect(accounts.rows.size).toBe(1);
    });

    it('renvoie 400 USERNAME_RESERVED pour un username réservé', async () => {
      const res = await http()
        .post('/api/auth/signup')
        .send({ ...payload, username: 'admin' })
        .expect(400);
      expect(res.body).toEqual({ code: 'USERNAME_RESERVED' });
      expect(accounts.rows.size).toBe(0);
    });

    it.each([
      ['trop court', 'ab', 'USERNAME_TOO_SHORT'],
      ['caractères interdits', 'ada!lovelace', 'USERNAME_INVALID'],
      ['deux points consécutifs', 'ada..lovelace', 'USERNAME_INVALID'],
    ])('refuse un username %s → 400 %s', async (_label, username, code) => {
      const res = await http()
        .post('/api/auth/signup')
        .send({ ...payload, username })
        .expect(400);
      expect(res.body.message).toContain(code);
      expect(accounts.rows.size).toBe(0);
    });

    it.each([
      ['trop court', 'Ab1!', 'PASSWORD_TOO_SHORT'],
      ['sans majuscule', 'sup3rsecret!', 'PASSWORD_MISSING_UPPERCASE'],
      ['sans minuscule', 'SUP3RSECRET!', 'PASSWORD_MISSING_LOWERCASE'],
      ['sans chiffre', 'SuperSecret!', 'PASSWORD_MISSING_NUMBER'],
      ['sans caractère spécial', 'Sup3rSecret', 'PASSWORD_MISSING_SPECIAL'],
      ['trop long', `A1!${'a'.repeat(130)}`, 'PASSWORD_TOO_LONG'],
    ])('refuse un mot de passe %s → 400 %s', async (_label, password, code) => {
      const res = await http()
        .post('/api/auth/signup')
        .send({ ...payload, password })
        .expect(400);
      expect(res.body.message).toContain(code);
      expect(accounts.rows.size).toBe(0);
    });

    it('refuse un prénom contenant des chiffres → 400 INVALID_NAME', async () => {
      const res = await http()
        .post('/api/auth/signup')
        .send({ ...payload, firstname: 'Ada2' })
        .expect(400);
      expect(res.body.message).toContain('INVALID_NAME');
    });

    it('refuse un nom devenu trop court après normalisation → 400 INVALID_NAME', async () => {
      const res = await http()
        .post('/api/auth/signup')
        .send({ ...payload, firstname: '  a ' })
        .expect(400);
      expect(res.body).toEqual({ code: 'INVALID_NAME' });
    });

    it('mappe une violation d’unicité Postgres (23505) sur un 409', async () => {
      const save = jest.spyOn(accounts, 'save').mockRejectedValueOnce(
        Object.assign(new Error('duplicate key'), {
          code: '23505',
          constraint: 'UQ_accounts_email',
        }),
      );
      const res = await http().post('/api/auth/signup').send(payload).expect(409);
      expect(res.body).toEqual({ code: 'EMAIL_ALREADY_USED' });
      save.mockRestore();
    });

    it('rejette les champs inconnus (pas de mass-assignment)', async () => {
      const res = await http()
        .post('/api/auth/signup')
        .send({ ...payload, tokenVersion: 99, apiKey: 'pwned' })
        .expect(400);
      expect(res.body.message.join(' ')).toMatch(/should not exist/i);
      expect(accounts.rows.size).toBe(0);
    });

    it('renvoie 400 si le body est vide', async () => {
      const res = await http().post('/api/auth/signup').send({}).expect(400);
      expect(res.body.message).toEqual(expect.arrayContaining(['MISSING_FIELDS', 'EMAIL_INVALID']));
    });
  });

  describe('GET /username/:username', () => {
    it('renvoie available:true pour un username libre', async () => {
      const res = await http().get('/api/auth/username/newcomer').expect(200);
      expect(res.body).toEqual({ username: 'newcomer', available: true, code: null });
    });

    it('renvoie available:false USERNAME_ALREADY_USED si pris', async () => {
      await seedAccount();
      const res = await http().get('/api/auth/username/ADA_Lovelace').expect(200);
      expect(res.body).toEqual({
        username: 'ada_lovelace',
        available: false,
        code: 'USERNAME_ALREADY_USED',
      });
    });

    it('renvoie available:false USERNAME_RESERVED pour un nom réservé', async () => {
      const res = await http().get('/api/auth/username/admin').expect(200);
      expect(res.body).toEqual({ username: 'admin', available: false, code: 'USERNAME_RESERVED' });
    });

    it('renvoie available:false USERNAME_INVALID pour un nom malformé', async () => {
      const res = await http().get('/api/auth/username/ab').expect(200);
      expect(res.body).toEqual({ username: 'ab', available: false, code: 'USERNAME_INVALID' });
    });
  });

  describe('POST /signin', () => {
    it('pose un cookie de session httpOnly et renvoie expires_in', async () => {
      await seedAccount();
      const res = await http().post('/api/auth/signin').send({ email: 'ada@example.com', password: TEST_PASSWORD }).expect(200);
      expect(res.body).toEqual({ success: true, expires_in: 300 });
      const cookie = setCookie(res);
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);
      expect(cookie).toMatch(/Path=\//);
      expect(cookie).toMatch(/Max-Age=1800/);
      expect(cookieValue(cookie)).toMatch(/^[\w-]{43}\.[\w-]{22}$/);
      expect(await authService.resolveSession(cookieValue(cookie))).not.toBeNull();
    });

    it('accepte un email avec une casse et des espaces différents', async () => {
      await seedAccount();
      await http().post('/api/auth/signin').send({ email: '  ADA@Example.COM ', password: TEST_PASSWORD }).expect(200);
    });

    it('met à jour lastSeenAt', async () => {
      const account = await seedAccount();
      expect(accounts.peek(account.id).lastSeenAt).toBeNull();
      await http().post('/api/auth/signin').send({ email: 'ada@example.com', password: TEST_PASSWORD }).expect(200);
      expect(accounts.peek(account.id).lastSeenAt).toBeInstanceOf(Date);
    });

    it('renvoie la même erreur pour un email inconnu et un mauvais mot de passe', async () => {
      await seedAccount();
      const unknownEmail = await http().post('/api/auth/signin').send({ email: 'inconnu@example.com', password: TEST_PASSWORD }).expect(401);
      const wrongPassword = await http().post('/api/auth/signin').send({ email: 'ada@example.com', password: 'Wr0ngPassword!' }).expect(401);
      expect(unknownEmail.body).toEqual({ code: 'INVALID_CREDENTIALS' });
      expect(wrongPassword.body).toEqual(unknownEmail.body);
      expect(sessionCookies(unknownEmail)).toHaveLength(0);
      expect(sessionCookies(wrongPassword)).toHaveLength(0);
    });

    it('valide le body → 400', async () => {
      const res = await http().post('/api/auth/signin').send({ email: 'pas-un-email' }).expect(400);
      expect(res.body.message).toContain('EMAIL_INVALID');
    });
  });

  describe('GET /me', () => {
    it('renvoie 401 sans cookie', async () => {
      await http().get('/api/auth/me').expect(401);
    });

    it('renvoie 401 avec un cookie bidon', async () => {
      await http().get('/api/auth/me').set('Cookie', cookieHeader('bidon.bidon')).expect(401);
    });

    it('renvoie email/username/firstname/lastname', async () => {
      const { header } = await openSession(await seedAccount());
      const res = await http().get('/api/auth/me').set('Cookie', header).expect(200);
      expect(res.body).toEqual({
        email: 'ada@example.com',
        username: 'ada_lovelace',
        firstname: 'Ada',
        lastname: 'Lovelace',
      });
      expect(res.body).not.toHaveProperty('passwordHash');
      expect(res.body).not.toHaveProperty('apiKey');
      expect(res.body).not.toHaveProperty('id');
    });

    it('renvoie 404 ACCOUNT_NOT_FOUND si le compte a disparu mais que la session vit encore', async () => {
      const { header } = await openSession(await seedAccount());
      accounts.rows.clear();
      const res = await http().get('/api/auth/me').set('Cookie', header).expect(404);
      expect(res.body).toEqual({ code: 'ACCOUNT_NOT_FOUND' });
    });
  });

  describe('POST /resolve', () => {
    it('renvoie 401 sans cookie', async () => {
      const res = await http().post('/api/auth/resolve').expect(401);
      expect(res.body.message).toBe('Unauthenticated');
    });

    it('renvoie 401 si la session n’existe plus', async () => {
      await http().post('/api/auth/resolve').set('Cookie', cookieHeader('inexistant.nonce')).expect(401);
    });

    it('renvoie sub et accessExpiresAt', async () => {
      const account = await seedAccount();
      const { header } = await openSession(account);
      const res = await http().post('/api/auth/resolve').set('Cookie', header).expect(200);
      expect(res.body.sub).toBe(account.id);
      expect(res.body.accessExpiresAt).toBeCloseTo(Math.floor(Date.now() / 1000) + 300, -1);
    });
  });

  describe('POST /session (rotation)', () => {
    it('renvoie 401 sans cookie', async () => {
      const res = await http().post('/api/auth/session').expect(401);
      expect(res.body.message).toBe('Session missing');
    });

    // NB : la route utilise @Res() sans @HttpCode, Nest répond donc 201.
    it('émet un nouveau cookie et conserve le même sid', async () => {
      const { raw, header } = await openSession(await seedAccount());
      const res = await http().post('/api/auth/session').set('Cookie', header).expect(201);
      expect(res.body).toEqual({ success: true, rotated: true, expires_in: 300 });
      const rotated = cookieValue(setCookie(res));
      expect(rotated).not.toBe(raw);
      expect(rotated.split('.')[0]).toBe(raw.split('.')[0]);
      expect(rotated.split('.')[1]).not.toBe(raw.split('.')[1]);
      await http().get('/api/auth/me').set('Cookie', cookieHeader(rotated)).expect(200);
    });

    it('laisse l’ancien cookie valide pendant la fenêtre de grâce (30 s)', async () => {
      const { raw, header } = await openSession(await seedAccount());
      await http().post('/api/auth/session').set('Cookie', header).expect(201);
      await http().get('/api/auth/me').set('Cookie', header).expect(200);
      const retry = await http().post('/api/auth/session').set('Cookie', header).expect(201);
      expect(cookieValue(setCookie(retry))).not.toBe(raw);
    });

    it('révoque tout en cas de rejeu hors fenêtre de grâce', async () => {
      const account = await seedAccount();
      const { raw, header } = await openSession(account);
      const rotation = await http().post('/api/auth/session').set('Cookie', header).expect(201);
      const rotated = cookieValue(setCookie(rotation));
      const [sid, oldNonce] = raw.split('.');
      await redis.del(`session:rotated:${sid}:${oldNonce}`);
      const replay = await http().post('/api/auth/session').set('Cookie', header).expect(401);
      expect(replay.body.message).toBe('Refresh token reuse detected');
      expect(await redis.get(`session:${sid}`)).toBeNull();
      expect(accounts.peek(account.id).tokenVersion).toBe(2);
      await http().get('/api/auth/me').set('Cookie', cookieHeader(rotated)).expect(401);
    });
  });

  describe('POST /signout', () => {
    it('efface le cookie et détruit la session', async () => {
      const { raw, header } = await openSession(await seedAccount());
      const res = await http().post('/api/auth/signout').set('Cookie', header).expect(200);
      expect(res.body).toEqual({ message: 'Logged out' });
      expect(setCookie(res)).toMatch(/session=;/);
      expect(await redis.get(`session:${raw.split('.')[0]}`)).toBeNull();
      await http().get('/api/auth/me').set('Cookie', header).expect(401);
    });

    it('répond 200 même sans cookie (idempotent)', async () => {
      await http().post('/api/auth/signout').expect(200);
    });
  });

  it('parcours complet : signup → signin → me → rotation → signout', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/signup')
      .send({
        firstname: 'Ada',
        lastname: 'Lovelace',
        username: 'ada_lovelace',
        email: 'ada@example.com',
        password: TEST_PASSWORD,
      })
      .expect(201);
    await agent.post('/api/auth/signin').send({ email: 'ada@example.com', password: TEST_PASSWORD }).expect(200);
    await agent.get('/api/auth/me').expect(200);
    await agent.post('/api/auth/session').expect(201);
    await agent.get('/api/auth/me').expect(200);
    await agent.post('/api/auth/signout').expect(200);
    await agent.get('/api/auth/me').expect(401);
  });
});
