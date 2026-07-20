// dropicture/apps/saas/backend/src/controllers/public.controller.ts
import { BadRequestException, Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, IsNull, Not, Repository } from 'typeorm';
import { MediaService } from '../services/media.service';
import { Account } from '../models/account.entity';
import { Media } from '../models/media.entity';
import { Follow } from '../models/follow.entity';

const USERNAME = /^[a-zA-Z0-9._-]{1,30}$/;

export const PUBLIC_LIMITS = {
  PAGE_MAX: 120,
  PAGE_DEFAULT: 48,
  FEED_DEFAULT: 24,
  PROFILES_MAX: 24,
  PROFILES_DEFAULT: 6,
  PREVIEW_PER_PROFILE: 3,
  SEARCH_MAX: 10,
  SEARCH_DEFAULT: 6,
  SEARCH_TERM_MAX: 30,
} as const;

@Controller('/api/public')
export class PublicController {
  constructor(
    private readonly media: MediaService,
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    @InjectRepository(Media)
    private readonly mediaRepository: Repository<Media>,
    @InjectRepository(Follow)
    private readonly followRepository: Repository<Follow>,
  ) {}

  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @Get('/stats')
  async stats() {
    const row = await this.mediaRepository
      .createQueryBuilder('m')
      .select('COUNT(*)', 'media')
      .addSelect('COUNT(DISTINCT m.ownerId)', 'authors')
      .where("m.role = 'content'")
      .andWhere('m.publishedAt IS NOT NULL')
      .getRawOne<{ media: string; authors: string }>();
    return { media: Number(row?.media ?? 0), authors: Number(row?.authors ?? 0) };
  }

