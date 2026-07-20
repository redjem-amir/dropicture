// dropicture/apps/saas/backend/src/specs/profile.controller.spec.ts
import { BadRequestException, CanActivate, ExecutionContext, INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import type { Request } from 'express';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { ProfileController } from '../controllers/profile.controller';
import { MediaService } from '../services/media.service';
import { Account } from '../models/account.entity';
import { Media } from '../models/media.entity';

const SITE = 'http://localhost:3000';
const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const MEDIA_A = '22222222-2222-4222-8222-222222222222';

type Lazy<T> = T | (() => T);
const unwrap = <T>(v: Lazy<T>): T => (typeof v === 'function' ? (v as () => T)() : v);

type QbTerminals = {
  getRawMany?: Lazy<unknown>;
  getRawOne?: Lazy<unknown>;
  getMany?: Lazy<unknown>;
};

const makeQb = (terminals: QbTerminals) => {
  const qb: Record<string, jest.Mock> = {};
  const chain = ['select', 'addSelect', 'where', 'andWhere', 'orWhere', 'groupBy', 'orderBy', 'addOrderBy', 'limit', 'offset', 'take', 'skip', 'innerJoin', 'leftJoin'];
  for (const m of chain) qb[m] = jest.fn(() => qb);
  const defaults: Required<QbTerminals> = { getRawMany: [], getRawOne: null, getMany: [] };
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
    update: jest.fn(async () => ({ affected: 1 })),
    createQueryBuilder: jest.fn(() => makeQb(repo._qb)),
  };
  return repo;
};

const mediaService = {
  view: jest.fn((m: { id: string; mimeType?: string; width?: number | null; height?: number | null; durationMs?: number | null }) => ({
    id: m.id,
    mimeType: m.mimeType ?? 'image/jpeg',
    width: m.width ?? null,
    height: m.height ?? null,
    durationMs: m.durationMs ?? null,
    url: `cdn/${m.id}`,
  })),
  limits: jest.fn(() => ({
    image: { maxBytes: 8388608 },
    video: { maxBytes: 104857600 },
    avatar: { maxBytes: 8388608, accepted: ['image/jpeg', 'image/png', 'image/webp'] },
    accepted: ['image/jpeg', 'image/png', 'video/mp4'],
  })),
  upload: jest.fn(async (_p: unknown) => ({
    id: 'new-avatar',
    ownerId: OWNER_ID,
    role: 'avatar',
    mimeType: 'image/jpeg',
    width: null,
    height: null,
    durationMs: null,
  })),
  unpublish: jest.fn(async (_owner: string, ids: string[]) => ids),
  destroy: jest.fn(async (_owner: string, ids: string[]) => ids),
};

