// dropicture/apps/saas/backend/src/specs/library.controller.spec.ts
import { ExecutionContext, INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import type { Request } from 'express';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { LibraryController } from '../controllers/library.controller';
import { MediaService, extOf } from '../services/media.service';
import { Media } from '../models/media.entity';
import { Album } from '../models/album.entity';
import { Placement } from '../models/placement.entity';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const MEDIA_A = '22222222-2222-4222-8222-222222222222';
const MEDIA_B = '33333333-3333-4333-8333-333333333333';
const ALBUM_ID = '44444444-4444-4444-8444-444444444444';

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
    getMany: [],
    getOne: null,
    getCount: 0,
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
    save: jest.fn(async (entity: Record<string, unknown>) => entity),
    create: jest.fn((dto: Record<string, unknown>) => ({ ...dto })),
    update: jest.fn(async () => ({ affected: 1 })),
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
  limits: jest.fn(() => ({
    image: { maxBytes: 8388608 },
    video: { maxBytes: 104857600 },
    avatar: { maxBytes: 8388608, accepted: ['image/jpeg', 'image/png', 'image/webp'] },
    accepted: ['image/jpeg', 'image/png', 'video/mp4'],
  })),
  upload: jest.fn(async (_p: unknown) => ({
    id: 'up-1',
    ownerId: OWNER_ID,
    role: 'content',
    mimeType: 'image/jpeg',
    bytes: '1000',
    width: null,
    height: null,
    durationMs: null,
    capturedAt: null,
    publishedAt: null,
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
  })),
  publish: jest.fn(async (_owner: string, ids: string[]) => ids),
  unpublish: jest.fn(async (_owner: string, ids: string[]) => ids),
  destroy: jest.fn(async (_owner: string, ids: string[]) => ids),
};

