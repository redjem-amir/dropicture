// dropicture/apps/saas/backend/src/specs/gallery.controller.spec.ts
import { ExecutionContext, INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import type { Request } from 'express';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { GalleryController } from '../controllers/gallery.controller';
import { CdnService } from '../services/cdn.service';
import { Gallery } from '../models/gallery.entity';
import { GalleryMedia } from '../models/gallery-media.entity';
import { Media } from '../models/media.entity';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const GALLERY_ID = '22222222-2222-4222-8222-222222222222';
const MEDIA_A = '33333333-3333-4333-8333-333333333333';
const MEDIA_B = '44444444-4444-4444-8444-444444444444';

function isNullOperator(value: unknown): boolean {
  return !!value && typeof value === 'object' && (value as { _type?: string })._type === 'isNull';
}

class FakeGalleries {
  readonly rows = new Map<string, Gallery>();

  seed(overrides: Partial<Gallery> = {}): Gallery {
    const row = {
      id: GALLERY_ID,
      ownerId: OWNER_ID,
      title: 'Vacances',
      slug: 'vacances',
      tags: [],
      tagLabels: [],
      visibility: 'private',
      coverMediaId: null,
      publishedAt: null,
      deletedAt: null,
      updatedAt: new Date(),
      createdAt: new Date(),
      ...overrides,
    } as Gallery;
    this.rows.set(row.id, row);
    return row;
  }

  create(dto: Partial<Gallery>): Gallery {
    return { id: randomUUID(), tags: [], tagLabels: [], ...dto } as Gallery;
  }

  async save(gallery: Gallery) {
    this.rows.set(gallery.id, gallery);
    return gallery;
  }

  async find({ where }: { where?: Record<string, unknown>; order?: unknown } = {}) {
    return [...this.rows.values()].filter((row) => this.matches(row, where));
  }

  async findOne({ where, select }: { where?: Record<string, unknown>; select?: Record<string, boolean> } = {}) {
    const row = [...this.rows.values()].find((r) => this.matches(r, where));
    if (!row) return null;
    if (select) {
      const kept = Object.entries(select).filter(([, on]) => on);
      return Object.fromEntries(kept.map(([col]) => [col, (row as unknown as Record<string, unknown>)[col]]));
    }
    return row;
  }

  private matches(row: Gallery, where?: Record<string, unknown>): boolean {
    if (!where) return false;
    return Object.entries(where).every(([key, value]) => {
      const cell = (row as unknown as Record<string, unknown>)[key];
      if (isNullOperator(value)) return cell === null || cell === undefined;
      return cell === value;
    });
  }
}

class FakeQueryBuilder {
  raw = {
    getRawOne: undefined as unknown,
    getRawMany: [] as unknown[],
    getMany: [] as unknown[],
    execute: {} as unknown,
  };

  select() {
    return this;
  }
  addSelect() {
    return this;
  }
  where() {
    return this;
  }
  andWhere() {
    return this;
  }
  orWhere() {
    return this;
  }
  groupBy() {
    return this;
  }
  orderBy() {
    return this;
  }
  addOrderBy() {
    return this;
  }
  innerJoin() {
    return this;
  }
  leftJoin() {
    return this;
  }
  insert() {
    return this;
  }
  into() {
    return this;
  }
  values() {
    return this;
  }
  orIgnore() {
    return this;
  }
  async getRawOne() {
    return this.raw.getRawOne;
  }
  async getRawMany() {
    return this.raw.getRawMany;
  }
  async getMany() {
    return this.raw.getMany;
  }
  async execute() {
    return this.raw.execute;
  }
}

class FakeGalleryMedia {
  findResult: GalleryMedia[] = [];
  builder = new FakeQueryBuilder();
  delete = jest.fn(async () => ({ affected: 0 }));
  manager = {
    transaction: jest.fn(async (cb: (trx: { update: jest.Mock }) => Promise<unknown>) => cb({ update: jest.fn() })),
  };

  async find() {
    return this.findResult;
  }

  createQueryBuilder() {
    return this.builder;
  }
}

class FakeMedia {
  findResult: Media[] = [];

  async find() {
    return this.findResult;
  }
}

describe('GalleryController — /api/galleries', () => {
  let app: INestApplication;
  let galleries: FakeGalleries;
  let galleryMedia: FakeGalleryMedia;
  let media: FakeMedia;

  const cdn = {
    urlsFor: (m: Media) => ({
      base: `cdn/${m.id}`,
      avif: `cdn/${m.id}/image.avif`,
      webp: `cdn/${m.id}/image.webp`,
      poster: null,
      video: null,
      thumbhash: null,
    }),
    publishMany: jest.fn(async (_o: string, ids: string[]) => ids),
    unpublishMany: jest.fn(async (_o: string, ids: string[]) => ids),
  };

  const http = () => request(app.getHttpServer());
  const auth = (req: request.Test) => req.set('x-user', OWNER_ID);

  beforeAll(async () => {
    galleries = new FakeGalleries();
    galleryMedia = new FakeGalleryMedia();
    media = new FakeMedia();

    const moduleRef = await Test.createTestingModule({
      controllers: [GalleryController],
      providers: [
        { provide: CdnService, useValue: cdn },
        { provide: getRepositoryToken(Gallery), useValue: galleries },
        { provide: getRepositoryToken(GalleryMedia), useValue: galleryMedia },
        { provide: getRepositoryToken(Media), useValue: media },
      ],
    })
      .overrideGuard(AuthGuard('access-token'))
      .useValue({
        canActivate(ctx: ExecutionContext) {
          const req = ctx.switchToHttp().getRequest<Request>();
          const sub = req.headers['x-user'] as string | undefined;
          if (!sub) {
            throw new UnauthorizedException();
          }
          req.user = { sub };
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication({ bodyParser: false, logger: false });
    app.use(bodyParser.json({ limit: '100kb' }));
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  beforeEach(() => {
    galleries.rows.clear();
    galleryMedia.findResult = [];
    galleryMedia.builder = new FakeQueryBuilder();
    galleryMedia.delete.mockClear();
    galleryMedia.manager.transaction.mockClear();
    media.findResult = [];
    cdn.publishMany.mockClear();
    cdn.unpublishMany.mockClear();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('authentification requise', () => {
    it('renvoie 401 sans en-tête x-user', async () => {
      await http().get('/api/galleries').expect(401);
    });
  });

  describe('POST / — validation (CreateGalleryDto)', () => {
    it('refuse un titre vide → 400 TITLE_REQUIRED', async () => {
      const res = await auth(http().post('/api/galleries')).send({ title: '' }).expect(400);
      expect(res.body.message).toContain('TITLE_REQUIRED');
    });

    it('refuse un titre de plus de 60 caractères → 400 TITLE_TOO_LONG', async () => {
      const res = await auth(http().post('/api/galleries'))
        .send({ title: 'x'.repeat(61) })
        .expect(400);
      expect(res.body.message).toContain('TITLE_TOO_LONG');
    });

    it('refuse plus de 5 tags → 400 TOO_MANY_TAGS', async () => {
      const res = await auth(http().post('/api/galleries'))
        .send({ title: 'Album', tags: ['a', 'b', 'c', 'd', 'e', 'f'] })
        .expect(400);
      expect(res.body.message).toContain('TOO_MANY_TAGS');
    });

    it('refuse un mediaId non-uuid → 400', async () => {
      const res = await auth(http().post('/api/galleries'))
        .send({ title: 'Album', mediaIds: ['pas-un-uuid'] })
        .expect(400);
      expect(Array.isArray(res.body.message)).toBe(true);
    });
  });

  describe('appartenance / introuvable', () => {
    it('GET /:id renvoie 404 GALLERY_NOT_FOUND si absente', async () => {
      const res = await auth(http().get(`/api/galleries/${GALLERY_ID}`)).expect(404);
      expect(res.body).toEqual({ code: 'GALLERY_NOT_FOUND' });
    });

    it('PATCH /:id renvoie 404 GALLERY_NOT_FOUND si absente', async () => {
      const res = await auth(http().patch(`/api/galleries/${GALLERY_ID}`))
        .send({ title: 'Nouveau' })
        .expect(404);
      expect(res.body).toEqual({ code: 'GALLERY_NOT_FOUND' });
    });

    it('DELETE /:id renvoie 404 GALLERY_NOT_FOUND si absente', async () => {
      const res = await auth(http().delete(`/api/galleries/${GALLERY_ID}`)).expect(404);
      expect(res.body).toEqual({ code: 'GALLERY_NOT_FOUND' });
    });
  });

  describe('POST / — création', () => {
    it('crée une galerie privée vide et calcule le slug depuis le titre', async () => {
      const res = await auth(http().post('/api/galleries')).send({ title: 'Mon Été 2026' }).expect(201);
      expect(res.body).toEqual({
        id: expect.any(String),
        title: 'Mon Été 2026',
        slug: 'mon-ete-2026',
        tags: [],
        visibility: 'private',
        total: 0,
      });
      expect(galleries.rows.get(res.body.id)?.slug).toBe('mon-ete-2026');
      expect(cdn.publishMany).not.toHaveBeenCalled();
    });
  });

  describe('POST /:id/media', () => {
    it('publie en lot les médias ajoutés à une galerie déjà publique', async () => {
      galleries.seed({ visibility: 'public' });
      media.findResult = [{ id: MEDIA_A }, { id: MEDIA_B }] as Media[];
      const res = await auth(http().post(`/api/galleries/${GALLERY_ID}/media`))
        .send({ ids: [MEDIA_A, MEDIA_B] })
        .expect(200);
      expect(res.body).toEqual({ added: 2, visibility: 'public' });
      expect(cdn.publishMany).toHaveBeenCalledTimes(1);
      expect(cdn.publishMany).toHaveBeenCalledWith(OWNER_ID, [MEDIA_A, MEDIA_B]);
    });

    it('ne publie rien quand la galerie est privée', async () => {
      galleries.seed({ visibility: 'private' });
      media.findResult = [{ id: MEDIA_A }] as Media[];
      await auth(http().post(`/api/galleries/${GALLERY_ID}/media`))
        .send({ ids: [MEDIA_A] })
        .expect(200);
      expect(cdn.publishMany).not.toHaveBeenCalled();
    });
  });

  describe('POST /:id/publish', () => {
    it('renvoie 400 GALLERY_EMPTY si la galerie ne contient aucun média', async () => {
      galleries.seed({ visibility: 'private' });
      galleryMedia.findResult = [];
      const res = await auth(http().post(`/api/galleries/${GALLERY_ID}/publish`)).expect(400);
      expect(res.body).toEqual({ code: 'GALLERY_EMPTY' });
      expect(cdn.publishMany).not.toHaveBeenCalled();
    });

    it('publie en un seul lot et renseigne publishedAt + couverture', async () => {
      galleries.seed({ visibility: 'private' });
      galleryMedia.findResult = [
        { galleryId: GALLERY_ID, mediaId: MEDIA_A, position: 0 },
        { galleryId: GALLERY_ID, mediaId: MEDIA_B, position: 1 },
      ] as GalleryMedia[];
      const res = await auth(http().post(`/api/galleries/${GALLERY_ID}/publish`)).expect(200);
      expect(res.body).toEqual({ id: GALLERY_ID, visibility: 'public', published: 2, skipped: [] });
      expect(cdn.publishMany).toHaveBeenCalledTimes(1);
      const row = galleries.rows.get(GALLERY_ID);
      expect(row?.visibility).toBe('public');
      expect(row?.publishedAt).toBeInstanceOf(Date);
      expect(row?.coverMediaId).toBe(MEDIA_A);
    });

    it('renvoie 400 NOTHING_PUBLISHABLE si aucun média n’est prêt', async () => {
      galleries.seed({ visibility: 'private' });
      galleryMedia.findResult = [{ galleryId: GALLERY_ID, mediaId: MEDIA_A, position: 0 }] as GalleryMedia[];
      cdn.publishMany.mockResolvedValueOnce([]);
      const res = await auth(http().post(`/api/galleries/${GALLERY_ID}/publish`)).expect(400);
      expect(res.body).toEqual({ code: 'NOTHING_PUBLISHABLE' });
      expect(galleries.rows.get(GALLERY_ID)?.visibility).toBe('private');
    });

    it('liste dans skipped les médias non publiables', async () => {
      galleries.seed({ visibility: 'private' });
      galleryMedia.findResult = [
        { galleryId: GALLERY_ID, mediaId: MEDIA_A, position: 0 },
        { galleryId: GALLERY_ID, mediaId: MEDIA_B, position: 1 },
      ] as GalleryMedia[];
      cdn.publishMany.mockResolvedValueOnce([MEDIA_B]);
      const res = await auth(http().post(`/api/galleries/${GALLERY_ID}/publish`)).expect(200);
      expect(res.body.published).toBe(1);
      expect(res.body.skipped).toEqual([MEDIA_A]);
      expect(galleries.rows.get(GALLERY_ID)?.coverMediaId).toBe(MEDIA_B);
    });
  });

  describe('POST /:id/unpublish', () => {
    it('repasse la galerie en privé', async () => {
      galleries.seed({ visibility: 'public' });
      galleryMedia.findResult = [];
      const res = await auth(http().post(`/api/galleries/${GALLERY_ID}/unpublish`)).expect(200);
      expect(res.body).toEqual({ id: GALLERY_ID, visibility: 'private' });
      expect(galleries.rows.get(GALLERY_ID)?.visibility).toBe('private');
      expect(cdn.unpublishMany).toHaveBeenCalledWith(OWNER_ID, []);
    });

    it('ne dépublie pas un média encore exposé par une autre galerie publique', async () => {
      galleries.seed({ visibility: 'public' });
      galleryMedia.findResult = [
        { galleryId: GALLERY_ID, mediaId: MEDIA_A, position: 0 },
        { galleryId: GALLERY_ID, mediaId: MEDIA_B, position: 1 },
      ] as GalleryMedia[];
      galleryMedia.builder.raw.getRawMany = [{ mediaId: MEDIA_A }];
      await auth(http().post(`/api/galleries/${GALLERY_ID}/unpublish`)).expect(200);
      expect(cdn.unpublishMany).toHaveBeenCalledWith(OWNER_ID, [MEDIA_B]);
    });
  });

  describe('DELETE /:id', () => {
    it('effectue une suppression logique (deletedAt renseigné)', async () => {
      galleries.seed({ visibility: 'private' });
      galleryMedia.findResult = [];
      const res = await auth(http().delete(`/api/galleries/${GALLERY_ID}`)).expect(200);
      expect(res.body).toEqual({ success: true });
      expect(galleries.rows.get(GALLERY_ID)?.deletedAt).toBeInstanceOf(Date);
      expect(galleryMedia.delete).toHaveBeenCalled();
      expect(cdn.unpublishMany).not.toHaveBeenCalled();
    });
  });
});