describe('ProfileController /api/profile', () => {
  let app: INestApplication;
  let accounts: ReturnType<typeof makeRepo>;
  let media: ReturnType<typeof makeRepo>;

  const http = () => request(app.getHttpServer());
  const auth = (req: request.Test) => req.set('x-user', OWNER_ID);

  const account = {
    id: OWNER_ID,
    username: 'ada_lovelace',
    firstname: 'Ada',
    lastname: 'Lovelace',
    bio: null as string | null,
    avatarMediaId: null as string | null,
  };

  beforeAll(async () => {
    accounts = makeRepo();
    media = makeRepo();

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
        { provide: MediaService, useValue: mediaService },
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
    jest.clearAllMocks();
    for (const repo of [accounts, media]) {
      repo.find.mockResolvedValue([]);
      repo.findOne.mockResolvedValue(null);
      repo.count.mockResolvedValue(0);
      repo.update.mockResolvedValue({ affected: 1 });
      repo._qb = {};
    }
    accounts.findOne.mockResolvedValue({ ...account });
    mediaService.upload.mockImplementation(async (_p: unknown) => ({
      id: 'new-avatar',
      ownerId: OWNER_ID,
      role: 'avatar',
      mimeType: 'image/jpeg',
      width: null,
      height: null,
      durationMs: null,
    }));
    mediaService.unpublish.mockImplementation(async (_o: string, ids: string[]) => ids);
    mediaService.destroy.mockImplementation(async (_o: string, ids: string[]) => ids);
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
      accounts.findOne.mockResolvedValue(null);
      const res = await auth(http().get('/api/profile')).expect(404);
      expect(res.body).toEqual({ code: 'ACCOUNT_NOT_FOUND' });
    });

    it('renvoie le profil, les compteurs et les limites', async () => {
      media.count.mockResolvedValueOnce(2).mockResolvedValueOnce(3);
      media._qb = { getRawOne: { first: new Date('2026-01-01T00:00:00.000Z') } };
      const res = await auth(http().get('/api/profile')).expect(200);
      expect(res.body).toMatchObject({
        username: 'ada_lovelace',
        firstname: 'Ada',
        lastname: 'Lovelace',
        bio: null,
        publicUrl: `${SITE}/u/?u=ada_lovelace`,
        avatar: null,
        counts: { published: 2, inLibrary: 3 },
        firstPublishedAt: '2026-01-01T00:00:00.000Z',
      });
      expect(res.body.limits).toEqual(mediaService.limits());
    });

    it('résout l’avatar via le dépôt Media quand avatarMediaId est présent', async () => {
      accounts.findOne.mockResolvedValue({ ...account, avatarMediaId: 'av-1' });
      media.findOne.mockResolvedValue({
        id: 'av-1',
        mimeType: 'image/png',
        width: 128,
        height: 128,
        durationMs: null,
      });
      const res = await auth(http().get('/api/profile')).expect(200);
      expect(res.body.avatar).toEqual({
        id: 'av-1',
        mimeType: 'image/png',
        width: 128,
        height: 128,
        durationMs: null,
        url: 'cdn/av-1',
      });
      expect(media.findOne).toHaveBeenCalledWith({
        where: { id: 'av-1', ownerId: OWNER_ID },
      });
    });
  });

  describe('PATCH /', () => {
    it('met à jour une bio valide', async () => {
      const res = await auth(http().patch('/api/profile')).send({ bio: '  Comtesse de Lovelace  ' }).expect(200);
      expect(res.body).toEqual({ bio: 'Comtesse de Lovelace' });
      expect(accounts.update).toHaveBeenCalledWith({ id: OWNER_ID }, { bio: 'Comtesse de Lovelace' });
    });

    it('refuse une bio de plus de 160 caractères → 400 BIO_TOO_LONG', async () => {
      const res = await auth(http().patch('/api/profile'))
        .send({ bio: 'a'.repeat(161) })
        .expect(400);
      expect(res.body.message).toContain('BIO_TOO_LONG');
    });

    it('renvoie { bio: null } pour une bio vide', async () => {
      const res = await auth(http().patch('/api/profile')).send({ bio: '' }).expect(200);
      expect(res.body).toEqual({ bio: null });
      expect(accounts.update).toHaveBeenCalledWith({ id: OWNER_ID }, { bio: null });
    });

    it('renvoie { bio: null } quand la bio est absente', async () => {
      const res = await auth(http().patch('/api/profile')).send({}).expect(200);
      expect(res.body).toEqual({ bio: null });
    });

    it('renvoie 404 si le compte a disparu', async () => {
      accounts.update.mockResolvedValue({ affected: 0 });
      const res = await auth(http().patch('/api/profile')).send({ bio: 'x' }).expect(404);
      expect(res.body).toEqual({ code: 'ACCOUNT_NOT_FOUND' });
    });
  });

  describe('GET /media', () => {
    it('mappe les items publiés et calcule nextCursor', async () => {
      const first = new Date('2026-06-03T00:00:00.000Z');
      media._qb = {
        getMany: [
          { id: 'a', mimeType: 'image/jpeg', width: 100, height: 200, durationMs: null, publishedAt: first },
          { id: 'b', mimeType: 'image/jpeg', width: 300, height: 400, durationMs: null, publishedAt: new Date('2026-06-02T00:00:00.000Z') },
        ],
      };
      const res = await auth(http().get('/api/profile/media').query({ limit: '1' })).expect(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0]).toEqual({
        id: 'a',
        mimeType: 'image/jpeg',
        width: 100,
        height: 200,
        durationMs: null,
        url: 'cdn/a',
        publishedAt: first.toISOString(),
      });
      expect(Buffer.from(res.body.nextCursor as string, 'base64url').toString('utf8')).toBe(`${first.toISOString()}|a`);
    });

    it('renvoie nextCursor null quand tout tient dans la page', async () => {
      media._qb = {
        getMany: [{ id: 'a', mimeType: 'image/jpeg', publishedAt: new Date('2026-06-03T00:00:00.000Z') }],
      };
      const res = await auth(http().get('/api/profile/media').query({ limit: '2' })).expect(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.nextCursor).toBeNull();
    });

    it('400 BAD_CURSOR pour un curseur illisible', async () => {
      const cursor = Buffer.from('nawak|a').toString('base64url');
      const res = await auth(http().get(`/api/profile/media?cursor=${cursor}`)).expect(400);
      expect(res.body).toEqual({ code: 'BAD_CURSOR' });
    });
  });

  describe('PATCH /media/unpublish', () => {
    it('dépublie en lot via MediaService.unpublish', async () => {
      const res = await auth(http().patch('/api/profile/media/unpublish'))
        .send({ ids: [MEDIA_A] })
        .expect(200);
      expect(mediaService.unpublish).toHaveBeenCalledWith(OWNER_ID, [MEDIA_A]);
      expect(res.body).toEqual({ done: [MEDIA_A], failed: [] });
    });

    it('classe un média absent dans failed avec MEDIA_NOT_FOUND', async () => {
      mediaService.unpublish.mockResolvedValueOnce([]);
      media.find.mockResolvedValue([]);
      const res = await auth(http().patch('/api/profile/media/unpublish'))
        .send({ ids: [MEDIA_A] })
        .expect(200);
      expect(res.body).toEqual({ done: [], failed: [{ id: MEDIA_A, code: 'MEDIA_NOT_FOUND' }] });
    });

    it('classe un avatar dans failed avec AVATAR_ALWAYS_PUBLIC', async () => {
      mediaService.unpublish.mockResolvedValueOnce([]);
      media.find.mockResolvedValue([{ id: MEDIA_A, role: 'avatar', publishedAt: new Date() }]);
      const res = await auth(http().patch('/api/profile/media/unpublish'))
        .send({ ids: [MEDIA_A] })
        .expect(200);
      expect(res.body.failed).toEqual([{ id: MEDIA_A, code: 'AVATAR_ALWAYS_PUBLIC' }]);
    });

    it('classe un média déjà privé dans failed avec ALREADY_PRIVATE', async () => {
      mediaService.unpublish.mockResolvedValueOnce([]);
      media.find.mockResolvedValue([{ id: MEDIA_A, role: 'content', publishedAt: null }]);
      const res = await auth(http().patch('/api/profile/media/unpublish'))
        .send({ ids: [MEDIA_A] })
        .expect(200);
      expect(res.body.failed).toEqual([{ id: MEDIA_A, code: 'ALREADY_PRIVATE' }]);
    });

    it('refuse un identifiant non-uuid → 400', async () => {
      await auth(http().patch('/api/profile/media/unpublish'))
        .send({ ids: ['pas-un-uuid'] })
        .expect(400);
    });
  });

  describe('POST /avatar', () => {
    it('refuse une requête sans content-type → 400 UNSUPPORTED_MEDIA_TYPE', async () => {
      const res = await auth(http().post('/api/profile/avatar')).unset('Content-Type').expect(400);
      expect(res.body).toEqual({ code: 'UNSUPPORTED_MEDIA_TYPE' });
      expect(mediaService.upload).not.toHaveBeenCalled();
    });

    it('téléverse l’avatar, met à jour avatarMediaId et renvoie la vue', async () => {
      const res = await auth(http().post('/api/profile/avatar')).set('Content-Type', 'image/jpeg').send('binarydata').expect(201);
      expect(mediaService.upload).toHaveBeenCalledWith(expect.objectContaining({ ownerId: OWNER_ID, role: 'avatar', mimeType: 'image/jpeg' }));
      expect(accounts.update).toHaveBeenCalledWith({ id: OWNER_ID }, { avatarMediaId: 'new-avatar' });
      expect(res.body).toEqual({
        id: 'new-avatar',
        mimeType: 'image/jpeg',
        width: null,
        height: null,
        durationMs: null,
        url: 'cdn/new-avatar',
      });
    });

    it('supprime les anciens avatars via MediaService.destroy', async () => {
      const staleId = randomUUID();
      media.find.mockResolvedValue([{ id: staleId }]);
      await auth(http().post('/api/profile/avatar')).set('Content-Type', 'image/jpeg').send('binarydata').expect(201);
      expect(mediaService.destroy).toHaveBeenCalledWith(OWNER_ID, [staleId]);
    });

    it('propage l’erreur d’upload → 400 FILE_TOO_LARGE', async () => {
      mediaService.upload.mockRejectedValueOnce(new BadRequestException({ code: 'FILE_TOO_LARGE' }));
      const res = await auth(http().post('/api/profile/avatar')).set('Content-Type', 'image/jpeg').send('binarydata').expect(400);
      expect(res.body.code).toBe('FILE_TOO_LARGE');
      expect(accounts.update).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /avatar', () => {
    it('détache et supprime les avatars', async () => {
      const staleId = randomUUID();
      media.find.mockResolvedValue([{ id: staleId }]);
      const res = await auth(http().delete('/api/profile/avatar')).expect(200);
      expect(res.body).toEqual({ avatar: null });
      expect(accounts.update).toHaveBeenCalledWith({ id: OWNER_ID }, { avatarMediaId: null });
      expect(mediaService.destroy).toHaveBeenCalledWith(OWNER_ID, [staleId]);
    });

    it('renvoie 404 si le compte est absent', async () => {
      accounts.findOne.mockResolvedValue(null);
      const res = await auth(http().delete('/api/profile/avatar')).expect(404);
      expect(res.body).toEqual({ code: 'ACCOUNT_NOT_FOUND' });
    });
  });
});
