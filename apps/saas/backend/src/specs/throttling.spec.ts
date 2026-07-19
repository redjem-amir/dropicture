// dropicture/apps/saas/backend/src/specs/throttling.spec.ts
import { ExecutionContext, INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { getRepositoryToken } from '@nestjs/typeorm';
import { hash as argon2Hash } from '@node-rs/argon2';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import type { Request } from 'express';
import type { Redis } from 'ioredis';
import RedisMock from 'ioredis-mock';
import request from 'supertest';
import { AuthController } from '../controllers/auth.controller';
import { SettingsController } from '../controllers/settings.controller';
import { Account } from '../models/account.entity';
import { ARGON2_OPTIONS, AUTH_COOKIES, AuthService } from '../services/auth.service';
import { RedisService } from '../services/redis.service';
import { randomUUID } from 'crypto';

/** Dépôt Account en mémoire : reproduit la surface de Repository<Account> utilisée ici. */
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

describe('Rate limiting (@Throttle)', () => {
  let app: INestApplication;
  let accounts: FakeAccounts;
  let redis: Redis;
  let authService: AuthService;
  let passwordHash: string;

  const http = () => request(app.getHttpServer());

  const seedAccount = () =>
    accounts.save(
      accounts.create({
        firstname: 'Ada',
        lastname: 'Lovelace',
        username: 'ada_lovelace',
        email: 'ada@example.com',
        password: passwordHash,
        apiKey: 'seeded_api_key',
      }),
    );

  const openSession = async (account: Account) => {
    const { cookie } = await authService.createSession(account);
    return `${AUTH_COOKIES.SESSION}=${cookie}`;
  };

  beforeAll(async () => {
    passwordHash = await argon2Hash(TEST_PASSWORD, ARGON2_OPTIONS);
  });

  beforeEach(async () => {
    accounts = new FakeAccounts();
    redis = new RedisMock();
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot({ throttlers: [{ limit: 60, ttl: 60_000 }] })],
      controllers: [AuthController, SettingsController],
      providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }, AuthService, { provide: getRepositoryToken(Account), useValue: accounts }, { provide: RedisService, useValue: { cache: redis } }],
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
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    authService = moduleRef.get(AuthService);
  });

  afterEach(async () => {
    await app.close();
    redis.disconnect();
  });

  it('limite /signin à 10 tentatives par minute', async () => {
    await seedAccount();
    const attempt = () => http().post('/api/auth/signin').send({ email: 'ada@example.com', password: 'Wr0ngPassword!' });
    for (let i = 0; i < 10; i++) {
      await attempt().expect(401);
    }
    const blocked = await attempt().expect(429);
    expect(blocked.body.message).toMatch(/too many requests/i);
  }, 20_000);

  it('limite /signup à 5 créations par heure', async () => {
    const signup = (n: number) =>
      http()
        .post('/api/auth/signup')
        .send({ firstname: 'Ada', lastname: 'Lovelace', username: `ada${n}`, email: `ada${n}@example.com`, password: TEST_PASSWORD });
    for (let i = 0; i < 5; i++) {
      await signup(i).expect(201);
    }
    await signup(5).expect(429);
    expect(accounts.rows.size).toBe(5);
  }, 20_000);

  it('limite la rotation de clé API à 5 par minute', async () => {
    const cookie = await openSession(await seedAccount());
    for (let i = 0; i < 5; i++) {
      await http().post('/api/settings/apikey').set('Cookie', cookie).expect(200);
    }
    await http().post('/api/settings/apikey').set('Cookie', cookie).expect(429);
  });

  it('applique un compteur distinct par route', async () => {
    const cookie = await openSession(await seedAccount());
    for (let i = 0; i < 5; i++) {
      await http().post('/api/settings/apikey').set('Cookie', cookie).expect(200);
    }
    await http().post('/api/settings/apikey').set('Cookie', cookie).expect(429);
    await http().get('/api/auth/me').set('Cookie', cookie).expect(200);
  });
});
