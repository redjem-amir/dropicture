// dropicture/apps/saas/backend/src/controllers/public-profile.controller.ts
import { BadRequestException, Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, IsNull, Repository } from 'typeorm';
import { CdnService } from '../services/cdn.service';
import { Account } from '../models/account.entity';
import { Media } from '../models/media.entity';
import { Gallery } from '../models/gallery.entity';
import { GalleryMedia } from '../models/gallery-media.entity';
import { Follow } from '../models/follow.entity';

const USERNAME_RE = /^[a-zA-Z0-9._-]{1,30}$/;

function encodeCursor(date: Date, id: string): string {
  return Buffer.from(`${date.toISOString()}|${id}`).toString('base64url');
}

function decodeCursor(raw: string): { ts: Date; id: string } {
  const [iso, id] = Buffer.from(raw, 'base64url').toString('utf8').split('|');
  const ts = new Date(iso);
  if (Number.isNaN(ts.getTime()) || !id) {
    throw new BadRequestException({ code: 'BAD_CURSOR' });
  }
  return { ts, id };
}

/**
 * Vitrine publique d'un profil. Aucune authentification : ces routes ne
 * renvoient QUE des médias `content` publics, prêts et non supprimés, et des
 * galeries publiées. Rien de privé ne doit jamais transiter par ici.
 */
@Controller('/api/u')
export class PublicProfileController {
  constructor(
    private readonly cdn: CdnService,
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    @InjectRepository(Media)
    private readonly mediaRepository: Repository<Media>,
    @InjectRepository(Gallery)
    private readonly galleryRepository: Repository<Gallery>,
    @InjectRepository(GalleryMedia)
    private readonly galleryMediaRepository: Repository<GalleryMedia>,
    @InjectRepository(Follow)
    private readonly followRepository: Repository<Follow>,
  ) {}

  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @Get('/:username')
  async profile(@Param('username') username: string) {
    if (!USERNAME_RE.test(username)) throw new NotFoundException({ code: 'ACCOUNT_NOT_FOUND' });
    const account = await this.accountRepository.findOne({ where: { username } });
    if (!account) throw new NotFoundException({ code: 'ACCOUNT_NOT_FOUND' });

    const [photos, galleryCount, followers] = await Promise.all([
      this.mediaRepository.count({
        where: {
          ownerId: account.id,
          purpose: 'content',
          visibility: 'public',
          status: 'ready',
          deletedAt: IsNull(),
        },
      }),
      this.galleryRepository.count({
        where: { ownerId: account.id, visibility: 'public', deletedAt: IsNull() },
      }),
      this.followRepository.count({ where: { followingId: account.id } }),
    ]);

    const galleries = await this.galleryRepository.find({
      where: { ownerId: account.id, visibility: 'public', deletedAt: IsNull() },
      order: { publishedAt: 'DESC' },
      take: 60,
    });

    const explicit = galleries.map((g) => g.coverMediaId).filter((v): v is string => !!v);
    const missing = galleries.filter((g) => !g.coverMediaId).map((g) => g.id);

    const firsts = missing.length
      ? await this.galleryMediaRepository
          .createQueryBuilder('gm')
          .innerJoin(Media, 'm', 'm.id = gm.mediaId')
          .select('DISTINCT ON (gm.galleryId) gm.galleryId', 'galleryId')
          .addSelect('gm.mediaId', 'mediaId')
          .where('gm.galleryId IN (:...ids)', { ids: missing })
          .andWhere("m.visibility = 'public'")
          .andWhere("m.status = 'ready'")
          .andWhere('m.deletedAt IS NULL')
          .orderBy('gm.galleryId')
          .addOrderBy('gm.position', 'ASC')
          .getRawMany<{ galleryId: string; mediaId: string }>()
      : [];

    const coverIds = [...explicit, ...firsts.map((f) => f.mediaId)];
    const coverMedia = coverIds.length
      ? await this.mediaRepository.find({
          where: { id: In(coverIds), visibility: 'public', status: 'ready', deletedAt: IsNull() },
        })
      : [];
    const coverById = new Map(coverMedia.map((m) => [m.id, m]));
    const firstByGallery = new Map(firsts.map((f) => [f.galleryId, f.mediaId]));

    const covers = new Map(
      galleries.map((g) => {
        const mediaId = g.coverMediaId ?? firstByGallery.get(g.id);
        const m = mediaId ? coverById.get(mediaId) : undefined;
        return [g.id, m ? { id: m.id, kind: m.kind, ...this.cdn.urlsFor(m) } : null];
      }),
    );

    const galleryIds = galleries.map((g) => g.id);
    let totals: Map<string, number>;
    if (!galleryIds.length) {
      totals = new Map();
    } else {
      const rows = await this.galleryMediaRepository
        .createQueryBuilder('gm')
        .innerJoin(Media, 'm', 'm.id = gm.mediaId')
        .select('gm.galleryId', 'id')
        .addSelect('COUNT(*)', 'total')
        .where('gm.galleryId IN (:...ids)', { ids: galleryIds })
        .andWhere("m.visibility = 'public'")
        .andWhere("m.status = 'ready'")
        .andWhere('m.deletedAt IS NULL')
        .groupBy('gm.galleryId')
        .getRawMany<{ id: string; total: string }>();
      totals = new Map(rows.map((r) => [r.id, Number(r.total)]));
    }

    const avatar = account.avatarMediaId
      ? await this.mediaRepository.findOne({
          where: {
            id: account.avatarMediaId,
            ownerId: account.id,
            status: 'ready',
            deletedAt: IsNull(),
          },
        })
      : null;
    const avatarUrls = avatar ? this.cdn.urlsFor(avatar) : null;

    return {
      username: account.username,
      name: `${account.firstname} ${account.lastname}`.trim(),
      bio: account.bio,
      avatar: avatarUrls ? { base: avatarUrls.base, srcSet: avatarUrls.srcSet } : null,
      counts: { photos, galleries: galleryCount, followers },
      galleries: galleries.map((g) => ({
        id: g.id,
        title: g.title,
        slug: g.slug,
        tags: g.tagLabels ?? [],
        total: totals.get(g.id) ?? 0,
        publishedAt: g.publishedAt?.toISOString() ?? null,
        cover: covers.get(g.id) ?? null,
      })),
    };
  }

