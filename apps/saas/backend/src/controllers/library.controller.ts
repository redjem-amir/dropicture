// dropicture/apps/saas/backend/src/controllers/library.controller.ts
import { BadRequestException, Body, Controller, Delete, Get, Headers, HttpCode, HttpStatus, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, IsNull, Not, Repository } from 'typeorm';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import type { Request } from 'express';
import { MediaService, extOf, type MediaView } from '../services/media.service';
import type { AuthenticatedUser } from '../services/auth.service';
import { Media } from '../models/media.entity';
import { Album } from '../models/album.entity';
import { Placement } from '../models/placement.entity';

export const LIBRARY_LIMITS = {
  ALBUM_TITLE_MAX: 60,
  BULK_MAX: 200,
  PAGE_MAX: 120,
  PAGE_DEFAULT: 60,
} as const;

class BulkIdsDto {
  @IsArray()
  @ArrayNotEmpty({ message: 'NO_MEDIA' })
  @ArrayMaxSize(LIBRARY_LIMITS.BULK_MAX, { message: 'TOO_MANY_ITEMS' })
  @IsUUID('4', { each: true })
  ids!: string[];
}

class AlbumTitleDto {
  @IsString()
  @MinLength(1, { message: 'TITLE_REQUIRED' })
  @MaxLength(LIBRARY_LIMITS.ALBUM_TITLE_MAX, { message: 'TITLE_TOO_LONG' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  title!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(LIBRARY_LIMITS.BULK_MAX, { message: 'TOO_MANY_ITEMS' })
  @IsUUID('4', { each: true })
  mediaIds?: string[];
}

type LibraryItem = MediaView & { bytes: string; takenAt: string; published: boolean };

@Controller('/api/library')
@UseGuards(AuthGuard('access-token'))
export class LibraryController {
  constructor(
    private readonly media: MediaService,
    @InjectRepository(Media)
    private readonly mediaRepository: Repository<Media>,
    @InjectRepository(Album)
    private readonly albumRepository: Repository<Album>,
    @InjectRepository(Placement)
    private readonly placementRepository: Repository<Placement>,
  ) {}

  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Post('/uploads')
  async upload(
    @Req() req: Request,
    @Headers('content-type') contentType?: string,
    @Headers('content-length') contentLength?: string,
    @Query('w') width?: string,
    @Query('h') height?: string,
    @Query('d') durationMs?: string,
    @Query('takenAt') takenAt?: string,
    @Query('album') albumId?: string,
  ): Promise<LibraryItem> {
    const { sub } = req.user as AuthenticatedUser;
    if (!contentType) throw new BadRequestException({ code: 'UNSUPPORTED_MEDIA_TYPE' });
    const widthValue = Number(width);
    const heightValue = Number(height);
    const durationValue = Number(durationMs);
    let capturedAt: Date | null = null;
    if (takenAt) {
      const date = new Date(takenAt);
      capturedAt = Number.isNaN(date.getTime()) || date.getTime() > Date.now() ? null : date;
    }
    const media = await this.media.upload({
      ownerId: sub,
      role: 'content',
      stream: req,
      mimeType: contentType.split(';')[0].trim(),
      contentLength: Number(contentLength) || undefined,
      width: Number.isInteger(widthValue) && widthValue > 0 ? widthValue : null,
      height: Number.isInteger(heightValue) && heightValue > 0 ? heightValue : null,
      durationMs: Number.isInteger(durationValue) && durationValue > 0 ? durationValue : null,
      capturedAt,
    });

    if (albumId) {
      const album = await this.albumRepository.findOne({ where: { id: albumId, ownerId: sub } });
      if (album) {
        const last = await this.placementRepository
          .createQueryBuilder('p')
          .select('COALESCE(MAX(p.position), -1)', 'max')
          .where('p.albumId = :albumId', { albumId: album.id })
          .getRawOne<{ max: string }>();
        await this.placementRepository
          .createQueryBuilder()
          .insert()
          .into(Placement)
          .values([{ albumId: album.id, mediaId: media.id, position: Number(last?.max ?? -1) + 1 }])
          .orIgnore()
          .execute();
      }
    }

    return {
      ...this.media.view(media),
      bytes: media.bytes,
      takenAt: (media.capturedAt ?? media.createdAt).toISOString(),
      published: media.publishedAt !== null,
    };
  }

  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @Get('/summary')
  async summary(@Req() req: Request) {
    const { sub } = req.user as AuthenticatedUser;
    const totals = await this.mediaRepository
      .createQueryBuilder('m')
      .select('COUNT(*)', 'total')
      .addSelect('COALESCE(SUM(CAST(m.bytes AS BIGINT)), 0)', 'bytes')
      .where('m.ownerId = :sub', { sub })
      .andWhere("m.role = 'content'")
      .andWhere('m.publishedAt IS NULL')
      .getRawOne<{ total: string; bytes: string }>();
    const published = await this.mediaRepository.count({
      where: { ownerId: sub, role: 'content', publishedAt: Not(IsNull()) },
    });
    const months = await this.mediaRepository
      .createQueryBuilder('m')
      .select("TO_CHAR(DATE_TRUNC('month', COALESCE(m.capturedAt, m.createdAt)), 'YYYY-MM')", 'month')
      .addSelect('COUNT(*)', 'total')
      .where('m.ownerId = :sub', { sub })
      .andWhere("m.role = 'content'")
      .andWhere('m.publishedAt IS NULL')
      .groupBy('month')
      .orderBy('month', 'DESC')
      .getRawMany<{ month: string; total: string }>();
    const oldest = await this.mediaRepository
      .createQueryBuilder('m')
      .select('MIN(COALESCE(m.capturedAt, m.createdAt))', 'first')
      .where('m.ownerId = :sub', { sub })
      .andWhere("m.role = 'content'")
      .getRawOne<{ first: Date | null }>();
    return {
      counts: { private: Number(totals?.total ?? 0), published },
      bytes: String(totals?.bytes ?? 0),
      months: months.map((m) => ({ month: m.month, total: Number(m.total) })),
      firstAt: oldest?.first ? new Date(oldest.first).toISOString() : null,
      limits: this.media.limits(),
    };
  }

  @Throttle({ default: { limit: 240, ttl: 60000 } })
  @Get('/')
  async list(@Req() req: Request, @Query('album') albumId?: string, @Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    const { sub } = req.user as AuthenticatedUser;
    const take = Math.min(LIBRARY_LIMITS.PAGE_MAX, Math.max(1, Number(limit) || LIBRARY_LIMITS.PAGE_DEFAULT));
    const qb = this.mediaRepository
      .createQueryBuilder('m')
      .where('m.ownerId = :sub', { sub })
      .andWhere("m.role = 'content'")
      .orderBy('COALESCE(m.capturedAt, m.createdAt)', 'DESC')
      .addOrderBy('m.id', 'DESC')
      .limit(take + 1);
    if (albumId) {
      const album = await this.albumRepository.findOne({
        where: { id: albumId, ownerId: sub },
        select: { id: true },
      });
      if (!album) throw new NotFoundException({ code: 'ALBUM_NOT_FOUND' });
      qb.innerJoin(Placement, 'p', 'p.mediaId = m.id AND p.albumId = :albumId', { albumId });
    } else {
      qb.andWhere('m.publishedAt IS NULL');
    }
    if (cursor) {
      const [iso, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
      const ts = new Date(iso);
      if (Number.isNaN(ts.getTime()) || !id) throw new BadRequestException({ code: 'BAD_CURSOR' });
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
    let nextCursor: string | null = null;
    if (hasMore && last) {
      const at = last.capturedAt ?? last.createdAt;
      nextCursor = Buffer.from(`${at.toISOString()}|${last.id}`).toString('base64url');
    }
    return {
      items: items.map((m): LibraryItem => ({
        ...this.media.view(m),
        bytes: m.bytes,
        takenAt: (m.capturedAt ?? m.createdAt).toISOString(),
        published: m.publishedAt !== null,
      })),
      nextCursor,
    };
  }

  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post('/download')
  @HttpCode(HttpStatus.OK)
  async download(@Req() req: Request, @Body() dto: BulkIdsDto) {
    const { sub } = req.user as AuthenticatedUser;
    const rows = await this.mediaRepository.find({
      where: { id: In(dto.ids), ownerId: sub, role: 'content' },
    });
    if (!rows.length) throw new NotFoundException({ code: 'MEDIA_NOT_FOUND' });
    return {
      items: rows.map((m) => ({
        id: m.id,
        filename: `${m.id}.${extOf(m.mimeType)}`,
        url: this.media.view(m).url,
      })),
    };
  }

  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Patch('/publish')
  @HttpCode(HttpStatus.OK)
  async publish(@Req() req: Request, @Body() dto: BulkIdsDto) {
    const { sub } = req.user as AuthenticatedUser;
    const done = await this.media.publish(sub, dto.ids);

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
        if (m.role === 'avatar') return { id, code: 'AVATAR_NOT_ALLOWED' };
        if (m.publishedAt) return { id, code: 'ALREADY_PUBLIC' };
        return { id, code: 'PUBLISH_FAILED' };
      });
    }
    return { done, failed };
  }

  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Patch('/unpublish')
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
        if (m.role === 'avatar') return { id, code: 'AVATAR_NOT_ALLOWED' };
        if (!m.publishedAt) return { id, code: 'ALREADY_PRIVATE' };
        return { id, code: 'UNPUBLISH_FAILED' };
      });
    }
    return { done, failed };
  }

  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Delete('/media')
  @HttpCode(HttpStatus.OK)
  async destroy(@Req() req: Request, @Body() dto: BulkIdsDto) {
    const { sub } = req.user as AuthenticatedUser;
    const done = await this.media.destroy(sub, dto.ids);

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
        if (m.role === 'avatar') return { id, code: 'AVATAR_NOT_ALLOWED' };
        return { id, code: 'DELETE_FAILED' };
      });
    }
    return { done, failed };
  }

  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @Get('/albums')
  async albums(@Req() req: Request) {
    const { sub } = req.user as AuthenticatedUser;
    const albums = await this.albumRepository.find({
      where: { ownerId: sub },
      order: { updatedAt: 'DESC' },
    });
    if (!albums.length) return { albums: [] };
    const ids = albums.map((a) => a.id);

    const counts = await this.placementRepository
      .createQueryBuilder('p')
      .innerJoin(Media, 'm', 'm.id = p.mediaId')
      .select('p.albumId', 'id')
      .addSelect('COUNT(*)', 'total')
      .addSelect('COUNT(*) FILTER (WHERE m.publishedAt IS NOT NULL)', 'published')
      .where('p.albumId IN (:...ids)', { ids })
      .groupBy('p.albumId')
      .getRawMany<{ id: string; total: string; published: string }>();
    const totalById = new Map(counts.map((c) => [c.id, Number(c.total)]));
    const publishedById = new Map(counts.map((c) => [c.id, Number(c.published)]));

    const explicit = albums.map((a) => a.coverMediaId).filter((v): v is string => !!v);
    const missing = albums.filter((a) => !a.coverMediaId).map((a) => a.id);
    const firsts: { albumId: string; mediaId: string }[] = missing.length
      ? await this.placementRepository.manager.query(
          `SELECT DISTINCT ON (p."albumId") p."albumId", p."mediaId"
             FROM placements p
            WHERE p."albumId" = ANY($1)
            ORDER BY p."albumId", p.position ASC`,
          [missing],
        )
      : [];
    const coverIds = [...explicit, ...firsts.map((f) => f.mediaId)];
    const coverMedia = coverIds.length ? await this.mediaRepository.find({ where: { id: In(coverIds) } }) : [];
    const coverById = new Map(coverMedia.map((m) => [m.id, m]));
    const firstByAlbum = new Map(firsts.map((f) => [f.albumId, f.mediaId]));

    return {
      albums: albums.map((a) => {
        const mediaId = a.coverMediaId ?? firstByAlbum.get(a.id);
        const cover = mediaId ? coverById.get(mediaId) : undefined;
        return {
          id: a.id,
          title: a.title,
          total: totalById.get(a.id) ?? 0,
          published: publishedById.get(a.id) ?? 0,
          cover: cover ? this.media.view(cover) : null,
          updatedAt: a.updatedAt.toISOString(),
        };
      }),
    };
  }

  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post('/albums')
  async createAlbum(@Req() req: Request, @Body() dto: AlbumTitleDto) {
    const { sub } = req.user as AuthenticatedUser;
    const clash = await this.albumRepository.findOne({
      where: { ownerId: sub, title: dto.title },
      select: { id: true },
    });
    if (clash) throw new BadRequestException({ code: 'ALBUM_TITLE_TAKEN' });
    const album = await this.albumRepository.save(this.albumRepository.create({ ownerId: sub, title: dto.title }));

    let added = 0;
    if (dto.mediaIds?.length) {
      const rows = await this.mediaRepository.find({
        where: { id: In(dto.mediaIds), ownerId: sub, role: 'content' },
        select: { id: true },
      });
      const found = new Set(rows.map((r) => r.id));
      const owned = dto.mediaIds.filter((id) => found.has(id));

      if (owned.length) {
        const already = await this.placementRepository.count({
          where: { albumId: album.id, mediaId: In(owned) },
        });
        const last = await this.placementRepository
          .createQueryBuilder('p')
          .select('COALESCE(MAX(p.position), -1)', 'max')
          .where('p.albumId = :albumId', { albumId: album.id })
          .getRawOne<{ max: string }>();
        let position = Number(last?.max ?? -1) + 1;
        await this.placementRepository
          .createQueryBuilder()
          .insert()
          .into(Placement)
          .values(owned.map((mediaId) => ({ albumId: album.id, mediaId, position: position++ })))
          .orIgnore()
          .execute();
        added = owned.length - already;
      }
    }

    return {
      id: album.id,
      title: album.title,
      total: added,
      published: 0,
      cover: null,
      updatedAt: album.updatedAt.toISOString(),
    };
  }

  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Patch('/albums/:albumId')
  @HttpCode(HttpStatus.OK)
  async renameAlbum(@Req() req: Request, @Param('albumId', new ParseUUIDPipe({ version: '4' })) albumId: string, @Body() dto: AlbumTitleDto) {
    const { sub } = req.user as AuthenticatedUser;
    const album = await this.albumRepository.findOne({ where: { id: albumId, ownerId: sub } });
    if (!album) throw new NotFoundException({ code: 'ALBUM_NOT_FOUND' });
    if (dto.title !== album.title) {
      const clash = await this.albumRepository.findOne({
        where: { ownerId: sub, title: dto.title },
        select: { id: true },
      });
      if (clash) throw new BadRequestException({ code: 'ALBUM_TITLE_TAKEN' });
      album.title = dto.title;
      await this.albumRepository.save(album);
    }
    return { id: album.id, title: album.title };
  }

  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Post('/albums/:albumId/media')
  @HttpCode(HttpStatus.OK)
  async addToAlbum(@Req() req: Request, @Param('albumId', new ParseUUIDPipe({ version: '4' })) albumId: string, @Body() dto: BulkIdsDto) {
    const { sub } = req.user as AuthenticatedUser;
    const album = await this.albumRepository.findOne({ where: { id: albumId, ownerId: sub } });
    if (!album) throw new NotFoundException({ code: 'ALBUM_NOT_FOUND' });

    const rows = await this.mediaRepository.find({
      where: { id: In(dto.ids), ownerId: sub, role: 'content' },
      select: { id: true },
    });
    const found = new Set(rows.map((r) => r.id));
    const owned = dto.ids.filter((id) => found.has(id));
    if (!owned.length) throw new BadRequestException({ code: 'NO_MEDIA' });

    const already = await this.placementRepository.count({
      where: { albumId: album.id, mediaId: In(owned) },
    });
    const last = await this.placementRepository
      .createQueryBuilder('p')
      .select('COALESCE(MAX(p.position), -1)', 'max')
      .where('p.albumId = :albumId', { albumId: album.id })
      .getRawOne<{ max: string }>();
    let position = Number(last?.max ?? -1) + 1;
    await this.placementRepository
      .createQueryBuilder()
      .insert()
      .into(Placement)
      .values(owned.map((mediaId) => ({ albumId: album.id, mediaId, position: position++ })))
      .orIgnore()
      .execute();
    const added = owned.length - already;

    await this.albumRepository.update({ id: album.id }, { updatedAt: new Date() });
    return { added, skipped: owned.length - added };
  }

  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Delete('/albums/:albumId/media')
  @HttpCode(HttpStatus.OK)
  async removeFromAlbum(@Req() req: Request, @Param('albumId', new ParseUUIDPipe({ version: '4' })) albumId: string, @Body() dto: BulkIdsDto) {
    const { sub } = req.user as AuthenticatedUser;
    const album = await this.albumRepository.findOne({ where: { id: albumId, ownerId: sub } });
    if (!album) throw new NotFoundException({ code: 'ALBUM_NOT_FOUND' });
    const { affected } = await this.placementRepository.delete({ albumId, mediaId: In(dto.ids) });
    if (album.coverMediaId && dto.ids.includes(album.coverMediaId)) {
      await this.albumRepository.update({ id: album.id }, { coverMediaId: null });
    }
    return { removed: affected ?? 0 };
  }

  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Patch('/albums/:albumId/cover/:mediaId')
  @HttpCode(HttpStatus.OK)
  async setCover(@Req() req: Request, @Param('albumId', new ParseUUIDPipe({ version: '4' })) albumId: string, @Param('mediaId', new ParseUUIDPipe({ version: '4' })) mediaId: string) {
    const { sub } = req.user as AuthenticatedUser;
    const album = await this.albumRepository.findOne({ where: { id: albumId, ownerId: sub } });
    if (!album) throw new NotFoundException({ code: 'ALBUM_NOT_FOUND' });
    const placed = await this.placementRepository.findOne({ where: { albumId, mediaId } });
    if (!placed) throw new BadRequestException({ code: 'NOT_IN_ALBUM' });
    await this.albumRepository.update({ id: album.id }, { coverMediaId: mediaId });
    return { id: album.id, coverMediaId: mediaId };
  }

  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Delete('/albums/:albumId')
  @HttpCode(HttpStatus.OK)
  async deleteAlbum(@Req() req: Request, @Param('albumId', new ParseUUIDPipe({ version: '4' })) albumId: string) {
    const { sub } = req.user as AuthenticatedUser;
    const album = await this.albumRepository.findOne({ where: { id: albumId, ownerId: sub } });
    if (!album) throw new NotFoundException({ code: 'ALBUM_NOT_FOUND' });
    await this.albumRepository.delete({ id: album.id });
    return { success: true };
  }
}
