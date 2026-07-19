// dropicture/apps/saas/backend/src/specs/profile.controller.spec.ts
import { CanActivate, ExecutionContext, INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import type { Request } from 'express';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { ProfileController } from '../controllers/profile.controller';
import { CdnService, MEDIA_LIMITS } from '../services/cdn.service';
import { Account } from '../models/account.entity';
import { Media } from '../models/media.entity';

const SITE = 'https://dropicture.com';
const OWNER_ID = randomUUID();

/** Dépôt Account en mémoire : surface minimale utilisée par ProfileController. */
class FakeAccounts {
  readonly rows = new Map<string, Account>();

  seed(overrides: Partial<Account> = {}): Account {
    const account = {
      id: OWNER_ID,
      username: 'ada_lovelace',
      firstname: 'Ada',
      lastname: 'Lovelace',
      bio: null,
      avatarMediaId: null,
      ...overrides,
    } as Account;
    this.rows.set(account.id, account);
    return account;
  }

  update = jest.fn(async (where: { id: string }, patch: Partial<Account>) => {
    const row = this.rows.get(where.id);
    if (row) this.rows.set(where.id, { ...row, ...patch });
    return { affected: row ? 1 : 0 };
  });

  async findOne({ where }: { where: { id: string } }) {
    return this.rows.get(where.id) ?? null;
  }

  peek(id: string): Account {
    return this.rows.get(id) as Account;
  }
}

/** Dépôt Media en mémoire avec un QueryBuilder chaînable configurable. */
class FakeMedia {
  readonly rows = new Map<string, Media>();
  rawMany: Array<{ visibility: string; total: string }> = [];
  many: Media[] = [];
  finds: Media[] = [];

  seed(media: Partial<Media>): Media {
    const row = media as Media;
    if (row.id) this.rows.set(row.id, row);
    return row;
  }

  async findOne({ where }: { where: { id: string } }) {
    const clause = Array.isArray(where) ? where[0] : where;
    return this.rows.get(clause.id) ?? null;
  }

  async find() {
    return this.finds;
  }

  createQueryBuilder() {
    const self = this;
    const qb: Record<string, unknown> = {};
    for (const method of ['select', 'addSelect', 'where', 'andWhere', 'groupBy', 'orderBy', 'addOrderBy', 'take', 'skip']) {
      qb[method] = () => qb;
    }
    qb.getRawMany = async () => self.rawMany;
    qb.getMany = async () => self.many;
    return qb;
  }
}

const cdn = {
  urlsFor: (m: Media) => ({ base: `cdn/${m.id}`, srcSet: null, poster: null, hls: null, thumbhash: null }),
  limits: () => ({
    image: { maxBytes: 8388608 },
    video: { maxBytes: 1, minDurationMs: 1, maxDurationMs: 1 },
    avatar: { maxBytes: 8388608 },
    accepted: ['image/jpeg'],
  }),
  publishMedia: jest.fn(async (_ownerId: string, id: string) => ({ id, visibility: 'public' })),
  unpublishMedia: jest.fn(async (_ownerId: string, id: string) => ({ id, visibility: 'private' })),
  createUpload: jest.fn(async () => ({ strategy: 'post', mediaId: 'm', key: 'k', url: 'u', fields: {}, expiresAt: 'x' })),
  completeUpload: jest.fn(async (_ownerId: string, id: string) => ({ id, purpose: 'avatar', status: 'ready' })),
  destroyMedia: jest.fn(async () => undefined),
  issueReadCookies: jest.fn(() => [{ name: 'CloudFront-Policy', value: 'v', maxAge: 3600000 }]),
};

describe('ProfileController — /api/profile', () => {
  let app: INestApplication;
  let accounts: FakeAccounts;
  let media: FakeMedia;

  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    accounts = new FakeAccounts();
    media = new FakeMedia();

    const authGuard: CanActivate = {
      canActivate(context: ExecutionContext) {
        const req = context.switchToHttp().getRequest<Request>();
        const sub = req.headers['x-user'] as string | undefined;
        if (!sub) throw new UnauthorizedException();
        req.user = { sub };
        return true;
      },
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [ProfileController],
      providers: [
        { provide: CdnService, useValue: cdn },
        { provide: getRepositoryToken(Account), useValue: accounts },
        { provide: getRepositoryToken(Media), useValue: media },
      ],
    })
      .overrideGuard(AuthGuard('access-token'))
      .useValue(authGuard)
      .compile();

    app = moduleRef.createNestApplication({ bodyParser: false, logger: false });
    app.use(bodyParser.json({ limit: '100kb' }));
    app.use(bodyParser.urlencoded({ limit: '100kb', extended: true }));
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  beforeEach(() => {
    accounts.rows.clear();
    media.rows.clear();
    media.rawMany = [];
    media.many = [];
    media.finds = [];
    jest.clearAllMocks();
    accounts.seed();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('authentification requise', () => {
    it('renvoie 401 sans en-tête x-user', async () => {
      await http().get('/api/profile').expect(401);
    });
  });

  describe('GET /', () => {
    it('renvoie 404 ACCOUNT_NOT_FOUND si le compte est absent', async () => {
      accounts.rows.clear();
      const res = await http().get('/api/profile').set('x-user', OWNER_ID).expect(404);
      expect(res.body).toEqual({ code: 'ACCOUNT_NOT_FOUND' });
    });

    it('renvoie le profil, les compteurs agrégés et les limites', async () => {
      media.rawMany = [
        { visibility: 'public', total: '2' },
        { visibility: 'private', total: '3' },
      ];
      const res = await http().get('/api/profile').set('x-user', OWNER_ID).expect(200);
      expect(res.body).toMatchObject({
        username: 'ada_lovelace',
        firstname: 'Ada',
        lastname: 'Lovelace',
        bio: null,
        publicUrl: `${SITE}/u/?u=ada_lovelace`,
        avatar: null,
        counts: { published: 2, private: 3, total: 5 },
      });
      expect(res.body.limits).toEqual(cdn.limits());
    });

    it('résout l’avatar via le dépôt Media quand avatarMediaId est présent', async () => {
      const avatarId = randomUUID();
      accounts.seed({ avatarMediaId: avatarId });
      media.seed({ id: avatarId, status: 'ready' } as Media);
      const res = await http().get('/api/profile').set('x-user', OWNER_ID).expect(200);
      expect(res.body.avatar).toEqual({
        id: avatarId,
        status: 'ready',
        base: `cdn/${avatarId}`,
        srcSet: null,
        poster: null,
        hls: null,
        thumbhash: null,
      });
    });
  });

  describe('PATCH /', () => {
    it('met à jour une bio valide', async () => {
      const res = await http().patch('/api/profile').set('x-user', OWNER_ID).send({ bio: 'Comtesse de Lovelace' }).expect(200);
      expect(res.body).toEqual({ bio: 'Comtesse de Lovelace' });
      expect(accounts.update).toHaveBeenCalledWith({ id: OWNER_ID }, { bio: 'Comtesse de Lovelace' });
      expect(accounts.peek(OWNER_ID).bio).toBe('Comtesse de Lovelace');
    });

    it('refuse une bio de plus de 160 caractères → 400 BIO_TOO_LONG', async () => {
      const res = await http()
        .patch('/api/profile')
        .set('x-user', OWNER_ID)
        .send({ bio: 'a'.repeat(161) })
        .expect(400);
      expect(res.body.message).toContain('BIO_TOO_LONG');
    });

    it('renvoie { bio: null } pour une bio vide', async () => {
      const res = await http().patch('/api/profile').set('x-user', OWNER_ID).send({ bio: '' }).expect(200);
      expect(res.body).toEqual({ bio: null });
    });

    it('renvoie { bio: null } quand la bio est absente', async () => {
      const res = await http().patch('/api/profile').set('x-user', OWNER_ID).send({}).expect(200);
      expect(res.body).toEqual({ bio: null });
    });
  });

  describe('GET /media', () => {
    it('mappe les items et calcule nextCursor quand il y a une page suivante', async () => {
      const rows = [
        { id: 'a', kind: 'image', visibility: 'public', width: 100, height: 200, durationMs: null },
        { id: 'b', kind: 'image', visibility: 'private', width: 300, height: 400, durationMs: null },
        { id: 'c', kind: 'video', visibility: 'public', width: 500, height: 600, durationMs: 4000 },
      ] as unknown as Media[];
      media.many = rows;
      const res = await http().get('/api/profile/media').query({ limit: '2' }).set('x-user', OWNER_ID).expect(200);
      expect(res.body.items).toHaveLength(2);
      expect(res.body.items[0]).toEqual({
        id: 'a',
        kind: 'image',
        visibility: 'public',
        width: 100,
        height: 200,
        durationMs: null,
        base: 'cdn/a',
        srcSet: null,
        poster: null,
        hls: null,
        thumbhash: null,
      });
      expect(res.body.nextCursor).toBe('2');
    });

    it('renvoie nextCursor null quand tous les résultats tiennent dans la page', async () => {
      media.many = [{ id: 'a', kind: 'image', visibility: 'public', width: 1, height: 1, durationMs: null }] as unknown as Media[];
      const res = await http().get('/api/profile/media').query({ limit: '2' }).set('x-user', OWNER_ID).expect(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.nextCursor).toBeNull();
    });
  });

  describe('PATCH /media/:mediaId/publish|unpublish', () => {
    it('publie un média via le CDN', async () => {
      const mediaId = randomUUID();
      const res = await http().patch(`/api/profile/media/${mediaId}/publish`).set('x-user', OWNER_ID).expect(200);
      expect(cdn.publishMedia).toHaveBeenCalledWith(OWNER_ID, mediaId);
      expect(res.body).toEqual({ id: mediaId, visibility: 'public' });
    });

    it('dépublie un média via le CDN', async () => {
      const mediaId = randomUUID();
      const res = await http().patch(`/api/profile/media/${mediaId}/unpublish`).set('x-user', OWNER_ID).expect(200);
      expect(cdn.unpublishMedia).toHaveBeenCalledWith(OWNER_ID, mediaId);
      expect(res.body).toEqual({ id: mediaId, visibility: 'private' });
    });
  });

  describe('POST /avatar', () => {
    it('refuse un fichier trop lourd → 400 FILE_TOO_LARGE', async () => {
      const res = await http()
        .post('/api/profile/avatar')
        .set('x-user', OWNER_ID)
        .send({ contentType: 'image/jpeg', contentLength: MEDIA_LIMITS.AVATAR_MAX_BYTES + 1 })
        .expect(400);
      expect(res.body.code).toBe('FILE_TOO_LARGE');
      expect(cdn.createUpload).not.toHaveBeenCalled();
    });

    it('crée un upload avatar valide', async () => {
      const res = await http().post('/api/profile/avatar').set('x-user', OWNER_ID).send({ contentType: 'image/jpeg', contentLength: 1024 }).expect(201);
      expect(cdn.createUpload).toHaveBeenCalledWith(expect.objectContaining({ ownerId: OWNER_ID, contentType: 'image/jpeg', contentLength: 1024, purpose: 'avatar' }));
      expect(res.body).toMatchObject({ strategy: 'post', mediaId: 'm' });
    });
  });

  describe('POST /avatar/:mediaId/complete', () => {
    it('met à jour avatarMediaId quand l’upload est un avatar', async () => {
      const mediaId = randomUUID();
      cdn.completeUpload.mockResolvedValueOnce({ id: mediaId, purpose: 'avatar', status: 'ready' });
      const res = await http().post(`/api/profile/avatar/${mediaId}/complete`).set('x-user', OWNER_ID).expect(200);
      expect(accounts.update).toHaveBeenCalledWith({ id: OWNER_ID }, { avatarMediaId: mediaId });
      expect(res.body).toEqual({ id: mediaId, status: 'ready' });
    });

    it('refuse un média qui n’est pas un avatar → 400 NOT_AN_AVATAR', async () => {
      const mediaId = randomUUID();
      cdn.completeUpload.mockResolvedValueOnce({ id: mediaId, purpose: 'content', status: 'ready' });
      const res = await http().post(`/api/profile/avatar/${mediaId}/complete`).set('x-user', OWNER_ID).expect(400);
      expect(res.body).toEqual({ code: 'NOT_AN_AVATAR' });
      expect(accounts.update).not.toHaveBeenCalled();
    });
  });

  describe('POST /cdn-session', () => {
    it('émet les cookies de lecture CDN', async () => {
      const res = await http().post('/api/profile/cdn-session').set('x-user', OWNER_ID).expect(200);
      expect(cdn.issueReadCookies).toHaveBeenCalledWith(OWNER_ID);
      expect(res.body).toEqual({ success: true, expires_in: 3600 });
      const setCookie = (res.headers['set-cookie'] ?? []) as unknown as string[];
      expect(setCookie.some((c) => c.startsWith('CloudFront-Policy='))).toBe(true);
    });
  });
});
