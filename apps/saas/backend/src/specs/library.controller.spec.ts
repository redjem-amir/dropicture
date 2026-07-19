// dropicture/apps/saas/backend/src/specs/library.controller.spec.ts
import { BadRequestException, ExecutionContext, INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import type { Request } from 'express';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { LibraryController } from '../controllers/library.controller';
import { CdnService } from '../services/cdn.service';
import { Media } from '../models/media.entity';

const OWNER_ID = 'owner-1';
const MEDIA_A = '11111111-1111-4111-8111-111111111111';
const MEDIA_B = '22222222-2222-4222-8222-222222222222';

/** Constructeur de query-builder chaînable : chaque étape renvoie le même stub, terminaux configurables. */
function makeQb(terminals: { getRawMany?: unknown; getRawOne?: unknown; getMany?: unknown }) {
  const qb: Record<string, jest.Mock> = {};
  const chain = ['select', 'addSelect', 'where', 'andWhere', 'groupBy', 'addGroupBy', 'orderBy', 'addOrderBy', 'take'];
  for (const m of chain) qb[m] = jest.fn(() => qb);
  qb.getRawMany = jest.fn(async () => terminals.getRawMany ?? []);
  qb.getRawOne = jest.fn(async () => terminals.getRawOne ?? { first: null });
  qb.getMany = jest.fn(async () => terminals.getMany ?? []);
  return qb;
}

describe('LibraryController — /api/library', () => {
  let app: INestApplication;

  /** Résultats configurables du dépôt Media (par test). */
  const repoState: { findResult: Partial<Media>[]; qb: { getRawMany?: unknown; getRawOne?: unknown; getMany?: unknown } } = {
    findResult: [],
    qb: {},
  };

  const media = {
    find: jest.fn(async () => repoState.findResult),
    createQueryBuilder: jest.fn(() => makeQb(repoState.qb)),
  };

  const cdn = {
    limits: jest.fn(() => ({
      image: { maxBytes: 8388608 },
      video: { maxBytes: 1, minDurationMs: 1, maxDurationMs: 1 },
      avatar: { maxBytes: 1 },
      accepted: ['image/jpeg', 'video/mp4'],
    })),
    urlsFor: jest.fn((m: { id: string }) => ({ base: `cdn/${m.id}`, srcSet: null, poster: null, hls: null, thumbhash: null })),
    originalUrl: jest.fn(() => 'https://signed'),
    createUpload: jest.fn(async () => ({ strategy: 'post', mediaId: MEDIA_A, key: 'originals/o/m.jpg', url: 'u', fields: {}, expiresAt: 'x' })),
    completeUpload: jest.fn(async (_o: string, id: string) => ({
      id,
      purpose: 'content',
      status: 'ready',
      kind: 'image',
      visibility: 'private',
      width: 1,
      height: 1,
      durationMs: null,
      bytes: '1',
      errorCode: null,
      capturedAt: null,
      createdAt: new Date(),
    })),
    completeMultipart: jest.fn(async () => ({ size: 123 })),
    abortMultipart: jest.fn(async () => undefined),
    publishMedia: jest.fn(async (_o: string, id: string) => ({ id, visibility: 'public' })),
    unpublishMedia: jest.fn(async (_o: string, id: string) => ({ id, visibility: 'private' })),
    trashMedia: jest.fn(async () => undefined),
    destroyMedia: jest.fn(async () => undefined),
    issueReadCookies: jest.fn(() => [{ name: 'CloudFront-Policy', value: 'v', maxAge: 3600000 }]),
  };

  const http = () => request(app.getHttpServer());
  const auth = (r: request.Test) => r.set('x-user', OWNER_ID);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [LibraryController],
      providers: [
        { provide: CdnService, useValue: cdn },
        { provide: getRepositoryToken(Media), useValue: media },
      ],
    })
      .overrideGuard(AuthGuard('access-token'))
      .useValue({
        canActivate(context: ExecutionContext) {
          const req = context.switchToHttp().getRequest<Request>();
          const header = req.headers['x-user'];
          if (!header) throw new UnauthorizedException();
          req.user = { sub: Array.isArray(header) ? header[0] : header };
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
    repoState.findResult = [];
    repoState.qb = {};
  });

  afterAll(async () => {
    await app.close();
  });

  describe('authentification requise', () => {
    it('GET /summary → 401 sans en-tête x-user', async () => {
      await http().get('/api/library/summary').expect(401);
    });

    it('GET /summary → 200 avec x-user', async () => {
      const res = await auth(http().get('/api/library/summary')).expect(200);
      expect(res.body.limits).toBeDefined();
      expect(res.body.counts).toBeDefined();
    });
  });

  describe('validation BulkIdsDto (POST /status)', () => {
    it('liste vide → 400', async () => {
      await auth(http().post('/api/library/status')).send({ ids: [] }).expect(400);
    });

    it('identifiant non-uuid → 400', async () => {
      await auth(http().post('/api/library/status'))
        .send({ ids: ['pas-un-uuid'] })
        .expect(400);
    });

    it('plus de 200 identifiants → 400 TOO_MANY_ITEMS', async () => {
      const ids = Array.from({ length: 201 }, () => randomUUID());
      const res = await auth(http().post('/api/library/status')).send({ ids }).expect(400);
      expect(res.body.message).toContain('TOO_MANY_ITEMS');
    });

    it('identifiants valides → 200 avec items sérialisés', async () => {
      repoState.findResult = [
        {
          id: MEDIA_A,
          kind: 'image',
          status: 'ready',
          visibility: 'private',
          width: 1,
          height: 1,
          durationMs: null,
          bytes: '1',
          errorCode: null,
          capturedAt: null,
          createdAt: new Date(),
        } as unknown as Media,
      ];
      const res = await auth(http().post('/api/library/status'))
        .send({ ids: [MEDIA_A] })
        .expect(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].id).toBe(MEDIA_A);
      expect(cdn.urlsFor).toHaveBeenCalled();
    });
  });

  describe('validation CreateUploadDto (POST /uploads)', () => {
    it('contentType hors MIME → 400 UNSUPPORTED_MEDIA_TYPE', async () => {
      const res = await auth(http().post('/api/library/uploads')).send({ contentType: 'application/zip', contentLength: 10 }).expect(400);
      expect(res.body.message).toContain('UNSUPPORTED_MEDIA_TYPE');
    });

    it('contentLength < 1 → 400', async () => {
      await auth(http().post('/api/library/uploads')).send({ contentType: 'image/jpeg', contentLength: 0 }).expect(400);
    });

    it('payload valide → renvoie le ticket createUpload avec purpose:content', async () => {
      const res = await auth(http().post('/api/library/uploads')).send({ contentType: 'image/jpeg', contentLength: 1000 }).expect(201);
      expect(res.body).toEqual({ strategy: 'post', mediaId: MEDIA_A, key: 'originals/o/m.jpg', url: 'u', fields: {}, expiresAt: 'x' });
      expect(cdn.createUpload).toHaveBeenCalledTimes(1);
      expect(cdn.createUpload).toHaveBeenCalledWith(expect.objectContaining({ ownerId: OWNER_ID, contentType: 'image/jpeg', contentLength: 1000, purpose: 'content' }));
    });
  });

  describe('actions groupées', () => {
    const cases: [string, 'patch' | 'post', string, keyof typeof cdn][] = [
      ['publish', 'patch', '/api/library/publish', 'publishMedia'],
      ['unpublish', 'patch', '/api/library/unpublish', 'unpublishMedia'],
      ['trash', 'post', '/api/library/trash', 'trashMedia'],
      ['destroy', 'post', '/api/library/destroy', 'destroyMedia'],
    ];

    it.each(cases)('%s : tous réussissent → done rempli, failed vide', async (_name, method, path, cdnMethod) => {
      const res = await auth(http()[method](path))
        .send({ ids: [MEDIA_A, MEDIA_B] })
        .expect(200);
      expect(res.body).toEqual({ done: [MEDIA_A, MEDIA_B], failed: [] });
      expect(cdn[cdnMethod]).toHaveBeenCalledTimes(2);
      expect(cdn[cdnMethod]).toHaveBeenCalledWith(OWNER_ID, MEDIA_A);
      expect(cdn[cdnMethod]).toHaveBeenCalledWith(OWNER_ID, MEDIA_B);
    });

    it.each(cases)('%s : un identifiant en échec atterrit dans failed avec son code', async (_name, method, path, cdnMethod) => {
      (cdn[cdnMethod] as jest.Mock).mockRejectedValueOnce(new BadRequestException({ code: 'MEDIA_NOT_READY' }));
      const res = await auth(http()[method](path))
        .send({ ids: [MEDIA_A, MEDIA_B] })
        .expect(200);
      expect(res.body.done).toEqual([MEDIA_B]);
      expect(res.body.failed).toEqual([{ id: MEDIA_A, code: 'MEDIA_NOT_READY' }]);
    });
  });

  describe('POST /download', () => {
    it('aucun média trouvé → 404 MEDIA_NOT_FOUND', async () => {
      repoState.findResult = [];
      const res = await auth(http().post('/api/library/download'))
        .send({ ids: [MEDIA_A] })
        .expect(404);
      expect(res.body).toEqual({ code: 'MEDIA_NOT_FOUND' });
    });

    it('média trouvé → items { id, filename, url } via cdn.originalUrl', async () => {
      repoState.findResult = [{ id: MEDIA_A, ext: 'jpg' } as unknown as Media];
      const res = await auth(http().post('/api/library/download'))
        .send({ ids: [MEDIA_A] })
        .expect(200);
      expect(res.body.items).toEqual([{ id: MEDIA_A, filename: `${MEDIA_A}.jpg`, url: 'https://signed' }]);
      expect(cdn.originalUrl).toHaveBeenCalled();
    });
  });

  describe('POST /uploads/:mediaId/complete', () => {
    it('média content → renvoie le média sérialisé', async () => {
      const res = await auth(http().post(`/api/library/uploads/${MEDIA_A}/complete`)).expect(200);
      expect(res.body.id).toBe(MEDIA_A);
      expect(res.body.status).toBe('ready');
      expect(res.body).toHaveProperty('base', `cdn/${MEDIA_A}`);
      expect(cdn.completeUpload).toHaveBeenCalledWith(OWNER_ID, MEDIA_A);
    });

    it('média avatar → 400 NOT_A_LIBRARY_MEDIA', async () => {
      cdn.completeUpload.mockResolvedValueOnce({
        id: MEDIA_A,
        purpose: 'avatar',
        status: 'ready',
        kind: 'image',
        visibility: 'public',
        width: 1,
        height: 1,
        durationMs: null,
        bytes: '1',
        errorCode: null,
        capturedAt: null,
        createdAt: new Date(),
      });
      const res = await auth(http().post(`/api/library/uploads/${MEDIA_A}/complete`)).expect(400);
      expect(res.body).toEqual({ code: 'NOT_A_LIBRARY_MEDIA' });
    });
  });

  describe('POST /uploads/:mediaId/multipart/complete', () => {
    it('clé n’appartenant pas au propriétaire → 400 BAD_KEY', async () => {
      const res = await auth(http().post(`/api/library/uploads/${MEDIA_A}/multipart/complete`))
        .send({ key: 'originals/other/xxxx.jpg', uploadId: 'up-1', parts: [{ partNumber: 1, etag: 'e1' }] })
        .expect(400);
      expect(res.body).toEqual({ code: 'BAD_KEY' });
      expect(cdn.completeMultipart).not.toHaveBeenCalled();
    });

    it('clé correcte → 200 { key, size }', async () => {
      const key = `originals/${OWNER_ID}/${MEDIA_A}.jpg`;
      const res = await auth(http().post(`/api/library/uploads/${MEDIA_A}/multipart/complete`))
        .send({ key, uploadId: 'up-1', parts: [{ partNumber: 1, etag: 'e1' }] })
        .expect(200);
      expect(res.body).toEqual({ key, size: '123' });
      expect(cdn.completeMultipart).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /uploads/:mediaId/multipart/abort', () => {
    it('clé n’appartenant pas au propriétaire → 400 BAD_KEY', async () => {
      const res = await auth(http().post(`/api/library/uploads/${MEDIA_A}/multipart/abort`))
        .send({ key: 'originals/other/xxxx.jpg', uploadId: 'up-1' })
        .expect(400);
      expect(res.body).toEqual({ code: 'BAD_KEY' });
      expect(cdn.abortMultipart).not.toHaveBeenCalled();
    });

    it('clé correcte → 200 { success:true }', async () => {
      const key = `originals/${OWNER_ID}/${MEDIA_A}.jpg`;
      const res = await auth(http().post(`/api/library/uploads/${MEDIA_A}/multipart/abort`))
        .send({ key, uploadId: 'up-1' })
        .expect(200);
      expect(res.body).toEqual({ success: true });
      expect(cdn.abortMultipart).toHaveBeenCalledWith(key, 'up-1');
    });
  });

  describe('POST /cdn-session', () => {
    it('émet les cookies de lecture et renvoie expires_in', async () => {
      const res = await auth(http().post('/api/library/cdn-session')).expect(200);
      expect(res.body).toEqual({ success: true, expires_in: 3600 });
      expect(typeof res.body.expires_in).toBe('number');
      expect(res.headers['set-cookie']).toBeDefined();
      expect(cdn.issueReadCookies).toHaveBeenCalledWith(OWNER_ID);
    });
  });
});
