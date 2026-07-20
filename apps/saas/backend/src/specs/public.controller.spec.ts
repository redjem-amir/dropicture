// dropicture/apps/saas/backend/src/specs/public.controller.spec.ts
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { PublicController } from '../controllers/public.controller';
import { MediaService } from '../services/media.service';
import { Account } from '../models/account.entity';
import { Media } from '../models/media.entity';
import { Follow } from '../models/follow.entity';

type Lazy<T> = T | (() => T);
const unwrap = <T>(v: Lazy<T>): T => (typeof v === 'function' ? (v as () => T)() : v);
const queue = <T>(values: T[], fallback: T): (() => T) => {
  const pending = [...values];
  return () => (pending.length ? (pending.shift() as T) : fallback);
};

type QbTerminals = {
  getRawMany?: Lazy<unknown>;
  getRawOne?: Lazy<unknown>;
  getMany?: Lazy<unknown>;
  getOne?: Lazy<unknown>;
  getCount?: Lazy<number>;
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
    'innerJoinAndSelect',
    'groupBy',
    'orderBy',
    'addOrderBy',
    'limit',
    'offset',
    'take',
    'skip',
    'setParameter',
    'setParameters',
  ];
  for (const m of chain) qb[m] = jest.fn(() => qb);
  const defaults: Required<QbTerminals> = {
    getRawMany: [],
    getRawOne: null,
    getMany: [],
    getOne: null,
    getCount: 0,
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
    createQueryBuilder: jest.fn(() => makeQb(repo._qb)),
    manager: { query: jest.fn(async () => [] as unknown[]) },
  };
  return repo;
};

const view = (m: { id: string; mimeType?: string; width?: number | null; height?: number | null; durationMs?: number | null }) => ({
  id: m.id,
  mimeType: m.mimeType ?? 'image/jpeg',
  width: m.width ?? null,
  height: m.height ?? null,
  durationMs: m.durationMs ?? null,
  url: `cdn/${m.id}`,
});

const mediaService = { view };

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';

