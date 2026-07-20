// dropicture/apps/saas/backend/src/specs/discover.controller.spec.ts
import { ExecutionContext, INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import type { Request } from 'express';
import request from 'supertest';
import { DiscoverController } from '../controllers/discover.controller';
import { MediaService } from '../services/media.service';
import { Account } from '../models/account.entity';
import { Media } from '../models/media.entity';
import { Follow } from '../models/follow.entity';

const VIEWER_ID = '11111111-1111-4111-8111-111111111111';
const AUTHOR_ID = '22222222-2222-4222-8222-222222222222';

type Lazy<T> = T | (() => T);
const unwrap = <T>(v: Lazy<T>): T => (typeof v === 'function' ? (v as () => T)() : v);

type QbTerminals = {
  getRawMany?: Lazy<unknown>;
  getRawOne?: Lazy<unknown>;
  getCount?: Lazy<number>;
  getMany?: Lazy<unknown>;
  getOne?: Lazy<unknown>;
  execute?: Lazy<unknown>;
};

const makeQb = (terminals: QbTerminals) => {
  const qb: Record<string, jest.Mock> = {};
  const chain = [
    'select',
    'addSelect',
    'where',
    'andWhere',
    'orWhere',
    'innerJoin',
    'leftJoin',
    'groupBy',
    'orderBy',
    'addOrderBy',
    'limit',
    'offset',
    'take',
    'skip',
    'from',
    'into',
    'values',
    'orIgnore',
    'insert',
    'update',
    'set',
    'returning',
    'setParameters',
  ];
  for (const m of chain) qb[m] = jest.fn(() => qb);
  const defaults: Required<QbTerminals> = {
    getRawMany: [],
    getRawOne: null,
    getCount: 0,
    getMany: [],
    getOne: null,
    execute: { raw: [], affected: 0 },
  };
  const merged = { ...defaults, ...terminals };
  for (const key of Object.keys(defaults) as (keyof QbTerminals)[]) {
    qb[key] = jest.fn(async () => unwrap(merged[key]));
  }
  return qb;
};

const makeRepo = () => {
  const repo = {
    _qb: {} as QbTerminals,
    find: jest.fn(async () => [] as unknown[]),
    findOne: jest.fn(async () => null),
    count: jest.fn(async () => 0),
    delete: jest.fn(async () => ({ affected: 1 })),
    createQueryBuilder: jest.fn(() => makeQb(repo._qb)),
    manager: { query: jest.fn(async () => [] as unknown[]) },
  };
  return repo;
};

const mediaService = {
  view: (m: { id: string; mimeType?: string; width?: number | null; height?: number | null; durationMs?: number | null }) => ({
    id: m.id,
    mimeType: m.mimeType ?? 'image/jpeg',
    width: m.width ?? null,
    height: m.height ?? null,
    durationMs: m.durationMs ?? null,
    url: `cdn/${m.id}`,
  }),
  limits: jest.fn(() => ({})),
};

describe('DiscoverController /api/discover', () => {
  let app: INestApplication;
  let accounts: ReturnType<typeof makeRepo>;
  let media: ReturnType<typeof makeRepo>;
  let follows: ReturnType<typeof makeRepo>;

  const http = () => request(app.getHttpServer());
  const asViewer = (req: request.Test) => req.set('x-user', VIEWER_ID);

  beforeAll(async () => {
    accounts = makeRepo();
    media = makeRepo();
    follows = makeRepo();
    const moduleRef = await Test.createTestingModule({
      controllers: [DiscoverController],
      providers: [
        { provide: MediaService, useValue: mediaService },
        { provide: getRepositoryToken(Account), useValue: accounts },
        { provide: getRepositoryToken(Media), useValue: media },
        { provide: getRepositoryToken(Follow), useValue: follows },
      ],
    })
      .overrideGuard(AuthGuard('access-token'))
      .useValue({
        canActivate(context: ExecutionContext) {
          const req = context.switchToHttp().getRequest<Request>();
          const sub = req.headers['x-user'] as string | undefined;
          if (!sub) throw new UnauthorizedException();
          req.user = { sub };
          return true;
        },
      })
      .compile();
    app = moduleRef.createNestApplication({ bodyParser: false, logger: false });
    app.use(bodyParser.json({ limit: '100kb' }));
    app.use(bodyParser.urlencoded({ limit: '100kb', extended: true }));
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  beforeEach(() => {
    for (const repo of [accounts, media, follows]) {
      repo.find.mockReset().mockResolvedValue([]);
      repo.findOne.mockReset().mockResolvedValue(null);
      repo.count.mockReset().mockResolvedValue(0);
      repo.delete.mockReset().mockResolvedValue({ affected: 1 });
      repo.createQueryBuilder.mockClear();
      repo.manager.query.mockReset().mockResolvedValue([]);
      repo._qb = {};
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('authentification', () => {
    it('401 sans en-tête x-user sur GET /me', async () => {
      await http().get('/api/discover/me').expect(401);
    });

    it('401 sans en-tête x-user sur GET /feed', async () => {
      await http().get('/api/discover/feed').expect(401);
    });
  });

  describe('GET /feed', () => {
    it('renvoie { items: [], nextCursor: null } quand aucun média publié', async () => {
      media._qb = { getMany: [] };
      const res = await asViewer(http().get('/api/discover/feed')).expect(200);
      expect(res.body).toEqual({ items: [], nextCursor: null });
    });

    it('mappe les items avec leur auteur et calcule nextCursor', async () => {
      const publishedAt = new Date('2026-06-01T00:00:00.000Z');
      media._qb = {
        getMany: [
          { id: 'm1', ownerId: AUTHOR_ID, mimeType: 'image/jpeg', width: 800, height: 600, durationMs: null, publishedAt },
          { id: 'm2', ownerId: AUTHOR_ID, mimeType: 'image/jpeg', width: 800, height: 600, durationMs: null, publishedAt },
        ],
      };
      accounts.find.mockResolvedValue([{ id: AUTHOR_ID, username: 'bob', firstname: 'Bob', lastname: 'Martin', avatarMediaId: null }]);
      follows.find.mockResolvedValue([{ followingId: AUTHOR_ID }]);

      const res = await asViewer(http().get('/api/discover/feed?limit=1')).expect(200);

      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0]).toEqual({
        id: 'm1',
        mimeType: 'image/jpeg',
        width: 800,
        height: 600,
        durationMs: null,
        url: 'cdn/m1',
        publishedAt: publishedAt.toISOString(),
        mine: false,
        author: {
          username: 'bob',
          name: 'Bob Martin',
          avatar: null,
          following: true,
          self: false,
        },
      });
      expect(typeof res.body.nextCursor).toBe('string');
      expect(Buffer.from(res.body.nextCursor as string, 'base64url').toString('utf8')).toBe(`${publishedAt.toISOString()}|m1`);
    });

    it('marque mine:true et author.self:true pour les médias du viewer', async () => {
      const publishedAt = new Date('2026-06-01T00:00:00.000Z');
      media._qb = {
        getMany: [{ id: 'm1', ownerId: VIEWER_ID, mimeType: 'image/jpeg', width: null, height: null, durationMs: null, publishedAt }],
      };
      accounts.find.mockResolvedValue([{ id: VIEWER_ID, username: 'ada', firstname: 'Ada', lastname: 'Lovelace', avatarMediaId: null }]);
      const res = await asViewer(http().get('/api/discover/feed')).expect(200);
      expect(res.body.items[0].mine).toBe(true);
      expect(res.body.items[0].author.self).toBe(true);
      expect(res.body.nextCursor).toBeNull();
    });

    it('résout l’avatar de l’auteur via le dépôt Media', async () => {
      const publishedAt = new Date('2026-06-01T00:00:00.000Z');
      media._qb = {
        getMany: [{ id: 'm1', ownerId: AUTHOR_ID, mimeType: 'image/jpeg', width: null, height: null, durationMs: null, publishedAt }],
      };
      accounts.find.mockResolvedValue([{ id: AUTHOR_ID, username: 'bob', firstname: 'Bob', lastname: 'Martin', avatarMediaId: 'av-1' }]);
      media.find.mockResolvedValue([{ id: 'av-1', mimeType: 'image/png', width: 128, height: 128, durationMs: null }]);
      const res = await asViewer(http().get('/api/discover/feed')).expect(200);
      expect(res.body.items[0].author.avatar).toEqual({
        id: 'av-1',
        mimeType: 'image/png',
        width: 128,
        height: 128,
        durationMs: null,
        url: 'cdn/av-1',
      });
    });

    it('scope=following restreint aux comptes suivis (+ le viewer)', async () => {
      follows.find.mockResolvedValue([{ followingId: AUTHOR_ID }]);
      media._qb = { getMany: [] };
      const res = await asViewer(http().get('/api/discover/feed?scope=following')).expect(200);
      expect(res.body).toEqual({ items: [], nextCursor: null });
      expect(follows.find).toHaveBeenCalledWith({
        where: { followerId: VIEWER_ID },
        select: { followingId: true },
      });
    });

    it('400 BAD_CURSOR pour un curseur illisible', async () => {
      const cursor = Buffer.from('pas-une-date|m1').toString('base64url');
      const res = await asViewer(http().get(`/api/discover/feed?cursor=${cursor}`)).expect(400);
      expect(res.body).toEqual({ code: 'BAD_CURSOR' });
    });
  });

  describe('GET /me', () => {
    it('agrège les compteurs et la portée communautaire', async () => {
      media.count.mockResolvedValueOnce(10);
      follows.count.mockResolvedValueOnce(5).mockResolvedValueOnce(7);
      media._qb = { getRawOne: { authors: '12', media: '340' } };
      const res = await asViewer(http().get('/api/discover/me')).expect(200);
      expect(res.body).toEqual({
        publishedMedia: 10,
        following: 5,
        followers: 7,
        community: { authors: 12, media: 340 },
      });
    });

    it('renvoie des zéros quand l’agrégat est vide', async () => {
      const res = await asViewer(http().get('/api/discover/me')).expect(200);
      expect(res.body).toEqual({
        publishedMedia: 0,
        following: 0,
        followers: 0,
        community: { authors: 0, media: 0 },
      });
    });
  });

  describe('POST /follows/:username', () => {
    it('404 ACCOUNT_NOT_FOUND si le compte cible est introuvable', async () => {
      accounts.findOne.mockResolvedValue(null);
      const res = await asViewer(http().post('/api/discover/follows/bob')).expect(404);
      expect(res.body).toEqual({ code: 'ACCOUNT_NOT_FOUND' });
    });

    it('400 CANNOT_FOLLOW_SELF si la cible est le viewer', async () => {
      accounts.findOne.mockResolvedValue({ id: VIEWER_ID, username: 'me' });
      const res = await asViewer(http().post('/api/discover/follows/me')).expect(400);
      expect(res.body).toEqual({ code: 'CANNOT_FOLLOW_SELF' });
    });

    it('insère et renvoie { username, following:true, followers }', async () => {
      accounts.findOne.mockResolvedValue({ id: AUTHOR_ID, username: 'bob' });
      follows.count.mockResolvedValue(4);
      const res = await asViewer(http().post('/api/discover/follows/bob')).expect(200);
      expect(res.body).toEqual({ username: 'bob', following: true, followers: 4 });
      expect(follows.createQueryBuilder).toHaveBeenCalled();
      expect(follows.count).toHaveBeenCalledWith({ where: { followingId: AUTHOR_ID } });
    });
  });

  describe('DELETE /follows/:username', () => {
    it('404 ACCOUNT_NOT_FOUND si le compte cible est introuvable', async () => {
      accounts.findOne.mockResolvedValue(null);
      const res = await asViewer(http().delete('/api/discover/follows/bob')).expect(404);
      expect(res.body).toEqual({ code: 'ACCOUNT_NOT_FOUND' });
    });

    it('supprime et renvoie { username, following:false, followers }', async () => {
      accounts.findOne.mockResolvedValue({ id: AUTHOR_ID, username: 'bob' });
      follows.count.mockResolvedValue(2);
      const res = await asViewer(http().delete('/api/discover/follows/bob')).expect(200);
      expect(res.body).toEqual({ username: 'bob', following: false, followers: 2 });
      expect(follows.delete).toHaveBeenCalledWith({
        followerId: VIEWER_ID,
        followingId: AUTHOR_ID,
      });
    });
  });
});
