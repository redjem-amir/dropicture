// dropicture/apps/saas/backend/src/controllers/discover.controller.ts
import { BadRequestException, Controller, Delete, Get, HttpCode, HttpStatus, NotFoundException, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, IsNull, Not, Repository } from 'typeorm';
import type { Request } from 'express';
import { MediaService } from '../services/media.service';
import type { AuthenticatedUser } from '../services/auth.service';
import { Account } from '../models/account.entity';
import { Media } from '../models/media.entity';
import { Follow } from '../models/follow.entity';

export const FEED_LIMITS = { PAGE_MAX: 80, PAGE_DEFAULT: 40 } as const;

@ApiTags('Découverte')
@ApiCookieAuth('session')
@Controller('/api/discover')
@UseGuards(AuthGuard('access-token'))
export class DiscoverController {
  constructor(
    private readonly media: MediaService,
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    @InjectRepository(Media)
    private readonly mediaRepository: Repository<Media>,
    @InjectRepository(Follow)
    private readonly followRepository: Repository<Follow>,
  ) {}

  @Throttle({ default: { limit: 240, ttl: 60000 } })
  @ApiOperation({ summary: "Fil d'actualité (tout public ou abonnements)" })
  @Get('/feed')
  async feed(@Req() req: Request, @Query('scope') scope?: string, @Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    const { sub } = req.user as AuthenticatedUser;
    const take = Math.min(FEED_LIMITS.PAGE_MAX, Math.max(1, Number(limit) || FEED_LIMITS.PAGE_DEFAULT));
    const qb = this.mediaRepository
      .createQueryBuilder('m')
      .where("m.role = 'content'")
      .andWhere('m.publishedAt IS NOT NULL')
      .orderBy('m.publishedAt', 'DESC')
      .addOrderBy('m.id', 'DESC')
      .limit(take + 1);
    if (scope === 'following') {
      const following = await this.followRepository.find({
        where: { followerId: sub },
        select: { followingId: true },
      });
      qb.andWhere('m.ownerId IN (:...ids)', { ids: [sub, ...following.map((f) => f.followingId)] });
    }
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
    const ownerIds = Array.from(new Set(items.map((m) => m.ownerId)));
    const accounts = await this.accountRepository.find({ where: { id: In(ownerIds) } });
    const avatarIds = accounts.map((a) => a.avatarMediaId).filter((v): v is string => !!v);
    const avatars = avatarIds.length ? await this.mediaRepository.find({ where: { id: In(avatarIds) } }) : [];
    const avatarById = new Map(avatars.map((m) => [m.id, m]));
    const followed = await this.followRepository.find({
      where: { followerId: sub, followingId: In(ownerIds) },
      select: { followingId: true },
    });
    const followedIds = new Set(followed.map((f) => f.followingId));
    const authorById = new Map(
      accounts.map((a) => {
        const avatar = a.avatarMediaId ? avatarById.get(a.avatarMediaId) : undefined;
        return [
          a.id,
          {
            username: a.username,
            name: `${a.firstname} ${a.lastname}`.trim(),
            avatar: avatar ? this.media.view(avatar) : null,
            following: followedIds.has(a.id),
            self: a.id === sub,
          },
        ] as const;
      }),
    );
    const last = items[items.length - 1];
    const nextCursor = hasMore && last?.publishedAt ? Buffer.from(`${last.publishedAt.toISOString()}|${last.id}`).toString('base64url') : null;
    return {
      items: items.map((m) => ({
        ...this.media.view(m),
        publishedAt: m.publishedAt?.toISOString() ?? null,
        mine: m.ownerId === sub,
        author: authorById.get(m.ownerId) ?? null,
      })),
      nextCursor,
    };
  }

  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @ApiOperation({ summary: 'Mes statistiques sociales (abonnés, abonnements)' })
  @Get('/me')
  async me(@Req() req: Request) {
    const { sub } = req.user as AuthenticatedUser;
    const [publishedMedia, following, followers, reach] = await Promise.all([
      this.mediaRepository.count({
        where: { ownerId: sub, role: 'content', publishedAt: Not(IsNull()) },
      }),
      this.followRepository.count({ where: { followerId: sub } }),
      this.followRepository.count({ where: { followingId: sub } }),
      this.mediaRepository
        .createQueryBuilder('m')
        .select('COUNT(DISTINCT m.ownerId)', 'authors')
        .addSelect('COUNT(*)', 'media')
        .where("m.role = 'content'")
        .andWhere('m.publishedAt IS NOT NULL')
        .getRawOne<{ authors: string; media: string }>(),
    ]);
    return {
      publishedMedia,
      following,
      followers,
      community: {
        authors: Number(reach?.authors ?? 0),
        media: Number(reach?.media ?? 0),
      },
    };
  }

  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Suivre un utilisateur' })
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
  @ApiOperation({ summary: 'Ne plus suivre un utilisateur' })
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