  @Throttle({ default: { limit: 240, ttl: 60000 } })
  @Get('/search')
  async search(@Query('q') q?: string, @Query('limit') limit?: string) {
    const term = (q ?? '').trim().toLowerCase().replace(/^@/, '').slice(0, PUBLIC_LIMITS.SEARCH_TERM_MAX);
    if (!term) return { term: '', profiles: [] };
    const escaped = term.replace(/[\\%_]/g, (c) => `\\${c}`);
    const take = Math.min(PUBLIC_LIMITS.SEARCH_MAX, Math.max(1, Number(limit) || PUBLIC_LIMITS.SEARCH_DEFAULT));

    const rows = await this.accountRepository
      .createQueryBuilder('a')
      .leftJoin(Media, 'm', "m.ownerId = a.id AND m.role = 'content' AND m.publishedAt IS NOT NULL")
      .select('a.id', 'id')
      .addSelect('a.username', 'username')
      .addSelect('a.firstname', 'firstname')
      .addSelect('a.lastname', 'lastname')
      .addSelect('a.bio', 'bio')
      .addSelect('a.avatarMediaId', 'avatarMediaId')
      .addSelect('COUNT(m.id)', 'photos')
      .where(
        new Brackets((w) => {
          w.where("LOWER(a.username) LIKE :like ESCAPE '\\'").orWhere("LOWER(a.firstname) LIKE :like ESCAPE '\\'").orWhere("LOWER(a.lastname) LIKE :like ESCAPE '\\'");
        }),
      )
      .groupBy('a.id')
      .orderBy(
        `CASE
           WHEN LOWER(a.username) = :exact THEN 0
           WHEN LOWER(a.username) LIKE :prefix ESCAPE '\\' THEN 1
           ELSE 2
         END`,
        'ASC',
      )
      .addOrderBy('COUNT(m.id)', 'DESC')
      .addOrderBy('a.username', 'ASC')
      .setParameters({ like: `%${escaped}%`, prefix: `${escaped}%`, exact: term })
      .limit(take)
      .getRawMany<{
        id: string;
        username: string;
        firstname: string;
        lastname: string;
        bio: string | null;
        avatarMediaId: string | null;
        photos: string;
      }>();

    if (!rows.length) return { term, profiles: [] };

    const avatarIds = rows.map((r) => r.avatarMediaId).filter((v): v is string => !!v);
    const avatars = avatarIds.length ? await this.mediaRepository.find({ where: { id: In(avatarIds) } }) : [];
    const avatarById = new Map(avatars.map((m) => [m.id, m]));

    return {
      term,
      profiles: rows.map((r) => {
        const avatar = r.avatarMediaId ? avatarById.get(r.avatarMediaId) : undefined;
        return {
          username: r.username,
          name: `${r.firstname} ${r.lastname}`.trim(),
          bio: r.bio,
          avatar: avatar ? this.media.view(avatar) : null,
          photos: Number(r.photos),
        };
      }),
    };
  }

  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @Get('/profiles')
  async profiles(@Query('limit') limit?: string) {
    const take = Math.min(PUBLIC_LIMITS.PROFILES_MAX, Math.max(1, Number(limit) || PUBLIC_LIMITS.PROFILES_DEFAULT));
    const ranked = await this.mediaRepository
      .createQueryBuilder('m')
      .select('m.ownerId', 'id')
      .addSelect('COUNT(*)', 'total')
      .addSelect('MAX(m.publishedAt)', 'last')
      .where("m.role = 'content'")
      .andWhere('m.publishedAt IS NOT NULL')
      .groupBy('m.ownerId')
      .orderBy('MAX(m.publishedAt)', 'DESC')
      .limit(take)
      .getRawMany<{ id: string; total: string; last: Date }>();
    if (!ranked.length) return { profiles: [] };

    const ids = ranked.map((r) => r.id);
    const accounts = await this.accountRepository.find({ where: { id: In(ids) } });
    const [followerRows, previewRows] = await Promise.all([
      this.followRepository
        .createQueryBuilder('f')
        .select('f.followingId', 'id')
        .addSelect('COUNT(*)', 'total')
        .where('f.followingId IN (:...ids)', { ids })
        .groupBy('f.followingId')
        .getRawMany<{ id: string; total: string }>(),
      this.mediaRepository.manager.query<{ id: string; ownerId: string }[]>(
        `SELECT id, "ownerId" FROM (
             SELECT m.id, m."ownerId",
                    ROW_NUMBER() OVER (PARTITION BY m."ownerId" ORDER BY m."publishedAt" DESC, m.id DESC) AS rn
               FROM media m
              WHERE m.role = 'content'
                AND m."publishedAt" IS NOT NULL
                AND m."ownerId" = ANY($1)
           ) ranked
          WHERE rn <= $2`,
        [ids, PUBLIC_LIMITS.PREVIEW_PER_PROFILE],
      ),
    ]);

    const mediaIds = [...previewRows.map((r) => r.id), ...accounts.map((a) => a.avatarMediaId).filter((v): v is string => !!v)];
    const media = mediaIds.length ? await this.mediaRepository.find({ where: { id: In(mediaIds) } }) : [];
    const mediaById = new Map(media.map((m) => [m.id, m]));

    const previews = new Map<string, ReturnType<MediaService['view']>[]>();
    for (const row of previewRows) {
      const m = mediaById.get(row.id);
      if (!m) continue;
      const list = previews.get(row.ownerId) ?? [];
      list.push(this.media.view(m));
      previews.set(row.ownerId, list);
    }

    const totalById = new Map(ranked.map((r) => [r.id, Number(r.total)]));
    const lastById = new Map(ranked.map((r) => [r.id, r.last]));
    const followerById = new Map(followerRows.map((r) => [r.id, Number(r.total)]));
    const order = new Map(ids.map((id, i) => [id, i]));

    return {
      profiles: accounts
        .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
        .map((a) => {
          const avatar = a.avatarMediaId ? mediaById.get(a.avatarMediaId) : undefined;
          const last = lastById.get(a.id);
          return {
            username: a.username,
            name: `${a.firstname} ${a.lastname}`.trim(),
            bio: a.bio,
            avatar: avatar ? this.media.view(avatar) : null,
            counts: { photos: totalById.get(a.id) ?? 0, followers: followerById.get(a.id) ?? 0 },
            lastPublishedAt: last ? new Date(last).toISOString() : null,
            preview: previews.get(a.id) ?? [],
          };
        }),
    };
  }

