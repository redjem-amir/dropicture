// dropicture/apps/saas/backend/src/specs/public-profile.controller.spec.ts
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FindOperator } from 'typeorm';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { PublicProfileController } from '../controllers/public-profile.controller';
import { CdnService } from '../services/cdn.service';
import { Account } from '../models/account.entity';
import { Media } from '../models/media.entity';
import { Gallery } from '../models/gallery.entity';
import { GalleryMedia } from '../models/gallery-media.entity';
import { Follow } from '../models/follow.entity';

/**
 * CDN factice : urlsFor renvoie une forme prévisible, dérivée de l'id du média,
 * ce qui permet d'affirmer précisément le mapping des URLs dans les réponses.
 */
const cdn = {
  urlsFor: (m: { id: string }) => ({
    base: `cdn/${m.id}`,
    srcSet: null,
    poster: null,
    hls: null,
    thumbhash: null,
  }),
};

/**
 * Vrai/faux matching d'un `where` TypeORM sur une ligne en mémoire.
 * Gère IsNull()/In() via FindOperator ; le reste est une égalité stricte ;
 * tout autre opérateur est traité de façon permissive (match).
 */
function matchWhere(row: Record<string, unknown>, clause: Record<string, unknown>): boolean {
  const entries = Object.entries(clause ?? {});
  if (!entries.length) return false;
  return entries.every(([key, value]) => {
    if (value instanceof FindOperator) {
      if (value.type === 'isNull') return row[key] === null || row[key] === undefined;
      if (value.type === 'in') return (value.value as unknown[]).includes(row[key]);
      return true;
    }
    return row[key] === value;
  });
}

/** Chaîne de query-builder factice : chaque étape se renvoie elle-même ; les
 * méthodes terminales lisent la config attachée au dépôt (`repo.qb`). */
function makeQueryBuilder(config: Record<string, unknown>) {
  const stub: Record<string, unknown> = {};
  const chain = [
    'select',
    'addSelect',
    'innerJoin',
    'leftJoin',
    'innerJoinAndSelect',
    'where',
    'andWhere',
    'orWhere',
    'orderBy',
    'addOrderBy',
    'groupBy',
    'take',
    'limit',
    'offset',
    'skip',
    'setParameter',
  ];
  for (const method of chain) stub[method] = () => stub;
  stub.getMany = async () => config.getMany ?? [];
  stub.getRawMany = async () => config.getRawMany ?? [];
  stub.getRawOne = async () => config.getRawOne ?? null;
  stub.getOne = async () => config.getOne ?? null;
  stub.getCount = async () => config.getCount ?? 0;
  return stub;
}

/** Dépôt factice minimal : find/findOne/count sur `rows`, plus un query-builder
 * dont les résultats terminaux se configurent par test via `repo.qb`. */
class FakeRepo<T extends Record<string, unknown>> {
  rows: T[] = [];
  qb: Record<string, unknown> = {};

  private filter(where: unknown): T[] {
    const clauses = Array.isArray(where) ? where : where ? [where] : [];
    if (!clauses.length) return [...this.rows];
    return this.rows.filter((row) => clauses.some((clause) => matchWhere(row, clause as Record<string, unknown>)));
  }

  async count(options: { where?: unknown } = {}) {
    return this.filter(options.where).length;
  }

  async findOne(options: { where?: unknown } = {}) {
    return this.filter(options.where)[0] ?? null;
  }

  async find(options: { where?: unknown; order?: Record<string, 'ASC' | 'DESC'>; take?: number } = {}) {
    let out = this.filter(options.where);
    if (options.order) {
      const [field, dir] = Object.entries(options.order)[0];
      out = [...out].sort((a, b) => {
        const av = a[field] as unknown as number;
        const bv = b[field] as unknown as number;
        const cmp = av > bv ? 1 : av < bv ? -1 : 0;
        return dir === 'DESC' ? -cmp : cmp;
      });
    }
    if (options.take != null) out = out.slice(0, options.take);
    return out;
  }

  createQueryBuilder(_alias?: string) {
    return makeQueryBuilder(this.qb);
  }
}

