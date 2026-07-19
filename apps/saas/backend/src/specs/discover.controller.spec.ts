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
import { CdnService } from '../services/cdn.service';
import { Account } from '../models/account.entity';
import { Media } from '../models/media.entity';
import { Gallery } from '../models/gallery.entity';
import { GalleryMedia } from '../models/gallery-media.entity';
import { Follow } from '../models/follow.entity';

const VIEWER_ID = '11111111-1111-1111-1111-111111111111';

type Lazy<T> = T | (() => T);

const unwrap = <T>(v: Lazy<T>): T => (typeof v === 'function' ? (v as () => T)() : v);

const queue = <T>(values: T[], fallback: T) => {
  const pending = [...values];
  return () => (pending.length ? (pending.shift() as T) : fallback);
};

type QbTerminals = {
  getRawMany?: Lazy<unknown>;
  getRawOne?: Lazy<unknown>;
  getCount?: Lazy<number>;
  getMany?: Lazy<unknown>;
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
  ];
  for (const m of chain) qb[m] = jest.fn(() => qb);
  const defaults: Required<QbTerminals> = {
    getRawMany: [],
    getRawOne: null,
    getCount: 0,
    getMany: [],
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

const cdn = {
  urlsFor: (m: { id: string }) => ({
    base: `cdn/${m.id}`,
    avif: `cdn/${m.id}/image.avif`,
    webp: `cdn/${m.id}/image.webp`,
    poster: null,
    video: null,
    thumbhash: null,
  }),
};

describe('DiscoverController — /api/discover', () => {
  let app: INestApplication;
  let accounts: ReturnType<typeof makeRepo>;
  let media: ReturnType<typeof makeRepo>;
  let galleries: ReturnType<typeof makeRepo>;
  let galleryMedia: ReturnType<typeof makeRepo>;
  let follows: ReturnType<typeof makeRepo>;

  const http = () => request(app.getHttpServer());
  const asViewer = (req: request.Test) => req.set('x-user', VIEWER_ID);

  beforeAll(async () => {
    accounts = makeRepo();
    media = makeRepo();
    galleries = makeRepo();
    galleryMedia = makeRepo();
    follows = makeRepo();
    const moduleRef = await Test.createTestingModule({
      controllers: [DiscoverController],
      providers: [
        { provide: CdnService, useValue: cdn },
        { provide: getRepositoryToken(Account), useValue: accounts },
        { provide: getRepositoryToken(Media), useValue: media },
        { provide: getRepositoryToken(Gallery), useValue: galleries },
        { provide: getRepositoryToken(GalleryMedia), useValue: galleryMedia },
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
    for (const repo of [accounts, media, galleries, galleryMedia, follows]) {
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
      accounts.findOne.mockResolvedValue({ id: 'other-id', username: 'bob' });
      follows.count.mockResolvedValue(4);
      const res = await asViewer(http().post('/api/discover/follows/bob')).expect(200);
      expect(res.body).toEqual({ username: 'bob', following: true, followers: 4 });
      expect(follows.createQueryBuilder).toHaveBeenCalled();
      expect(follows.count).toHaveBeenCalledWith({ where: { followingId: 'other-id' } });
    });
  });

  describe('DELETE /follows/:username', () => {
    it('404 ACCOUNT_NOT_FOUND si le compte cible est introuvable', async () => {
      accounts.findOne.mockResolvedValue(null);
      const res = await asViewer(http().delete('/api/discover/follows/bob')).expect(404);
      expect(res.body).toEqual({ code: 'ACCOUNT_NOT_FOUND' });
    });

    it('supprime et renvoie { username, following:false, followers }', async () => {
      accounts.findOne.mockResolvedValue({ id: 'other-id', username: 'bob' });
      follows.count.mockResolvedValue(2);
      const res = await asViewer(http().delete('/api/discover/follows/bob')).expect(200);
      expect(res.body).toEqual({ username: 'bob', following: false, followers: 2 });
      expect(follows.delete).toHaveBeenCalledWith({ followerId: VIEWER_ID, followingId: 'other-id' });
    });
  });

  describe('GET /me', () => {
    it('agrège les cinq compteurs dans le bon ordre', async () => {
      galleries.count.mockResolvedValueOnce(3).mockResolvedValueOnce(2);
      media.count.mockResolvedValueOnce(10);
      follows.count.mockResolvedValueOnce(5).mockResolvedValueOnce(7);
      const res = await asViewer(http().get('/api/discover/me')).expect(200);
      expect(res.body).toEqual({ galleries: 3, publishedGalleries: 2, publishedMedia: 10, following: 5, followers: 7 });
    });
  });

  describe('GET /tags', () => {
    it('préfixe { tag:null, label:"Tout" } puis les tags libellés', async () => {
      galleries.manager.query.mockResolvedValue([{ tag: 'nature', total: '3' }]);
      galleryMedia._qb = { getCount: 12 };
      galleries._qb = { getRawMany: [{ tags: ['nature'], labels: ['Nature'] }] };
      const res = await asViewer(http().get('/api/discover/tags')).expect(200);
      expect(res.body.tags[0]).toEqual({ tag: null, label: 'Tout', total: 12 });
      expect(res.body.tags[1]).toEqual({ tag: 'nature', label: 'Nature', total: 3 });
    });
  });

  describe('GET /authors', () => {
    it('renvoie authors:[] quand le classement est vide', async () => {
      media._qb = { getRawMany: [] };
      const res = await asViewer(http().get('/api/discover/authors')).expect(200);
      expect(res.body).toEqual({ authors: [] });
    });

    it('assemble les cartes auteur { id, username, name, bio, items, followers, following, avatar }', async () => {
      media._qb = { getRawMany: [{ id: 'author-1', items: '5' }] };
      accounts.find.mockResolvedValue([{ id: 'author-1', username: 'bob', firstname: 'Bob', lastname: 'Martin', bio: 'hello', avatarMediaId: 'av-1' }]);
      media.find.mockResolvedValue([{ id: 'av-1', status: 'ready' }]);
      follows.find.mockResolvedValue([]);
      follows._qb = { getRawMany: [{ id: 'author-1', total: '10' }] };
      const res = await asViewer(http().get('/api/discover/authors')).expect(200);
      expect(res.body.authors).toEqual([
        {
          id: 'author-1',
          username: 'bob',
          name: 'Bob Martin',
          bio: 'hello',
          items: 5,
          followers: 10,
          following: false,
          avatar: { base: 'cdn/av-1', avif: 'cdn/av-1/image.avif', webp: 'cdn/av-1/image.webp' },
        },
      ]);
    });
  });

  describe('GET /feed', () => {
    it('retour anticipé { items:[], nextCursor:null } quand scope=following sans abonnement', async () => {
      follows.find.mockResolvedValue([]);
      const res = await asViewer(http().get('/api/discover/feed?scope=following')).expect(200);
      expect(res.body).toEqual({ items: [], nextCursor: null });
    });

    it('mappe les items et calcule nextCursor', async () => {
      const mediaEntity = { id: 'm1', kind: 'image', width: 800, height: 600, durationMs: null };
      const rawRow = {
        m_id: 'm1',
        g_id: 'g1',
        g_title: 'Trip',
        g_slug: 'trip',
        g_tags: ['Nature'],
        g_owner: 'author-1',
        g_published: new Date('2026-01-01T00:00:00.000Z'),
      };
      media._qb = { getRawMany: queue<unknown>([[rawRow], [{ id: 'author-1', total: '3' }]], []) };
      media.find.mockResolvedValueOnce([mediaEntity]);
      accounts.find.mockResolvedValue([{ id: 'author-1', username: 'bob', firstname: 'Bob', lastname: 'Martin', bio: null, avatarMediaId: null }]);
      follows.find.mockResolvedValue([]);
      follows._qb = { getRawMany: [] };
      const res = await asViewer(http().get('/api/discover/feed')).expect(200);
      expect(res.body.nextCursor).toBeNull();
      expect(res.body.items).toEqual([
        {
          key: 'g1:m1',
          id: 'm1',
          kind: 'image',
          width: 800,
          height: 600,
          durationMs: null,
          gallery: { id: 'g1', title: 'Trip', slug: 'trip', tags: ['Nature'] },
          author: {
            id: 'author-1',
            username: 'bob',
            name: 'Bob Martin',
            bio: null,
            items: 3,
            followers: 0,
            following: false,
            avatar: null,
          },
          base: 'cdn/m1',
          avif: 'cdn/m1/image.avif',
          webp: 'cdn/m1/image.webp',
          poster: null,
          video: null,
          thumbhash: null,
        },
      ]);
    });

    it('hydrate par identifiant : un média présent deux fois sort deux fois', async () => {
      const mediaEntity = { id: 'm1', kind: 'image', width: 800, height: 600, durationMs: null };
      const row = (galleryId: string) => ({
        m_id: 'm1',
        g_id: galleryId,
        g_title: galleryId,
        g_slug: galleryId,
        g_tags: [],
        g_owner: 'author-1',
        g_published: new Date('2026-01-01T00:00:00.000Z'),
      });
      media._qb = { getRawMany: queue<unknown>([[row('g1'), row('g2')], []], []) };
      media.find.mockResolvedValueOnce([mediaEntity]);
      accounts.find.mockResolvedValue([{ id: 'author-1', username: 'bob', firstname: 'Bob', lastname: 'Martin', bio: null, avatarMediaId: null }]);
      follows.find.mockResolvedValue([]);
      follows._qb = { getRawMany: [] };
      const res = await asViewer(http().get('/api/discover/feed')).expect(200);
      expect(res.body.items.map((i: { key: string }) => i.key)).toEqual(['g1:m1', 'g2:m1']);
      // Une seule requête d'hydratation malgré deux lignes.
      expect(media.find).toHaveBeenCalledTimes(1);
    });
  });
});
