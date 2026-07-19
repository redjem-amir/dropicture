// dropicture/apps/saas/backend/src/controllers/discover.controller.ts
import { BadRequestException, Controller, Delete, Get, HttpCode, HttpStatus, NotFoundException, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import type { Request } from 'express';
import { CdnService } from '../services/cdn.service';
import type { AuthenticatedUser } from '../services/auth.service';
import { Account } from '../models/account.entity';
import { Media } from '../models/media.entity';
import { Follow } from '../models/follow.entity';
import { Gallery, normalizeTag } from '../models/gallery.entity';
import { GalleryMedia } from '../models/gallery-media.entity';

const PAGE_SIZE = 40;
const SUGGESTIONS = 6;
const TAG_CHIPS = 24;

function encodeCursor(date: Date, galleryId: string, mediaId: string): string {
  return Buffer.from(`${date.toISOString()}|${galleryId}|${mediaId}`).toString('base64url');
}

function decodeCursor(raw: string): { ts: Date; galleryId: string; mediaId: string } {
  const [iso, galleryId, mediaId] = Buffer.from(raw, 'base64url').toString('utf8').split('|');
  const ts = new Date(iso);
  if (Number.isNaN(ts.getTime()) || !galleryId || !mediaId) {
    throw new BadRequestException({ code: 'BAD_CURSOR' });
  }
  return { ts, galleryId, mediaId };
}

type AuthorCard = {
  id: string;
  username: string;
  name: string;
  bio: string | null;
  items: number;
  followers: number;
  following: boolean;
  avatar: { base: string; srcSet: { avif: string; webp: string } | null } | null;
};

@Controller('/api/discover')
@UseGuards(AuthGuard('access-token'))
export class DiscoverController {
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
  @Get('/tags')
  async tags() {
    const rows = await this.galleryRepository.manager.query<{ tag: string; total: string }[]>(
      `SELECT tag.value AS tag, COUNT(*)::text AS total
               FROM galleries g
               JOIN gallery_media gm ON gm."galleryId" = g.id
               JOIN media m ON m.id = gm."mediaId"
               CROSS JOIN LATERAL jsonb_array_elements_text(g.tags) AS tag(value)
              WHERE g.visibility = 'public'
                AND g."deletedAt" IS NULL
                AND m.visibility = 'public'
                AND m.status = 'ready'
                AND m."deletedAt" IS NULL
              GROUP BY tag.value
              ORDER BY COUNT(*) DESC, tag.value ASC
              LIMIT $1`,
      [TAG_CHIPS],
    );
    const total = await this.galleryMediaRepository
      .createQueryBuilder('gm')
      .innerJoin(Gallery, 'g', 'g.id = gm.galleryId')
      .innerJoin(Media, 'm', 'm.id = gm.mediaId')
      .where("g.visibility = 'public'")
      .andWhere('g.deletedAt IS NULL')
      .andWhere("m.visibility = 'public'")
      .andWhere("m.status = 'ready'")
      .andWhere('m.deletedAt IS NULL')
      .getCount();
    const labelTags = rows.map((r) => r.tag);
    let labels: Map<string, string>;
    if (!labelTags.length) {
      labels = new Map();
    } else {
      const labelRows = await this.galleryRepository
        .createQueryBuilder('g')
        .select('g.tags', 'tags')
        .addSelect('g.tagLabels', 'labels')
        .where("g.visibility = 'public'")
        .andWhere('g.deletedAt IS NULL')
        .andWhere('g.tags ?| ARRAY[:...tags]', { tags: labelTags })
        .limit(500)
        .getRawMany<{ tags: string[]; labels: string[] }>();
      const out = new Map<string, string>();
      for (const row of labelRows) {
        (row.tags ?? []).forEach((tag, i) => {
          const label = row.labels?.[i];
          if (label && !out.has(tag)) out.set(tag, label);
        });
      }
      labels = out;
    }
    return {
      tags: [
        { tag: null, label: 'Tout', total },
        ...rows.map((r) => ({
          tag: r.tag,
          label: labels.get(r.tag) ?? r.tag,
          total: Number(r.total),
        })),
      ],
    };
  }

  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @Get('/authors')
  async authors(@Req() req: Request): Promise<{ authors: AuthorCard[] }> {
    const { sub } = req.user as AuthenticatedUser;
    const ranked = await this.mediaRepository
      .createQueryBuilder('m')
      .select('m.ownerId', 'id')
      .addSelect('COUNT(*)', 'items')
      .where('m.ownerId <> :sub', { sub })
      .andWhere("m.purpose = 'content'")
      .andWhere("m.visibility = 'public'")
      .andWhere("m.status = 'ready'")
      .andWhere('m.deletedAt IS NULL')
      .groupBy('m.ownerId')
      .orderBy('items', 'DESC')
      .limit(SUGGESTIONS)
      .getRawMany<{ id: string; items: string }>();
    if (!ranked.length) return { authors: [] };
    const ids = ranked.map((r) => r.id);
    const accounts = await this.accountRepository.find({ where: { id: In(ids) } });
    const avatarIds = accounts.map((a) => a.avatarMediaId).filter((v): v is string => !!v);
    const avatars = avatarIds.length
      ? await this.mediaRepository.find({
          where: { id: In(avatarIds), status: 'ready', deletedAt: IsNull() },
        })
      : [];
    const avatarById = new Map(avatars.map((m) => [m.id, m]));
    const followed = await this.followRepository.find({
      where: { followerId: sub, followingId: In(ids) },
      select: { followingId: true },
    });
    const followedIds = new Set(followed.map((f) => f.followingId));
    const followerRows = await this.followRepository
      .createQueryBuilder('f')
      .select('f.followingId', 'id')
      .addSelect('COUNT(*)', 'total')
      .where('f.followingId IN (:...ids)', { ids })
      .groupBy('f.followingId')
      .getRawMany<{ id: string; total: string }>();
    const followerCount = new Map(followerRows.map((r) => [r.id, Number(r.total)]));
    const counted = new Map(ranked.map((r) => [r.id, Number(r.items)]));
    const order = new Map(ids.map((id, i) => [id, i]));
    return {
      authors: accounts
        .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
        .map((a) => {
          const avatar = a.avatarMediaId ? avatarById.get(a.avatarMediaId) : undefined;
          const urls = avatar ? this.cdn.urlsFor(avatar) : null;
          return {
            id: a.id,
            username: a.username,
            name: `${a.firstname} ${a.lastname}`.trim(),
            bio: a.bio,
            items: counted.get(a.id) ?? 0,
            followers: followerCount.get(a.id) ?? 0,
            following: followedIds.has(a.id),
            avatar: urls ? { base: urls.base, srcSet: urls.srcSet } : null,
          };
        }),
    };
  }

  @Throttle({ default: { limit: 240, ttl: 60000 } })
  @Get('/feed')
  async feed(@Req() req: Request, @Query('tag') tag?: string, @Query('scope') scope?: string, @Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    const { sub } = req.user as AuthenticatedUser;
    const take = Math.min(80, Math.max(1, Number(limit) || PAGE_SIZE));
    const qb = this.mediaRepository
      .createQueryBuilder('m')
      .innerJoin(GalleryMedia, 'gm', 'gm.mediaId = m.id')
      .innerJoin(Gallery, 'g', 'g.id = gm.galleryId')
      .addSelect('g.id', 'g_id')
      .addSelect('g.title', 'g_title')
      .addSelect('g.slug', 'g_slug')
      .addSelect('g.tagLabels', 'g_tags')
      .addSelect('g.ownerId', 'g_owner')
      .addSelect('g.publishedAt', 'g_published')
      .where("m.visibility = 'public'")
      .andWhere("m.status = 'ready'")
      .andWhere("m.purpose = 'content'")
      .andWhere('m.deletedAt IS NULL')
      .andWhere("g.visibility = 'public'")
      .andWhere('g.deletedAt IS NULL')
      .andWhere('g.publishedAt IS NOT NULL')
      .orderBy('g.publishedAt', 'DESC')
      .addOrderBy('gm.galleryId', 'DESC')
      .addOrderBy('m.id', 'DESC')
      .take(take + 1);
    if (tag) {
      const needle = normalizeTag(tag);
      if (!needle) throw new BadRequestException({ code: 'BAD_TAG' });
      qb.andWhere('g.tags @> :needle::jsonb', { needle: JSON.stringify([needle]) });
    }
    if (scope === 'following') {
      const following = await this.followRepository.find({
        where: { followerId: sub },
        select: { followingId: true },
      });
      if (!following.length) return { items: [], nextCursor: null };
      qb.andWhere('g.ownerId IN (:...ids)', { ids: following.map((f) => f.followingId) });
    }
    if (cursor) {
      const { ts, galleryId, mediaId } = decodeCursor(cursor);
      qb.andWhere(
        `(g.publishedAt < :ts
                  OR (g.publishedAt = :ts AND gm.galleryId < :gid)
                  OR (g.publishedAt = :ts AND gm.galleryId = :gid AND m.id < :mid))`,
        { ts, gid: galleryId, mid: mediaId },
      );
    }
    const { entities, raw } = await qb.getRawAndEntities<{
      g_id: string;
      g_title: string;
      g_slug: string;
      g_tags: string[] | null;
      g_owner: string;
      g_published: Date;
    }>();
    const hasMore = entities.length > take;
    const rows = (hasMore ? entities.slice(0, take) : entities).map((media, i) => ({
      media,
      meta: raw[i],
    }));
    if (!rows.length) return { items: [], nextCursor: null };
    const ownerIds = rows.map((r) => r.meta.g_owner);
    const ids = Array.from(new Set(ownerIds));
    const accounts = await this.accountRepository.find({ where: { id: In(ids) } });
    const avatarIds = accounts.map((a) => a.avatarMediaId).filter((v): v is string => !!v);
    const avatars = avatarIds.length
      ? await this.mediaRepository.find({
          where: { id: In(avatarIds), status: 'ready', deletedAt: IsNull() },
        })
      : [];
    const avatarById = new Map(avatars.map((m) => [m.id, m]));
    const followed = await this.followRepository.find({
      where: { followerId: sub, followingId: In(ids) },
      select: { followingId: true },
    });
    const followedIds = new Set(followed.map((f) => f.followingId));
    const followerRows = await this.followRepository
      .createQueryBuilder('f')
      .select('f.followingId', 'id')
      .addSelect('COUNT(*)', 'total')
      .where('f.followingId IN (:...ids)', { ids })
      .groupBy('f.followingId')
      .getRawMany<{ id: string; total: string }>();
    const followerCount = new Map(followerRows.map((r) => [r.id, Number(r.total)]));
    const counted = new Map(
      (
        await this.mediaRepository
          .createQueryBuilder('m')
          .select('m.ownerId', 'id')
          .addSelect('COUNT(*)', 'total')
          .where('m.ownerId IN (:...ids)', { ids })
          .andWhere("m.purpose = 'content'")
          .andWhere("m.visibility = 'public'")
          .andWhere("m.status = 'ready'")
          .andWhere('m.deletedAt IS NULL')
          .groupBy('m.ownerId')
          .getRawMany<{ id: string; total: string }>()
      ).map((r) => [r.id, Number(r.total)]),
    );
    const order = new Map(ids.map((id, i) => [id, i]));
    const cards = accounts
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
      .map((a) => {
        const avatar = a.avatarMediaId ? avatarById.get(a.avatarMediaId) : undefined;
        const urls = avatar ? this.cdn.urlsFor(avatar) : null;
        return {
          id: a.id,
          username: a.username,
          name: `${a.firstname} ${a.lastname}`.trim(),
          bio: a.bio,
          items: counted.get(a.id) ?? 0,
          followers: followerCount.get(a.id) ?? 0,
          following: followedIds.has(a.id),
          avatar: urls ? { base: urls.base, srcSet: urls.srcSet } : null,
        };
      });
    const authors = new Map(cards.map((c) => [c.id, c]));
    const last = rows[rows.length - 1];
    return {
      items: rows.map(({ media, meta }) => ({
        key: `${meta.g_id}:${media.id}`,
        id: media.id,
        kind: media.kind,
        width: media.width,
        height: media.height,
        durationMs: media.durationMs,
        gallery: {
          id: meta.g_id,
          title: meta.g_title,
          slug: meta.g_slug,
          tags: meta.g_tags ?? [],
        },
        author: authors.get(meta.g_owner) ?? null,
        ...this.cdn.urlsFor(media),
      })),
      nextCursor: hasMore ? encodeCursor(new Date(last.meta.g_published), last.meta.g_id, last.media.id) : null,
    };
  }

  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @Get('/me')
  async me(@Req() req: Request) {
    const { sub } = req.user as AuthenticatedUser;
    const [galleries, publishedGalleries, publishedMedia, following, followers] = await Promise.all([
      this.galleryRepository.count({ where: { ownerId: sub, deletedAt: IsNull() } }),
      this.galleryRepository.count({
        where: { ownerId: sub, visibility: 'public', deletedAt: IsNull() },
      }),
      this.mediaRepository.count({
        where: {
          ownerId: sub,
          purpose: 'content',
          visibility: 'public',
          status: 'ready',
          deletedAt: IsNull(),
        },
      }),
      this.followRepository.count({ where: { followerId: sub } }),
      this.followRepository.count({ where: { followingId: sub } }),
    ]);
    return { galleries, publishedGalleries, publishedMedia, following, followers };
  }

  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Post('/follows/:username')
  @HttpCode(HttpStatus.OK)
  async follow(@Req() req: Request, @Param('username') username: string) {
    const { sub } = req.user as AuthenticatedUser;
    const target = await this.accountRepository.findOne({ where: { username } });
    if (!target) throw new NotFoundException({ code: 'ACCOUNT_NOT_FOUND' });
    if (target.id === sub) throw new BadRequestException({ code: 'CANNOT_FOLLOW_SELF' });
    await this.followRepository.createQueryBuilder().insert().into(Follow).values({ followerId: sub, followingId: target.id }).orIgnore().execute();
    const followers = await this.followRepository.count({ where: { followingId: target.id } });
    return { username, following: true, followers };
  }

  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Delete('/follows/:username')
  @HttpCode(HttpStatus.OK)
  async unfollow(@Req() req: Request, @Param('username') username: string) {
    const { sub } = req.user as AuthenticatedUser;
    const target = await this.accountRepository.findOne({ where: { username } });
    if (!target) throw new NotFoundException({ code: 'ACCOUNT_NOT_FOUND' });
    await this.followRepository.delete({ followerId: sub, followingId: target.id });
    const followers = await this.followRepository.count({ where: { followingId: target.id } });
    return { username, following: false, followers };
  }
}