describe('LibraryController /api/library', () => {
  let app: INestApplication;
  let media: ReturnType<typeof makeRepo>;
  let albums: ReturnType<typeof makeRepo>;
  let placements: ReturnType<typeof makeRepo>;

  const http = () => request(app.getHttpServer());
  const auth = (req: request.Test) => req.set('x-user', OWNER_ID);

  beforeAll(async () => {
    media = makeRepo();
    albums = makeRepo();
    placements = makeRepo();

    const moduleRef = await Test.createTestingModule({
      controllers: [LibraryController],
      providers: [
        { provide: MediaService, useValue: mediaService },
        { provide: getRepositoryToken(Media), useValue: media },
        { provide: getRepositoryToken(Album), useValue: albums },
        { provide: getRepositoryToken(Placement), useValue: placements },
      ],
    })
      .overrideGuard(AuthGuard('access-token'))
      .useValue({
        canActivate(ctx: ExecutionContext) {
          const req = ctx.switchToHttp().getRequest<Request>();
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
    jest.clearAllMocks();
    for (const repo of [media, albums, placements]) {
      repo.find.mockResolvedValue([]);
      repo.findOne.mockResolvedValue(null);
      repo.count.mockResolvedValue(0);
      repo.update.mockResolvedValue({ affected: 1 });
      repo.delete.mockResolvedValue({ affected: 1 });
      repo.manager.query.mockResolvedValue([]);
      repo._qb = {};
    }
    mediaService.upload.mockImplementation(async (_p: unknown) => ({
      id: 'up-1',
      ownerId: OWNER_ID,
      role: 'content',
      mimeType: 'image/jpeg',
      bytes: '1000',
      width: null,
      height: null,
      durationMs: null,
      capturedAt: null,
      publishedAt: null,
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
    }));
    mediaService.publish.mockImplementation(async (_o: string, ids: string[]) => ids);
    mediaService.unpublish.mockImplementation(async (_o: string, ids: string[]) => ids);
    mediaService.destroy.mockImplementation(async (_o: string, ids: string[]) => ids);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('authentification requise', () => {
    it('GET /summary → 401 sans en-tête x-user', async () => {
      await http().get('/api/library/summary').expect(401);
    });
  });

  describe('POST /uploads (corps brut)', () => {
    it('sans Content-Type → 400 UNSUPPORTED_MEDIA_TYPE', async () => {
      const res = await auth(http().post('/api/library/uploads')).unset('Content-Type').expect(400);
      expect(res.body).toEqual({ code: 'UNSUPPORTED_MEDIA_TYPE' });
      expect(mediaService.upload).not.toHaveBeenCalled();
    });

    it('délègue à media.upload et renvoie l’item de bibliothèque', async () => {
      const res = await auth(http().post('/api/library/uploads')).set('Content-Type', 'image/jpeg').send('data').expect(201);
      expect(res.body).toEqual({
        id: 'up-1',
        mimeType: 'image/jpeg',
        width: null,
        height: null,
        durationMs: null,
        url: 'cdn/up-1',
        bytes: '1000',
        takenAt: '2026-06-01T00:00:00.000Z',
        published: false,
      });
      expect(mediaService.upload).toHaveBeenCalledWith(expect.objectContaining({ ownerId: OWNER_ID, role: 'content', mimeType: 'image/jpeg' }));
    });

    it('nettoie les paramètres du Content-Type composite', async () => {
      await auth(http().post('/api/library/uploads')).set('Content-Type', 'image/jpeg; charset=binary').send('data').expect(201);
      expect(mediaService.upload).toHaveBeenCalledWith(expect.objectContaining({ mimeType: 'image/jpeg' }));
    });

    it('transmet les métadonnées facultatives (w/h/d/takenAt)', async () => {
      await auth(http().post('/api/library/uploads?w=4032&h=3024&d=5000&takenAt=2026-01-01T00:00:00.000Z')).set('Content-Type', 'image/jpeg').send('data').expect(201);
      expect(mediaService.upload).toHaveBeenCalledWith(
        expect.objectContaining({
          width: 4032,
          height: 3024,
          durationMs: 5000,
          capturedAt: new Date('2026-01-01T00:00:00.000Z'),
        }),
      );
    });

    it('ignore une date de prise de vue future ou invalide', async () => {
      const future = new Date(Date.now() + 86_400_000).toISOString();
      await auth(http().post(`/api/library/uploads?takenAt=${future}`))
        .set('Content-Type', 'image/jpeg')
        .send('data')
        .expect(201);
      expect(mediaService.upload).toHaveBeenCalledWith(expect.objectContaining({ capturedAt: null }));
    });

    it('place le média dans l’album quand ?album= est fourni', async () => {
      albums.findOne.mockResolvedValue({ id: ALBUM_ID, ownerId: OWNER_ID });
      placements._qb = { getRawOne: { max: '4' } };
      await auth(http().post(`/api/library/uploads?album=${ALBUM_ID}`))
        .set('Content-Type', 'image/jpeg')
        .send('data')
        .expect(201);
      expect(placements.createQueryBuilder).toHaveBeenCalled();
    });
  });

  describe('GET /summary', () => {
    it('agrège compteurs, octets, mois et limites', async () => {
      media._qb = {
        getRawOne: queue<unknown>([{ total: '3', bytes: '3000' }, { first: new Date('2026-01-01T00:00:00.000Z') }], null),
        getRawMany: [{ month: '2026-06', total: '2' }],
      };
      media.count.mockResolvedValue(2);
      const res = await auth(http().get('/api/library/summary')).expect(200);
      expect(res.body.counts).toEqual({ private: 3, published: 2 });
      expect(res.body.bytes).toBe('3000');
      expect(res.body.months).toEqual([{ month: '2026-06', total: 2 }]);
      expect(res.body.firstAt).toBe('2026-01-01T00:00:00.000Z');
      expect(res.body.limits).toBeDefined();
      expect(mediaService.limits).toHaveBeenCalled();
    });

    it('renvoie des valeurs neutres quand la bibliothèque est vide', async () => {
      const res = await auth(http().get('/api/library/summary')).expect(200);
      expect(res.body.counts).toEqual({ private: 0, published: 0 });
      expect(res.body.bytes).toBe('0');
      expect(res.body.months).toEqual([]);
      expect(res.body.firstAt).toBeNull();
    });
  });

  describe('GET / (liste paginée par curseur)', () => {
    it('sérialise les items et renvoie nextCursor null sans page suivante', async () => {
      media._qb = {
        getMany: [
          {
            id: MEDIA_A,
            mimeType: 'image/jpeg',
            width: 800,
            height: 600,
            durationMs: null,
            bytes: '2000',
            capturedAt: null,
            publishedAt: null,
            createdAt: new Date('2026-05-01T00:00:00.000Z'),
          },
        ],
      };
      const res = await auth(http().get('/api/library/')).expect(200);
      expect(res.body.nextCursor).toBeNull();
      expect(res.body.items).toEqual([
        {
          id: MEDIA_A,
          mimeType: 'image/jpeg',
          width: 800,
          height: 600,
          durationMs: null,
          url: `cdn/${MEDIA_A}`,
          bytes: '2000',
          takenAt: '2026-05-01T00:00:00.000Z',
          published: false,
        },
      ]);
    });

    it('encode nextCursor quand une page supplémentaire existe (limit=1)', async () => {
      media._qb = {
        getMany: [
          { id: MEDIA_A, mimeType: 'image/jpeg', bytes: '1', capturedAt: null, publishedAt: null, createdAt: new Date('2026-05-02T00:00:00.000Z') },
          { id: MEDIA_B, mimeType: 'image/jpeg', bytes: '1', capturedAt: null, publishedAt: null, createdAt: new Date('2026-05-01T00:00:00.000Z') },
        ],
      };
      const res = await auth(http().get('/api/library/?limit=1')).expect(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].id).toBe(MEDIA_A);
      expect(Buffer.from(res.body.nextCursor as string, 'base64url').toString('utf8')).toBe(`2026-05-02T00:00:00.000Z|${MEDIA_A}`);
    });

    it('404 ALBUM_NOT_FOUND quand ?album= cible un album inconnu', async () => {
      albums.findOne.mockResolvedValue(null);
      const res = await auth(http().get(`/api/library/?album=${ALBUM_ID}`)).expect(404);
      expect(res.body).toEqual({ code: 'ALBUM_NOT_FOUND' });
    });

    it('400 BAD_CURSOR pour un curseur illisible', async () => {
      const cursor = Buffer.from('pas-une-date|x').toString('base64url');
      const res = await auth(http().get(`/api/library/?cursor=${cursor}`)).expect(400);
      expect(res.body).toEqual({ code: 'BAD_CURSOR' });
    });
  });

  describe('validation BulkIdsDto', () => {
    it('POST /download avec liste vide → 400 NO_MEDIA', async () => {
      const res = await auth(http().post('/api/library/download')).send({ ids: [] }).expect(400);
      expect(res.body.message).toContain('NO_MEDIA');
    });

    it('PATCH /publish avec identifiant non-uuid → 400', async () => {
      await auth(http().patch('/api/library/publish'))
        .send({ ids: ['pas-un-uuid'] })
        .expect(400);
    });

    it('DELETE /media avec plus de 200 identifiants → 400 TOO_MANY_ITEMS', async () => {
      const ids = Array.from({ length: 201 }, () => randomUUID());
      const res = await auth(http().delete('/api/library/media')).send({ ids }).expect(400);
      expect(res.body.message).toContain('TOO_MANY_ITEMS');
    });
  });

  describe('POST /download', () => {
    it('aucun média trouvé → 404 MEDIA_NOT_FOUND', async () => {
      media.find.mockResolvedValue([]);
      const res = await auth(http().post('/api/library/download'))
        .send({ ids: [MEDIA_A] })
        .expect(404);
      expect(res.body).toEqual({ code: 'MEDIA_NOT_FOUND' });
    });

    it('média trouvé → items { id, filename, url }', async () => {
      media.find.mockResolvedValue([{ id: MEDIA_A, mimeType: 'image/jpeg' }]);
      const res = await auth(http().post('/api/library/download'))
        .send({ ids: [MEDIA_A] })
        .expect(200);
      expect(res.body.items).toEqual([{ id: MEDIA_A, filename: `${MEDIA_A}.${extOf('image/jpeg')}`, url: `cdn/${MEDIA_A}` }]);
    });
  });

  describe('PATCH /publish et /unpublish', () => {
    it.each([
      ['publish', '/api/library/publish', 'publish' as const],
      ['unpublish', '/api/library/unpublish', 'unpublish' as const],
    ])('%s : tous réussissent → done rempli, failed vide', async (_name, path, method) => {
      const res = await auth(http().patch(path))
        .send({ ids: [MEDIA_A, MEDIA_B] })
        .expect(200);
      expect(res.body).toEqual({ done: [MEDIA_A, MEDIA_B], failed: [] });
      expect(mediaService[method]).toHaveBeenCalledTimes(1);
      expect(mediaService[method]).toHaveBeenCalledWith(OWNER_ID, [MEDIA_A, MEDIA_B]);
    });

    it('publish : un média absent atterrit dans failed avec MEDIA_NOT_FOUND', async () => {
      mediaService.publish.mockResolvedValueOnce([MEDIA_B]);
      media.find.mockResolvedValue([]);
      const res = await auth(http().patch('/api/library/publish'))
        .send({ ids: [MEDIA_A, MEDIA_B] })
        .expect(200);
      expect(res.body.done).toEqual([MEDIA_B]);
      expect(res.body.failed).toEqual([{ id: MEDIA_A, code: 'MEDIA_NOT_FOUND' }]);
    });

    it('publish : un avatar atterrit dans failed avec AVATAR_NOT_ALLOWED', async () => {
      mediaService.publish.mockResolvedValueOnce([]);
      media.find.mockResolvedValue([{ id: MEDIA_A, role: 'avatar', publishedAt: null }]);
      const res = await auth(http().patch('/api/library/publish'))
        .send({ ids: [MEDIA_A] })
        .expect(200);
      expect(res.body.failed).toEqual([{ id: MEDIA_A, code: 'AVATAR_NOT_ALLOWED' }]);
    });

    it('publish : un média déjà public atterrit dans failed avec ALREADY_PUBLIC', async () => {
      mediaService.publish.mockResolvedValueOnce([]);
      media.find.mockResolvedValue([{ id: MEDIA_A, role: 'content', publishedAt: new Date('2026-06-01T00:00:00.000Z') }]);
      const res = await auth(http().patch('/api/library/publish'))
        .send({ ids: [MEDIA_A] })
        .expect(200);
      expect(res.body.failed).toEqual([{ id: MEDIA_A, code: 'ALREADY_PUBLIC' }]);
    });

    it('unpublish : un média déjà privé atterrit dans failed avec ALREADY_PRIVATE', async () => {
      mediaService.unpublish.mockResolvedValueOnce([]);
      media.find.mockResolvedValue([{ id: MEDIA_A, role: 'content', publishedAt: null }]);
      const res = await auth(http().patch('/api/library/unpublish'))
        .send({ ids: [MEDIA_A] })
        .expect(200);
      expect(res.body.failed).toEqual([{ id: MEDIA_A, code: 'ALREADY_PRIVATE' }]);
    });
  });

  describe('DELETE /media', () => {
    it('tous réussissent → done rempli, failed vide', async () => {
      const res = await auth(http().delete('/api/library/media'))
        .send({ ids: [MEDIA_A, MEDIA_B] })
        .expect(200);
      expect(res.body).toEqual({ done: [MEDIA_A, MEDIA_B], failed: [] });
      expect(mediaService.destroy).toHaveBeenCalledWith(OWNER_ID, [MEDIA_A, MEDIA_B]);
    });

    it('un média introuvable atterrit dans failed avec MEDIA_NOT_FOUND', async () => {
      mediaService.destroy.mockResolvedValueOnce([MEDIA_B]);
      media.find.mockResolvedValue([]);
      const res = await auth(http().delete('/api/library/media'))
        .send({ ids: [MEDIA_A, MEDIA_B] })
        .expect(200);
      expect(res.body.done).toEqual([MEDIA_B]);
      expect(res.body.failed).toEqual([{ id: MEDIA_A, code: 'MEDIA_NOT_FOUND' }]);
    });
  });

  describe('albums', () => {
    it('GET /albums → [] quand aucun album', async () => {
      albums.find.mockResolvedValue([]);
      const res = await auth(http().get('/api/library/albums')).expect(200);
      expect(res.body).toEqual({ albums: [] });
    });

    it('GET /albums → totaux, compteur publié et couverture implicite', async () => {
      albums.find.mockResolvedValue([
        {
          id: ALBUM_ID,
          title: 'Voyage',
          coverMediaId: null,
          updatedAt: new Date('2026-06-01T00:00:00.000Z'),
        },
      ]);
      placements._qb = { getRawMany: [{ id: ALBUM_ID, total: '3', published: '1' }] };
      placements.manager.query.mockResolvedValue([{ albumId: ALBUM_ID, mediaId: MEDIA_A }]);
      media.find.mockResolvedValue([{ id: MEDIA_A, mimeType: 'image/jpeg' }]);

      const res = await auth(http().get('/api/library/albums')).expect(200);
      expect(res.body.albums).toEqual([
        {
          id: ALBUM_ID,
          title: 'Voyage',
          total: 3,
          published: 1,
          cover: {
            id: MEDIA_A,
            mimeType: 'image/jpeg',
            width: null,
            height: null,
            durationMs: null,
            url: `cdn/${MEDIA_A}`,
          },
          updatedAt: '2026-06-01T00:00:00.000Z',
        },
      ]);
    });

    it('POST /albums crée un album vide', async () => {
      albums.findOne.mockResolvedValue(null);
      albums.save.mockResolvedValue({
        id: ALBUM_ID,
        title: 'Voyage',
        updatedAt: new Date('2026-06-01T00:00:00.000Z'),
      });
      const res = await auth(http().post('/api/library/albums')).send({ title: '  Voyage  ' }).expect(201);
      expect(res.body).toEqual({
        id: ALBUM_ID,
        title: 'Voyage',
        total: 0,
        published: 0,
        cover: null,
        updatedAt: '2026-06-01T00:00:00.000Z',
      });
      expect(albums.create).toHaveBeenCalledWith({ ownerId: OWNER_ID, title: 'Voyage' });
    });

    it('POST /albums → 400 ALBUM_TITLE_TAKEN si le titre existe déjà', async () => {
      albums.findOne.mockResolvedValue({ id: ALBUM_ID });
      const res = await auth(http().post('/api/library/albums')).send({ title: 'Voyage' }).expect(400);
      expect(res.body).toEqual({ code: 'ALBUM_TITLE_TAKEN' });
    });

    it('POST /albums → 400 TITLE_TOO_LONG au-delà de 60 caractères', async () => {
      const res = await auth(http().post('/api/library/albums'))
        .send({ title: 'a'.repeat(61) })
        .expect(400);
      expect(res.body.message).toContain('TITLE_TOO_LONG');
    });

    it('PATCH /albums/:id renomme l’album', async () => {
      albums.findOne.mockResolvedValueOnce({ id: ALBUM_ID, ownerId: OWNER_ID, title: 'Voyage' }).mockResolvedValueOnce(null);
      albums.save.mockResolvedValue({ id: ALBUM_ID, title: 'Vacances' });
      const res = await auth(http().patch(`/api/library/albums/${ALBUM_ID}`))
        .send({ title: 'Vacances' })
        .expect(200);
      expect(res.body).toEqual({ id: ALBUM_ID, title: 'Vacances' });
    });

    it('PATCH /albums/:id → 404 ALBUM_NOT_FOUND', async () => {
      albums.findOne.mockResolvedValue(null);
      const res = await auth(http().patch(`/api/library/albums/${ALBUM_ID}`))
        .send({ title: 'Vacances' })
        .expect(404);
      expect(res.body).toEqual({ code: 'ALBUM_NOT_FOUND' });
    });

    it('POST /albums/:id/media ajoute les médias possédés', async () => {
      albums.findOne.mockResolvedValue({ id: ALBUM_ID, ownerId: OWNER_ID });
      media.find.mockResolvedValue([{ id: MEDIA_A }, { id: MEDIA_B }]);
      placements.count.mockResolvedValue(1);
      placements._qb = { getRawOne: { max: '0' } };
      const res = await auth(http().post(`/api/library/albums/${ALBUM_ID}/media`))
        .send({ ids: [MEDIA_A, MEDIA_B] })
        .expect(200);
      expect(res.body).toEqual({ added: 1, skipped: 1 });
      expect(albums.update).toHaveBeenCalledWith({ id: ALBUM_ID }, expect.objectContaining({}));
    });

    it('POST /albums/:id/media → 400 NO_MEDIA si aucun média ne appartient au viewer', async () => {
      albums.findOne.mockResolvedValue({ id: ALBUM_ID, ownerId: OWNER_ID });
      media.find.mockResolvedValue([]);
      const res = await auth(http().post(`/api/library/albums/${ALBUM_ID}/media`))
        .send({ ids: [MEDIA_A] })
        .expect(400);
      expect(res.body).toEqual({ code: 'NO_MEDIA' });
    });

    it('DELETE /albums/:id/media retire les médias et réinitialise la couverture', async () => {
      albums.findOne.mockResolvedValue({
        id: ALBUM_ID,
        ownerId: OWNER_ID,
        coverMediaId: MEDIA_A,
      });
      placements.delete.mockResolvedValue({ affected: 2 });
      const res = await auth(http().delete(`/api/library/albums/${ALBUM_ID}/media`))
        .send({ ids: [MEDIA_A, MEDIA_B] })
        .expect(200);
      expect(res.body).toEqual({ removed: 2 });
      expect(albums.update).toHaveBeenCalledWith({ id: ALBUM_ID }, { coverMediaId: null });
    });

    it('PATCH /albums/:id/cover/:mediaId → 400 NOT_IN_ALBUM si le média n’est pas placé', async () => {
      albums.findOne.mockResolvedValue({ id: ALBUM_ID, ownerId: OWNER_ID });
      placements.findOne.mockResolvedValue(null);
      const res = await auth(http().patch(`/api/library/albums/${ALBUM_ID}/cover/${MEDIA_A}`)).expect(400);
      expect(res.body).toEqual({ code: 'NOT_IN_ALBUM' });
    });

    it('PATCH /albums/:id/cover/:mediaId définit la couverture', async () => {
      albums.findOne.mockResolvedValue({ id: ALBUM_ID, ownerId: OWNER_ID });
      placements.findOne.mockResolvedValue({ albumId: ALBUM_ID, mediaId: MEDIA_A });
      const res = await auth(http().patch(`/api/library/albums/${ALBUM_ID}/cover/${MEDIA_A}`)).expect(200);
      expect(res.body).toEqual({ id: ALBUM_ID, coverMediaId: MEDIA_A });
      expect(albums.update).toHaveBeenCalledWith({ id: ALBUM_ID }, { coverMediaId: MEDIA_A });
    });

    it('DELETE /albums/:id supprime l’album', async () => {
      albums.findOne.mockResolvedValue({ id: ALBUM_ID, ownerId: OWNER_ID });
      const res = await auth(http().delete(`/api/library/albums/${ALBUM_ID}`)).expect(200);
      expect(res.body).toEqual({ success: true });
      expect(albums.delete).toHaveBeenCalledWith({ id: ALBUM_ID });
    });

    it('refuse un albumId qui n’est pas un uuid v4 → 400', async () => {
      await auth(http().delete('/api/library/albums/pas-un-uuid')).expect(400);
    });
  });
});
