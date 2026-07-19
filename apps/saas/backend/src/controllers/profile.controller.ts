// dropicture/apps/saas/backend/src/controllers/profile.controller.ts
import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import type { CookieOptions, Request, Response } from 'express';
import { CdnService, MEDIA_LIMITS } from '../services/cdn.service';
import type { AuthenticatedUser } from '../services/auth.service';
import { Account } from '../models/account.entity';
import { Media } from '../models/media.entity';

const isProd = process.env.NODE_ENV === 'production';
const SITE = 'https://dropicture.com';

const CDN_COOKIE_OPTIONS: CookieOptions = {
  domain: process.env.COOKIE_DOMAIN ?? '.dropicture.com',
  path: '/',
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax',
};

class UpdateBioDto {
  @IsOptional()
  @IsString()
  @MaxLength(160, { message: 'BIO_TOO_LONG' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  bio?: string;
}

class AvatarUploadDto {
  @IsString()
  @IsIn(['image/jpeg', 'image/png', 'image/webp'], { message: 'UNSUPPORTED_MEDIA_TYPE' })
  contentType!: string;

  @IsInt()
  @Min(1)
  contentLength!: number;
}

@Controller('/api/profile')
@UseGuards(AuthGuard('access-token'))
export class ProfileController {
  constructor(
    private readonly cdn: CdnService,
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    @InjectRepository(Media)
    private readonly mediaRepository: Repository<Media>,
  ) {}

  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @Get('/')
  async show(@Req() req: Request) {
    const { sub } = req.user as AuthenticatedUser;
    const account = await this.accountRepository.findOne({ where: { id: sub } });
    if (!account) throw new NotFoundException({ code: 'ACCOUNT_NOT_FOUND' });
    const avatar = account.avatarMediaId
      ? await this.mediaRepository.findOne({
          where: { id: account.avatarMediaId, ownerId: sub, deletedAt: IsNull() },
        })
      : null;
    const counts = await this.mediaRepository
      .createQueryBuilder('m')
      .select('m.visibility', 'visibility')
      .addSelect('COUNT(*)', 'total')
      .where('m.ownerId = :sub', { sub })
      .andWhere('m.purpose = :p', { p: 'content' })
      .andWhere('m.status = :s', { s: 'ready' })
      .andWhere('m.deletedAt IS NULL')
      .groupBy('m.visibility')
      .getRawMany<{ visibility: string; total: string }>();
    const published = Number(counts.find((c) => c.visibility === 'public')?.total ?? 0);
    const privateCount = Number(counts.find((c) => c.visibility === 'private')?.total ?? 0);
    return {
      username: account.username,
      firstname: account.firstname,
      lastname: account.lastname,
      bio: account.bio,
      publicUrl: `${SITE}/u/?u=${account.username}`,
      avatar: avatar ? { id: avatar.id, status: avatar.status, ...this.cdn.urlsFor(avatar) } : null,
      counts: { published, private: privateCount, total: published + privateCount },
      limits: this.cdn.limits(),
    };
  }

  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Patch('/')
  async updateBio(@Req() req: Request, @Body() dto: UpdateBioDto) {
    const { sub } = req.user as AuthenticatedUser;
    const bio = dto.bio?.length ? dto.bio : null;
    await this.accountRepository.update({ id: sub }, { bio });
    return { bio };
  }

  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @Get('/media')
  async listMedia(@Req() req: Request, @Query('filter') filter?: string, @Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    const { sub } = req.user as AuthenticatedUser;
    const take = Math.min(120, Math.max(1, Number(limit) || 48));
    const qb = this.mediaRepository
      .createQueryBuilder('m')
      .where('m.ownerId = :sub', { sub })
      .andWhere('m.purpose = :p', { p: 'content' })
      .andWhere('m.status = :s', { s: 'ready' })
      .andWhere('m.deletedAt IS NULL')
      .orderBy("CASE WHEN m.visibility = 'public' THEN 0 ELSE 1 END", 'ASC')
      .addOrderBy('COALESCE(m.capturedAt, m.createdAt)', 'DESC')
      .addOrderBy('m.id', 'DESC')
      .take(take + 1);
    if (filter === 'published') qb.andWhere('m.visibility = :v', { v: 'public' });
    if (filter === 'private') qb.andWhere('m.visibility = :v', { v: 'private' });
    if (cursor) qb.skip(Math.max(0, Number(cursor) || 0));
    const rows = await qb.getMany();
    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;
    return {
      items: items.map((m) => ({
        id: m.id,
        kind: m.kind,
        visibility: m.visibility,
        width: m.width,
        height: m.height,
        durationMs: m.durationMs,
        ...this.cdn.urlsFor(m),
      })),
      nextCursor: hasMore ? String((Number(cursor) || 0) + take) : null,
    };
  }

  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Patch('/media/:mediaId/publish')
  @HttpCode(HttpStatus.OK)
  async publish(@Req() req: Request, @Param('mediaId', new ParseUUIDPipe({ version: '4' })) mediaId: string) {
    const { sub } = req.user as AuthenticatedUser;
    const media = await this.cdn.publishMedia(sub, mediaId);
    return { id: media.id, visibility: media.visibility };
  }

  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Patch('/media/:mediaId/unpublish')
  @HttpCode(HttpStatus.OK)
  async unpublish(@Req() req: Request, @Param('mediaId', new ParseUUIDPipe({ version: '4' })) mediaId: string) {
    const { sub } = req.user as AuthenticatedUser;
    const media = await this.cdn.unpublishMedia(sub, mediaId);
    return { id: media.id, visibility: media.visibility };
  }

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('/avatar')
  async createAvatarUpload(@Req() req: Request, @Body() dto: AvatarUploadDto) {
    const { sub } = req.user as AuthenticatedUser;
    if (dto.contentLength > MEDIA_LIMITS.AVATAR_MAX_BYTES) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: `Poids maximal : ${Math.round(MEDIA_LIMITS.AVATAR_MAX_BYTES / 1024 / 1024)} Mo.`,
      });
    }
    return this.cdn.createUpload({
      ownerId: sub,
      contentType: dto.contentType,
      contentLength: dto.contentLength,
      purpose: 'avatar',
    });
  }

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('/avatar/:mediaId/complete')
  @HttpCode(HttpStatus.OK)
  async completeAvatar(@Req() req: Request, @Param('mediaId', new ParseUUIDPipe({ version: '4' })) mediaId: string) {
    const { sub } = req.user as AuthenticatedUser;
    const media = await this.cdn.completeUpload(sub, mediaId);
    if (media.purpose !== 'avatar') {
      throw new BadRequestException({ code: 'NOT_AN_AVATAR' });
    }
    await this.accountRepository.update({ id: sub }, { avatarMediaId: mediaId });
    const stale = await this.mediaRepository.find({
      where: { ownerId: sub, purpose: 'avatar', id: Not(mediaId) },
      select: { id: true },
    });
    for (const old of stale) {
      await this.cdn.destroyMedia(sub, old.id).catch(() => undefined);
    }
    return { id: media.id, status: media.status };
  }

  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post('/cdn-session')
  @HttpCode(HttpStatus.OK)
  openCdnSession(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { sub } = req.user as AuthenticatedUser;
    const cookies = this.cdn.issueReadCookies(sub);
    for (const c of cookies) {
      res.cookie(c.name, c.value, { ...CDN_COOKIE_OPTIONS, maxAge: c.maxAge });
    }
    return { success: true, expires_in: Math.floor((cookies[0]?.maxAge ?? 0) / 1000) };
  }
}