  @Throttle({ default: { limit: 240, ttl: 60000 } })
  @Get('/:username/media')
  async media(@Param('username') username: string, @Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    if (!USERNAME_RE.test(username)) throw new NotFoundException({ code: 'ACCOUNT_NOT_FOUND' });
    const account = await this.accountRepository.findOne({ where: { username } });
    if (!account) throw new NotFoundException({ code: 'ACCOUNT_NOT_FOUND' });
    const take = Math.min(120, Math.max(1, Number(limit) || 48));

    const qb = this.mediaRepository
      .createQueryBuilder('m')
      .where('m.ownerId = :sub', { sub: account.id })
      .andWhere("m.purpose = 'content'")
      .andWhere("m.visibility = 'public'")
      .andWhere("m.status = 'ready'")
      .andWhere('m.deletedAt IS NULL')
      .orderBy('COALESCE(m.capturedAt, m.createdAt)', 'DESC')
      .addOrderBy('m.id', 'DESC')
      .take(take + 1);

    if (cursor) {
      const { ts, id } = decodeCursor(cursor);
      qb.andWhere(
        new Brackets((w) => {
          w.where('COALESCE(m.capturedAt, m.createdAt) < :ts', { ts }).orWhere(
            new Brackets((x) => {
              x.where('COALESCE(m.capturedAt, m.createdAt) = :ts', { ts }).andWhere('m.id < :id', { id });
            }),
          );
        }),
      );
    }

    const rows = await qb.getMany();
    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;
    const last = items[items.length - 1];

    return {
      items: items.map((m) => ({
        id: m.id,
        kind: m.kind,
        width: m.width,
        height: m.height,
        durationMs: m.durationMs,
        ...this.cdn.urlsFor(m),
      })),
      nextCursor: hasMore && last ? encodeCursor(last.capturedAt ?? last.createdAt, last.id) : null,
    };
  }

  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @Get('/:username/galleries/:slug')
  async gallery(@Param('username') username: string, @Param('slug') slug: string) {
    if (!USERNAME_RE.test(username)) throw new NotFoundException({ code: 'ACCOUNT_NOT_FOUND' });
    const account = await this.accountRepository.findOne({ where: { username } });
    if (!account) throw new NotFoundException({ code: 'ACCOUNT_NOT_FOUND' });
    const gallery = await this.galleryRepository.findOne({
      where: { ownerId: account.id, slug, visibility: 'public', deletedAt: IsNull() },
    });
    if (!gallery) throw new NotFoundException({ code: 'GALLERY_NOT_FOUND' });

    const links = await this.galleryMediaRepository.find({
      where: { galleryId: gallery.id },
      order: { position: 'ASC' },
    });
    const media = links.length
      ? await this.mediaRepository.find({
          where: {
            id: In(links.map((l) => l.mediaId)),
            ownerId: account.id,
            purpose: 'content',
            visibility: 'public',
            status: 'ready',
            deletedAt: IsNull(),
          },
        })
      : [];
    const byId = new Map(media.map((m) => [m.id, m]));

    return {
      author: { username: account.username, name: `${account.firstname} ${account.lastname}`.trim() },
      id: gallery.id,
      title: gallery.title,
      slug: gallery.slug,
      tags: gallery.tagLabels ?? [],
      publishedAt: gallery.publishedAt?.toISOString() ?? null,
      items: links
        .map((l) => byId.get(l.mediaId))
        .filter((m): m is Media => !!m)
        .map((m) => ({
          id: m.id,
          kind: m.kind,
          width: m.width,
          height: m.height,
          durationMs: m.durationMs,
          ...this.cdn.urlsFor(m),
        })),
    };
  }
}
