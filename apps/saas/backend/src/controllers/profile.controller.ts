// dropicture/apps/saas/backend/src/controllers/profile.controller.ts
import { BadRequestException, Body, Controller, Delete, Get, Headers, HttpCode, HttpStatus, NotFoundException, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, IsNull, Not, Repository } from 'typeorm';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import type { Request } from 'express';
import { MediaService } from '../services/media.service';
import type { AuthenticatedUser } from '../services/auth.service';
import { Account } from '../models/account.entity';
import { Media } from '../models/media.entity';

const SITE = process.env.NODE_ENV === 'production' ? 'https://dropicture.com' : 'http://localhost:3000';

export const PROFILE_LIMITS = {
  BIO_MAX: 160,
  BULK_MAX: 200,
  PAGE_MAX: 120,
  PAGE_DEFAULT: 48,
} as const;

class UpdateBioDto {
  @IsOptional()
  @IsString()
  @MaxLength(PROFILE_LIMITS.BIO_MAX, { message: 'BIO_TOO_LONG' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  bio?: string;
}

class BulkIdsDto {
  @IsArray()
  @ArrayNotEmpty({ message: 'NO_MEDIA' })
  @ArrayMaxSize(PROFILE_LIMITS.BULK_MAX, { message: 'TOO_MANY_ITEMS' })
  @IsUUID('4', { each: true })
  ids!: string[];
}

@ApiTags('Profil')
@ApiCookieAuth('session')
@Controller('/api/profile')
@UseGuards(AuthGuard('access-token'))
export class ProfileController {
  constructor(
    private readonly media: MediaService,
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    @InjectRepository(Media)
    private readonly mediaRepository: Repository<Media>,
  ) {}

  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @ApiOperation({ summary: 'Afficher mon profil (compteurs, avatar, URL publique)' })
  @Get('/')
  async show(@Req() req: Request) {
    const { sub } = req.user as AuthenticatedUser;
    const account = await this.accountRepository.findOne({ where: { id: sub } });
    if (!account) throw new NotFoundException({ code: 'ACCOUNT_NOT_FOUND' });
    const avatar = account.avatarMediaId ? await this.mediaRepository.findOne({ where: { id: account.avatarMediaId, ownerId: sub } }) : null;
    const [published, inLibrary, first] = await Promise.all([
      this.mediaRepository.count({
        where: { ownerId: sub, role: 'content', publishedAt: Not(IsNull()) },
      }),
      this.mediaRepository.count({
        where: { ownerId: sub, role: 'content', publishedAt: IsNull() },
      }),
      this.mediaRepository
        .createQueryBuilder('m')
        .select('MIN(m.publishedAt)', 'first')
        .where('m.ownerId = :sub', { sub })
        .andWhere("m.role = 'content'")
        .andWhere('m.publishedAt IS NOT NULL')
        .getRawOne<{ first: Date | null }>(),
    ]);
    return {
      username: account.username,
      firstname: account.firstname,
      lastname: account.lastname,
      bio: account.bio,
      publicUrl: `${SITE}/u/?u=${account.username}`,
      avatar: avatar ? this.media.view(avatar) : null,
      counts: { published, inLibrary },
      firstPublishedAt: first?.first ? new Date(first.first).toISOString() : null,
      limits: this.media.limits(),
    };
  }

  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Modifier ma bio' })
  @Patch('/')
  async updateBio(@Req() req: Request, @Body() dto: UpdateBioDto) {
    const { sub } = req.user as AuthenticatedUser;
    const bio = dto.bio?.length ? dto.bio : null;
    const result = await this.accountRepository.update({ id: sub }, { bio });
    if (!result.affected) throw new NotFoundException({ code: 'ACCOUNT_NOT_FOUND' });
    return { bio };
  }

  @Throttle({ default: { limit: 240, ttl: 60000 } })
  @ApiOperation({ summary: 'Lister mes médias publiés (pagination par curseur)' })
  @Get('/media')
  async listMedia(@Req() req: Request, @Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    const { sub } = req.user as AuthenticatedUser;
    const take = Math.min(PROFILE_LIMITS.PAGE_MAX, Math.max(1, Number(limit) || PROFILE_LIMITS.PAGE_DEFAULT));
    const qb = this.mediaRepository
      .createQueryBuilder('m')
      .where('m.ownerId = :sub', { sub })
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

  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Dépublier des médias' })
  @Patch('/media/unpublish')
  @HttpCode(HttpStatus.OK)
  async unpublish(@Req() req: Request, @Body() dto: BulkIdsDto) {
    const { sub } = req.user as AuthenticatedUser;
    const done = await this.media.unpublish(sub, dto.ids);
    const doneSet = new Set(done);
    const pending = dto.ids.filter((id) => !doneSet.has(id));
    let failed: { id: string; code: string }[] = [];
    if (pending.length) {
      const rows = await this.mediaRepository.find({
        where: { id: In(pending), ownerId: sub },
        select: { id: true, role: true, publishedAt: true },
      });
      const byId = new Map(rows.map((r) => [r.id, r]));
      failed = pending.map((id) => {
        const m = byId.get(id);
        if (!m) return { id, code: 'MEDIA_NOT_FOUND' };
        if (m.role === 'avatar') return { id, code: 'AVATAR_ALWAYS_PUBLIC' };
        if (!m.publishedAt) return { id, code: 'ALREADY_PRIVATE' };
        return { id, code: 'UNPUBLISH_FAILED' };
      });
    }
    return { done, failed };
  }

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Téléverser une photo de profil (remplace la précédente)' })
  @Post('/avatar')
  async uploadAvatar(@Req() req: Request, @Headers('content-type') contentType?: string, @Headers('content-length') contentLength?: string) {
    const { sub } = req.user as AuthenticatedUser;
    if (!contentType) throw new BadRequestException({ code: 'UNSUPPORTED_MEDIA_TYPE' });
    const media = await this.media.upload({
      ownerId: sub,
      role: 'avatar',
      stream: req,
      mimeType: contentType.split(';')[0].trim(),
      contentLength: Number(contentLength) || undefined,
    });
    await this.accountRepository.update({ id: sub }, { avatarMediaId: media.id });
    const stale = await this.mediaRepository.find({
      where: { ownerId: sub, role: 'avatar', id: Not(media.id) },
      select: { id: true },
    });
    await this.media.destroy(
      sub,
      stale.map((m) => m.id),
    );
    return this.media.view(media);
  }

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Supprimer la photo de profil' })
  @Delete('/avatar')
  @HttpCode(HttpStatus.OK)
  async removeAvatar(@Req() req: Request) {
    const { sub } = req.user as AuthenticatedUser;
    const account = await this.accountRepository.findOne({ where: { id: sub } });
    if (!account) throw new NotFoundException({ code: 'ACCOUNT_NOT_FOUND' });
    await this.accountRepository.update({ id: sub }, { avatarMediaId: null });
    const stale = await this.mediaRepository.find({
      where: { ownerId: sub, role: 'avatar' },
      select: { id: true },
    });
    await this.media.destroy(
      sub,
      stale.map((m) => m.id),
    );
    return { avatar: null };
  }
}