describe('PublicProfileController — /api/u', () => {
  let app: INestApplication;
  let accounts: FakeRepo<Record<string, unknown>>;
  let media: FakeRepo<Record<string, unknown>>;
  let galleries: FakeRepo<Record<string, unknown>>;
  let galleryMedia: FakeRepo<Record<string, unknown>>;
  let follows: FakeRepo<Record<string, unknown>>;

  const http = () => request(app.getHttpServer());

  const seedAccount = (overrides: Record<string, unknown> = {}) => {
    const account = {
      id: 'acc-1',
      username: 'ada_lovelace',
      firstname: 'Ada',
      lastname: 'Lovelace',
      bio: 'Comtesse de Lovelace',
      avatarMediaId: null,
      ...overrides,
    };
    accounts.rows.push(account);
    return account;
  };

  beforeAll(async () => {
    accounts = new FakeRepo();
    media = new FakeRepo();
    galleries = new FakeRepo();
    galleryMedia = new FakeRepo();
    follows = new FakeRepo();

    const moduleRef = await Test.createTestingModule({
      controllers: [PublicProfileController],
      providers: [
        { provide: CdnService, useValue: cdn },
        { provide: getRepositoryToken(Account), useValue: accounts },
        { provide: getRepositoryToken(Media), useValue: media },
        { provide: getRepositoryToken(Gallery), useValue: galleries },
        { provide: getRepositoryToken(GalleryMedia), useValue: galleryMedia },
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
    for (const repo of [accounts, media, galleries, galleryMedia, follows]) {
      repo.rows = [];
      repo.qb = {};
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/u/:username', () => {
    it('renvoie 404 ACCOUNT_NOT_FOUND pour un username invalide (espace)', async () => {
      const res = await http()
        .get('/api/u/' + encodeURIComponent('ada lovelace'))
        .expect(404);
      expect(res.body).toEqual({ code: 'ACCOUNT_NOT_FOUND' });
    });

    it('renvoie 404 ACCOUNT_NOT_FOUND pour un username trop long (>30)', async () => {
      const res = await http()
        .get('/api/u/' + 'a'.repeat(31))
        .expect(404);
      expect(res.body).toEqual({ code: 'ACCOUNT_NOT_FOUND' });
    });

    it('renvoie 404 ACCOUNT_NOT_FOUND pour un username valide mais inconnu', async () => {
      const res = await http().get('/api/u/inconnu').expect(404);
      expect(res.body).toEqual({ code: 'ACCOUNT_NOT_FOUND' });
    });

    it('renvoie le profil complet : compteurs, avatar et cartes de galeries', async () => {
      const account = seedAccount({ avatarMediaId: 'm-avatar' });

      media.rows.push(
        { id: 'm-cover', ownerId: account.id, kind: 'image', purpose: 'content', visibility: 'public', status: 'ready', deletedAt: null },
        { id: 'm2', ownerId: account.id, kind: 'image', purpose: 'content', visibility: 'public', status: 'ready', deletedAt: null },
        { id: 'm-avatar', ownerId: account.id, kind: 'image', purpose: 'avatar', visibility: 'public', status: 'ready', deletedAt: null },
      );

      galleries.rows.push({
        id: 'g1',
        ownerId: account.id,
        title: 'Voyage',
        slug: 'voyage',
        tagLabels: ['nature'],
        visibility: 'public',
        coverMediaId: 'm-cover',
        publishedAt: new Date('2026-05-01T00:00:00.000Z'),
        deletedAt: null,
      });

      follows.rows.push({ id: 'f1', followerId: 'x1', followingId: account.id }, { id: 'f2', followerId: 'x2', followingId: account.id }, { id: 'f3', followerId: 'x3', followingId: account.id });

      galleryMedia.qb = { getRawMany: [{ id: 'g1', total: '3' }] };

      const res = await http().get('/api/u/ada_lovelace').expect(200);

      expect(res.body.username).toBe('ada_lovelace');
      expect(res.body.name).toBe('Ada Lovelace');
      expect(res.body.bio).toBe('Comtesse de Lovelace');
      expect(res.body.avatar).toEqual({ base: 'cdn/m-avatar', srcSet: null });
      expect(res.body.counts).toEqual({ photos: 2, galleries: 1, followers: 3 });
      expect(res.body.galleries).toEqual([
        {
          id: 'g1',
          title: 'Voyage',
          slug: 'voyage',
          tags: ['nature'],
          total: 3,
          publishedAt: '2026-05-01T00:00:00.000Z',
          cover: { id: 'm-cover', kind: 'image', base: 'cdn/m-cover', srcSet: null, poster: null, hls: null, thumbhash: null },
        },
      ]);
    });
  });

  describe('GET /api/u/:username/media', () => {
    it('renvoie 404 ACCOUNT_NOT_FOUND pour un compte inconnu', async () => {
      const res = await http().get('/api/u/inconnu/media').expect(404);
      expect(res.body).toEqual({ code: 'ACCOUNT_NOT_FOUND' });
    });

    it('mappe les items avec leurs URLs et pose un nextCursor quand il y a une page suivante', async () => {
      seedAccount();
      media.qb = {
        getMany: [
          { id: 'm1', kind: 'image', width: 800, height: 600, durationMs: null, capturedAt: new Date('2026-06-03T00:00:00.000Z'), createdAt: new Date('2026-06-03T00:00:00.000Z') },
          { id: 'm2', kind: 'video', width: 1920, height: 1080, durationMs: 5000, capturedAt: new Date('2026-06-02T00:00:00.000Z'), createdAt: new Date('2026-06-02T00:00:00.000Z') },
          { id: 'm3', kind: 'image', width: 640, height: 480, durationMs: null, capturedAt: new Date('2026-06-01T00:00:00.000Z'), createdAt: new Date('2026-06-01T00:00:00.000Z') },
        ],
      };

      const res = await http().get('/api/u/ada_lovelace/media?limit=2').expect(200);

      expect(res.body.items).toHaveLength(2);
      expect(res.body.items[0]).toEqual({
        id: 'm1',
        kind: 'image',
        width: 800,
        height: 600,
        durationMs: null,
        base: 'cdn/m1',
        srcSet: null,
        poster: null,
        hls: null,
        thumbhash: null,
      });
      expect(res.body.items[1].id).toBe('m2');
      expect(typeof res.body.nextCursor).toBe('string');
      expect(res.body.nextCursor).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('renvoie nextCursor null quand il n’y a pas de page suivante', async () => {
      seedAccount();
      media.qb = {
        getMany: [
          { id: 'm1', kind: 'image', width: 800, height: 600, durationMs: null, capturedAt: new Date('2026-06-03T00:00:00.000Z'), createdAt: new Date('2026-06-03T00:00:00.000Z') },
          { id: 'm2', kind: 'image', width: 640, height: 480, durationMs: null, capturedAt: new Date('2026-06-02T00:00:00.000Z'), createdAt: new Date('2026-06-02T00:00:00.000Z') },
        ],
      };

      const res = await http().get('/api/u/ada_lovelace/media?limit=2').expect(200);

      expect(res.body.items).toHaveLength(2);
      expect(res.body.nextCursor).toBeNull();
    });
  });

  describe('GET /api/u/:username/galleries/:slug', () => {
    it('renvoie 404 GALLERY_NOT_FOUND quand la galerie est absente', async () => {
      seedAccount();
      const res = await http().get('/api/u/ada_lovelace/galleries/inexistante').expect(404);
      expect(res.body).toEqual({ code: 'GALLERY_NOT_FOUND' });
    });

    it('renvoie l’auteur, la galerie et ses items dans l’ordre des liens', async () => {
      const account = seedAccount();
      galleries.rows.push({
        id: 'g1',
        ownerId: account.id,
        title: 'Voyage',
        slug: 'voyage',
        tagLabels: ['nature'],
        visibility: 'public',
        publishedAt: new Date('2026-05-01T00:00:00.000Z'),
        deletedAt: null,
      });
      galleryMedia.rows.push({ galleryId: 'g1', mediaId: 'm1', position: 0 }, { galleryId: 'g1', mediaId: 'm2', position: 1 });
      media.rows.push(
        { id: 'm1', ownerId: account.id, kind: 'image', purpose: 'content', visibility: 'public', status: 'ready', deletedAt: null, width: 800, height: 600, durationMs: null },
        { id: 'm2', ownerId: account.id, kind: 'video', purpose: 'content', visibility: 'public', status: 'ready', deletedAt: null, width: 1920, height: 1080, durationMs: 5000 },
      );

      const res = await http().get('/api/u/ada_lovelace/galleries/voyage').expect(200);

      expect(res.body.author).toEqual({ username: 'ada_lovelace', name: 'Ada Lovelace' });
      expect(res.body.id).toBe('g1');
      expect(res.body.title).toBe('Voyage');
      expect(res.body.slug).toBe('voyage');
      expect(res.body.tags).toEqual(['nature']);
      expect(res.body.publishedAt).toBe('2026-05-01T00:00:00.000Z');
      expect(res.body.items.map((item: { id: string }) => item.id)).toEqual(['m1', 'm2']);
      expect(res.body.items[0]).toEqual({
        id: 'm1',
        kind: 'image',
        width: 800,
        height: 600,
        durationMs: null,
        base: 'cdn/m1',
        srcSet: null,
        poster: null,
        hls: null,
        thumbhash: null,
      });
    });
  });
});