  @Throttle({ default: { limit: 240, ttl: 60000 } })
  @Get('/feed')
  async feed(@Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    const take = Math.min(PUBLIC_LIMITS.PAGE_MAX, Math.max(1, Number(limit) || PUBLIC_LIMITS.FEED_DEFAULT));
    const qb = this.mediaRepository
      .createQueryBuilder('m')
      .where("m.role = 'content'")
      .andWhere('m.publishedAt IS NOT NULL')
      .orderBy('m.publishedAt', 'DESC')
      .addOrderBy('m.id', 'DESC')
      .limit(take + 1);

    if (cursor) {
      const [iso, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
      const ts = new Date(iso);
      if (Number.isNaN(ts.getTime()) || !id) throw new BadRequestException({ code: 'BAD_CURSOR' });
      qb.andWhere(
        new Brackets((w) => {
          w.where('m.publishedAt < :ts', { ts }).orWhere(
            new Brackets((x) => {
              x.where('m.publishedAt = :ts', { ts }).andWhere('m.id < :id', { id });
            }),
          );
        }),
      );
    }

    const rows = await qb.getMany();
    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;
    if (!items.length) return { items: [], nextCursor: null };

    const accounts = await this.accountRepository.find({
      where: { id: In(Array.from(new Set(items.map((m) => m.ownerId)))) },
    });
    const authorById = new Map(accounts.map((a) => [a.id, { username: a.username, name: `${a.firstname} ${a.lastname}`.trim() }]));

    const last = items[items.length - 1];
    const nextCursor = hasMore && last?.publishedAt ? Buffer.from(`${last.publishedAt.toISOString()}|${last.id}`).toString('base64url') : null;

    return {
      items: items.map((m) => ({
        ...this.media.view(m),
        publishedAt: m.publishedAt?.toISOString() ?? null,
        author: authorById.get(m.ownerId) ?? null,
      })),
      nextCursor,
    };
  }

  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @Get('/:username')
  async profile(@Param('username') username: string) {
    if (!USERNAME.test(username)) throw new NotFoundException({ code: 'ACCOUNT_NOT_FOUND' });
    const account = await this.accountRepository.findOne({ where: { username } });
    if (!account) throw new NotFoundException({ code: 'ACCOUNT_NOT_FOUND' });

    const [photos, followers, first] = await Promise.all([
      this.mediaRepository.count({
        where: { ownerId: account.id, role: 'content', publishedAt: Not(IsNull()) },
      }),
      this.followRepository.count({ where: { followingId: account.id } }),
      this.mediaRepository
        .createQueryBuilder('m')
        .select('MIN(m.publishedAt)', 'first')
        .where('m.ownerId = :id', { id: account.id })
        .andWhere("m.role = 'content'")
        .andWhere('m.publishedAt IS NOT NULL')
        .getRawOne<{ first: Date | null }>(),
    ]);
    const avatar = account.avatarMediaId ? await this.mediaRepository.findOne({ where: { id: account.avatarMediaId, ownerId: account.id } }) : null;
    return {
      username: account.username,
      name: `${account.firstname} ${account.lastname}`.trim(),
      bio: account.bio,
      avatar: avatar ? this.media.view(avatar) : null,
      counts: { photos, followers },
      firstPublishedAt: first?.first ? new Date(first.first).toISOString() : null,
    };
  }

  @Throttle({ default: { limit: 240, ttl: 60000 } })
  @Get('/:username/media')
  async media_(@Param('username') username: string, @Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    if (!USERNAME.test(username)) throw new NotFoundException({ code: 'ACCOUNT_NOT_FOUND' });
    const account = await this.accountRepository.findOne({ where: { username } });
    if (!account) throw new NotFoundException({ code: 'ACCOUNT_NOT_FOUND' });

    const take = Math.min(PUBLIC_LIMITS.PAGE_MAX, Math.max(1, Number(limit) || PUBLIC_LIMITS.PAGE_DEFAULT));
    const qb = this.mediaRepository
      .createQueryBuilder('m')
      .where('m.ownerId = :id', { id: account.id })
      .andWhere("m.role = 'content'")
      .andWhere('m.publishedAt IS NOT NULL')
      .orderBy('m.publishedAt', 'DESC')
      .addOrderBy('m.id', 'DESC')
      .limit(take + 1);

    if (cursor) {
      const [iso, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
      const ts = new Date(iso);
      if (Number.isNaN(ts.getTime()) || !id) throw new BadRequestException({ code: 'BAD_CURSOR' });
      qb.andWhere(
        new Brackets((w) => {
          w.where('m.publishedAt < :ts', { ts }).orWhere(
            new Brackets((x) => {
              x.where('m.publishedAt = :ts', { ts }).andWhere('m.id < :id', { id });
            }),
          );
        }),
      );
    }

    const rows = await qb.getMany();
    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;
    const last = items[items.length - 1];
    const nextCursor = hasMore && last?.publishedAt ? Buffer.from(`${last.publishedAt.toISOString()}|${last.id}`).toString('base64url') : null;

    return {
      items: items.map((m) => ({
        ...this.media.view(m),
        publishedAt: m.publishedAt?.toISOString() ?? null,
      })),
      nextCursor,
    };
  }
}