describe('PublicController /api/public', () => {
  let app: INestApplication;
  let accounts: ReturnType<typeof makeRepo>;
  let media: ReturnType<typeof makeRepo>;
  let follows: ReturnType<typeof makeRepo>;

  const http = () => request(app.getHttpServer());

  const seededAccount = {
    id: ACCOUNT_ID,
    username: 'ada_lovelace',
    firstname: 'Ada',
    lastname: 'Lovelace',
    bio: 'Comtesse de Lovelace',
    avatarMediaId: null as string | null,
  };

  beforeAll(async () => {
    accounts = makeRepo();
    media = makeRepo();
    follows = makeRepo();

    const moduleRef = await Test.createTestingModule({
      controllers: [PublicController],
      providers: [
        { provide: MediaService, useValue: mediaService },
        { provide: getRepositoryToken(Account), useValue: accounts },
        { provide: getRepositoryToken(Media), useValue: media },
        { provide: getRepositoryToken(Follow), useValue: follows },
      ],
    }).compile();

    app = moduleRef.createNestApplication({ bodyParser: false, logger: false });
    app.use(bodyParser.json({ limit: '100kb' }));
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    for (const repo of [accounts, media, follows]) {
      repo.find.mockResolvedValue([]);
      repo.findOne.mockResolvedValue(null);
      repo.count.mockResolvedValue(0);
      repo.manager.query.mockResolvedValue([]);
      repo._qb = {};
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /stats', () => {
    it('renvoie des zéros quand rien n’est publié', async () => {
      const res = await http().get('/api/public/stats').expect(200);
      expect(res.body).toEqual({ media: 0, authors: 0 });
    });

    it('convertit les agrégats en nombres', async () => {
      media._qb = { getRawOne: { media: '42', authors: '7' } };
      const res = await http().get('/api/public/stats').expect(200);
      expect(res.body).toEqual({ media: 42, authors: 7 });
    });
  });

  describe('GET /search', () => {
    it('renvoie un résultat vide pour un terme vide', async () => {
      const res = await http().get('/api/public/search').expect(200);
      expect(res.body).toEqual({ term: '', profiles: [] });
      expect(accounts.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('normalise le terme (arobase, casse, espaces)', async () => {
      const res = await http().get('/api/public/search?q=%20%40ADA%20').expect(200);
      expect(res.body.term).toBe('ada');
    });

    it('mappe les profils trouvés', async () => {
      accounts._qb = {
        getRawMany: [
          {
            id: ACCOUNT_ID,
            username: 'ada_lovelace',
            firstname: 'Ada',
            lastname: 'Lovelace',
            bio: 'Comtesse',
            avatarMediaId: 'av-1',
            photos: '12',
          },
        ],
      };
      media.find.mockResolvedValue([{ id: 'av-1', mimeType: 'image/png', width: 64, height: 64 }]);
      const res = await http().get('/api/public/search?q=ada').expect(200);
      expect(res.body).toEqual({
        term: 'ada',
        profiles: [
          {
            username: 'ada_lovelace',
            name: 'Ada Lovelace',
            bio: 'Comtesse',
            avatar: view({ id: 'av-1', mimeType: 'image/png', width: 64, height: 64 }),
            photos: 12,
          },
        ],
      });
    });
  });

  describe('GET /profiles', () => {
    it('renvoie profiles:[] quand le classement est vide', async () => {
      const res = await http().get('/api/public/profiles').expect(200);
      expect(res.body).toEqual({ profiles: [] });
    });

    it('assemble les cartes de profil avec aperçus et abonnés', async () => {
      const last = new Date('2026-06-01T00:00:00.000Z');
      media._qb = { getRawMany: [{ id: ACCOUNT_ID, total: '5', last }] };
      accounts.find.mockResolvedValue([{ ...seededAccount, avatarMediaId: 'av-1' }]);
      follows._qb = { getRawMany: [{ id: ACCOUNT_ID, total: '3' }] };
      media.manager.query.mockResolvedValue([{ id: 'm1', ownerId: ACCOUNT_ID }]);
      media.find.mockResolvedValue([
        { id: 'm1', mimeType: 'image/jpeg', width: 800, height: 600 },
        { id: 'av-1', mimeType: 'image/png', width: 64, height: 64 },
      ]);

      const res = await http().get('/api/public/profiles').expect(200);
      expect(res.body.profiles).toEqual([
        {
          username: 'ada_lovelace',
          name: 'Ada Lovelace',
          bio: 'Comtesse de Lovelace',
          avatar: view({ id: 'av-1', mimeType: 'image/png', width: 64, height: 64 }),
          counts: { photos: 5, followers: 3 },
          lastPublishedAt: last.toISOString(),
          preview: [view({ id: 'm1', mimeType: 'image/jpeg', width: 800, height: 600 })],
        },
      ]);
    });
  });

  describe('GET /feed', () => {
    it('renvoie { items: [], nextCursor: null } quand rien n’est publié', async () => {
      const res = await http().get('/api/public/feed').expect(200);
      expect(res.body).toEqual({ items: [], nextCursor: null });
    });

    it('mappe les items avec leur auteur et pose un nextCursor', async () => {
      const publishedAt = new Date('2026-06-03T00:00:00.000Z');
      media._qb = {
        getMany: [
          { id: 'm1', ownerId: ACCOUNT_ID, mimeType: 'image/jpeg', width: 800, height: 600, publishedAt },
          { id: 'm2', ownerId: ACCOUNT_ID, mimeType: 'image/jpeg', publishedAt: new Date('2026-06-02T00:00:00.000Z') },
        ],
      };
      accounts.find.mockResolvedValue([seededAccount]);
      const res = await http().get('/api/public/feed?limit=1').expect(200);
      expect(res.body.items).toEqual([
        {
          ...view({ id: 'm1', mimeType: 'image/jpeg', width: 800, height: 600 }),
          publishedAt: publishedAt.toISOString(),
          author: { username: 'ada_lovelace', name: 'Ada Lovelace' },
        },
      ]);
      expect(Buffer.from(res.body.nextCursor as string, 'base64url').toString('utf8')).toBe(`${publishedAt.toISOString()}|m1`);
    });

    it('400 BAD_CURSOR pour un curseur illisible', async () => {
      const cursor = Buffer.from('nawak|m1').toString('base64url');
      const res = await http().get(`/api/public/feed?cursor=${cursor}`).expect(400);
      expect(res.body).toEqual({ code: 'BAD_CURSOR' });
    });
  });

  describe('GET /:username', () => {
    it('404 ACCOUNT_NOT_FOUND pour un username invalide (espace)', async () => {
      const res = await http()
        .get('/api/public/' + encodeURIComponent('ada lovelace'))
        .expect(404);
      expect(res.body).toEqual({ code: 'ACCOUNT_NOT_FOUND' });
      expect(accounts.findOne).not.toHaveBeenCalled();
    });

    it('404 ACCOUNT_NOT_FOUND pour un username trop long (>30)', async () => {
      const res = await http()
        .get('/api/public/' + 'a'.repeat(31))
        .expect(404);
      expect(res.body).toEqual({ code: 'ACCOUNT_NOT_FOUND' });
    });

    it('404 ACCOUNT_NOT_FOUND pour un username valide mais inconnu', async () => {
      const res = await http().get('/api/public/inconnu').expect(404);
      expect(res.body).toEqual({ code: 'ACCOUNT_NOT_FOUND' });
    });

    it('renvoie le profil public : compteurs, avatar et première publication', async () => {
      accounts.findOne.mockResolvedValue({ ...seededAccount, avatarMediaId: 'av-1' });
      media.count.mockResolvedValue(2);
      follows.count.mockResolvedValue(3);
      media._qb = { getRawOne: { first: new Date('2026-01-01T00:00:00.000Z') } };
      media.findOne.mockResolvedValue({ id: 'av-1', mimeType: 'image/png', width: 64, height: 64 });

      const res = await http().get('/api/public/ada_lovelace').expect(200);
      expect(res.body).toEqual({
        username: 'ada_lovelace',
        name: 'Ada Lovelace',
        bio: 'Comtesse de Lovelace',
        avatar: view({ id: 'av-1', mimeType: 'image/png', width: 64, height: 64 }),
        counts: { photos: 2, followers: 3 },
        firstPublishedAt: '2026-01-01T00:00:00.000Z',
      });
    });
  });

  describe('GET /:username/media', () => {
    it('404 ACCOUNT_NOT_FOUND pour un compte inconnu', async () => {
      const res = await http().get('/api/public/inconnu/media').expect(404);
      expect(res.body).toEqual({ code: 'ACCOUNT_NOT_FOUND' });
    });

    it('mappe les items et pose un nextCursor quand il y a une page suivante', async () => {
      accounts.findOne.mockResolvedValue(seededAccount);
      media._qb = {
        getMany: [
          { id: 'm1', mimeType: 'image/jpeg', width: 800, height: 600, durationMs: null, publishedAt: new Date('2026-06-03T00:00:00.000Z') },
          { id: 'm2', mimeType: 'video/mp4', width: 1920, height: 1080, durationMs: 5000, publishedAt: new Date('2026-06-02T00:00:00.000Z') },
          { id: 'm3', mimeType: 'image/jpeg', width: 640, height: 480, durationMs: null, publishedAt: new Date('2026-06-01T00:00:00.000Z') },
        ],
      };
      const res = await http().get('/api/public/ada_lovelace/media?limit=2').expect(200);
      expect(res.body.items).toHaveLength(2);
      expect(res.body.items[0]).toEqual({
        ...view({ id: 'm1', mimeType: 'image/jpeg', width: 800, height: 600 }),
        publishedAt: '2026-06-03T00:00:00.000Z',
      });
      expect(res.body.items[1]).toEqual({
        ...view({ id: 'm2', mimeType: 'video/mp4', width: 1920, height: 1080, durationMs: 5000 }),
        publishedAt: '2026-06-02T00:00:00.000Z',
      });
      expect(res.body.nextCursor).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('renvoie nextCursor null quand il n’y a pas de page suivante', async () => {
      accounts.findOne.mockResolvedValue(seededAccount);
      media._qb = {
        getMany: queue<unknown>(
          [
            [
              { id: 'm1', mimeType: 'image/jpeg', publishedAt: new Date('2026-06-03T00:00:00.000Z') },
              { id: 'm2', mimeType: 'image/jpeg', publishedAt: new Date('2026-06-02T00:00:00.000Z') },
            ],
          ],
          [],
        ),
      };
      const res = await http().get('/api/public/ada_lovelace/media?limit=2').expect(200);
      expect(res.body.items).toHaveLength(2);
      expect(res.body.nextCursor).toBeNull();
    });
  });
});
