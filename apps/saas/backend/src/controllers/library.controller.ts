// dropicture/apps/saas/backend/src/controllers/library.controller.ts
import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, IsNull, Repository } from 'typeorm';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { Request } from 'express';
import { CdnService, MIME, ORIGINAL_KEY_RE } from '../services/cdn.service';
import type { AuthenticatedUser } from '../services/auth.service';
import { Media } from '../models/media.entity';

const VISIBLE_STATUSES = ['pending', 'queued', 'processing', 'ready', 'failed', 'rejected'];

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

function errorCode(err: unknown): string {
  const body = (err as { response?: unknown })?.response;
  if (body && typeof body === 'object' && 'code' in body) return String(body.code);
  return 'OPERATION_FAILED';
}

class BulkIdsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200, { message: 'TOO_MANY_ITEMS' })
  @IsUUID('4', { each: true })
  ids!: string[];
}

class CreateUploadDto {
  @IsString()
  @IsIn(Object.keys(MIME), { message: 'UNSUPPORTED_MEDIA_TYPE' })
  contentType!: string;

  @IsInt()
  @Min(1)
  contentLength!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationMs?: number;
}

class MultipartPartDto {
  @IsInt()
  @Min(1)
  partNumber!: number;

  @IsString()
  etag!: string;
}

class CompleteMultipartDto {
  @IsString()
  @Matches(ORIGINAL_KEY_RE, { message: 'BAD_KEY' })
  key!: string;

  @IsString()
  uploadId!: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => MultipartPartDto)
  parts!: MultipartPartDto[];
}

class AbortMultipartDto {
  @IsString()
  @Matches(ORIGINAL_KEY_RE, { message: 'BAD_KEY' })
  key!: string;

  @IsString()
  uploadId!: string;
}

@Controller('/api/library')
@UseGuards(AuthGuard('access-token'))
export class LibraryController {
  constructor(
    private readonly cdn: CdnService,
    @InjectRepository(Media)
    private readonly mediaRepository: Repository<Media>,
  ) {}

  private async explainFailures(ownerId: string, ids: string[], fallback: string): Promise<{ id: string; code: string }[]> {
    if (!ids.length) return [];
    const rows = await this.mediaRepository.find({
      where: { id: In(ids), ownerId },
      select: { id: true, status: true, purpose: true, deletedAt: true },
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return ids.map((id) => {
      const m = byId.get(id);
      if (!m || m.deletedAt) return { id, code: 'MEDIA_NOT_FOUND' };
      if (m.purpose === 'avatar') return { id, code: 'AVATAR_ALWAYS_PUBLIC' };
      if (m.status !== 'ready') return { id, code: 'MEDIA_NOT_READY' };
      return { id, code: fallback };
    });
  }

  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @Get('/summary')
  async summary(@Req() req: Request) {
    const { sub } = req.user as AuthenticatedUser;
    const totals = await this.mediaRepository
      .createQueryBuilder('m')
      .select('m.visibility', 'visibility')
      .addSelect('m.status', 'status')
      .addSelect('COUNT(*)', 'total')
      .addSelect('COALESCE(SUM(CAST(m.bytes AS BIGINT)), 0)', 'bytes')
      .where('m.ownerId = :sub', { sub })
      .andWhere('m.purpose = :p', { p: 'content' })
      .andWhere('m.deletedAt IS NULL')
      .groupBy('m.visibility')
      .addGroupBy('m.status')
      .getRawMany<{ visibility: string; status: string; total: string; bytes: string }>();
    let published = 0;
    let privateCount = 0;
    let pending = 0;
    let failed = 0;
    let bytes = 0;
    for (const row of totals) {
      const n = Number(row.total);
      bytes += Number(row.bytes);
      if (row.status === 'ready') {
        if (row.visibility === 'public') published += n;
        else privateCount += n;
      } else if (row.status === 'failed' || row.status === 'rejected') {
        failed += n;
      } else {
        pending += n;
      }
    }
    const months = await this.mediaRepository
      .createQueryBuilder('m')
      .select("TO_CHAR(DATE_TRUNC('month', COALESCE(m.capturedAt, m.createdAt)), 'YYYY-MM')", 'month')
      .addSelect('COUNT(*)', 'total')
      .addSelect('COALESCE(SUM(CAST(m.bytes AS BIGINT)), 0)', 'bytes')
      .where('m.ownerId = :sub', { sub })
      .andWhere('m.purpose = :p', { p: 'content' })
      .andWhere('m.status IN (:...st)', { st: VISIBLE_STATUSES })
      .andWhere('m.deletedAt IS NULL')
      .groupBy('month')
      .orderBy('month', 'DESC')
      .getRawMany<{ month: string; total: string; bytes: string }>();
    const oldest = await this.mediaRepository
      .createQueryBuilder('m')
      .select('MIN(COALESCE(m.capturedAt, m.createdAt))', 'first')
      .where('m.ownerId = :sub', { sub })
      .andWhere('m.purpose = :p', { p: 'content' })
      .andWhere('m.deletedAt IS NULL')
      .getRawOne<{ first: Date | null }>();
    return {
      counts: {
        total: published + privateCount,
        published,
        private: privateCount,
        pending,
        failed,
      },
      bytes: String(bytes),
      months: months.map((m) => ({
        month: m.month,
        total: Number(m.total),
        bytes: String(m.bytes),
      })),
      firstAt: oldest?.first ? new Date(oldest.first).toISOString() : null,
      limits: this.cdn.limits(),
    };
  }

  @Throttle({ default: { limit: 240, ttl: 60000 } })
  @Get('/')
  async list(@Req() req: Request, @Query('filter') filter?: string, @Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    const { sub } = req.user as AuthenticatedUser;
    const take = Math.min(120, Math.max(1, Number(limit) || 60));
    const qb = this.mediaRepository
      .createQueryBuilder('m')
      .where('m.ownerId = :sub', { sub })
      .andWhere('m.purpose = :p', { p: 'content' })
      .andWhere('m.status IN (:...st)', { st: VISIBLE_STATUSES })
      .andWhere('m.deletedAt IS NULL')
      .orderBy('COALESCE(m.capturedAt, m.createdAt)', 'DESC')
      .addOrderBy('m.id', 'DESC')
      .limit(take + 1);
    if (filter === 'published') qb.andWhere('m.visibility = :v', { v: 'public' });
    if (filter === 'private') {
      qb.andWhere('m.visibility = :v', { v: 'private' }).andWhere('m.status = :ready', { ready: 'ready' });
    }
    if (filter === 'processing') qb.andWhere('m.status <> :ready', { ready: 'ready' });
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
        status: m.status,
        visibility: m.visibility,
        width: m.width,
        height: m.height,
        durationMs: m.durationMs,
        bytes: m.bytes,
        errorCode: m.errorCode,
        takenAt: (m.capturedAt ?? m.createdAt).toISOString(),
        ...this.cdn.urlsFor(m),
      })),
      nextCursor: hasMore && last ? encodeCursor(last.capturedAt ?? last.createdAt, last.id) : null,
    };
  }

  @Throttle({ default: { limit: 240, ttl: 60000 } })
  @Post('/status')
  @HttpCode(HttpStatus.OK)
  async status(@Req() req: Request, @Body() dto: BulkIdsDto) {
    const { sub } = req.user as AuthenticatedUser;
    const rows = await this.mediaRepository.find({
      where: { id: In(dto.ids), ownerId: sub, deletedAt: IsNull() },
    });
    return {
      items: rows.map((m) => ({
        id: m.id,
        kind: m.kind,
        status: m.status,
        visibility: m.visibility,
        width: m.width,
        height: m.height,
        durationMs: m.durationMs,
        bytes: m.bytes,
        errorCode: m.errorCode,
        takenAt: (m.capturedAt ?? m.createdAt).toISOString(),
        ...this.cdn.urlsFor(m),
      })),
    };
  }

  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post('/download')
  @HttpCode(HttpStatus.OK)
  async download(@Req() req: Request, @Body() dto: BulkIdsDto) {
    const { sub } = req.user as AuthenticatedUser;
    const rows = await this.mediaRepository.find({
      where: { id: In(dto.ids), ownerId: sub, deletedAt: IsNull() },
    });
    if (!rows.length) throw new NotFoundException({ code: 'MEDIA_NOT_FOUND' });
    return {
      items: await Promise.all(
        rows.map(async (m) => ({
          id: m.id,
          filename: `${m.id}.${m.ext}`,
          url: await this.cdn.originalUrl(m, 300),
        })),
      ),
    };
  }

  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Patch('/publish')
  @HttpCode(HttpStatus.OK)
  async publish(@Req() req: Request, @Body() dto: BulkIdsDto) {
    const { sub } = req.user as AuthenticatedUser;
    const done = await this.cdn.publishMany(sub, dto.ids);
    const doneSet = new Set(done);
    const failed = await this.explainFailures(
      sub,
      dto.ids.filter((id) => !doneSet.has(id)),
      'PUBLISH_FAILED',
    );
    return { done, failed };
  }

  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Patch('/unpublish')
  @HttpCode(HttpStatus.OK)
  async unpublish(@Req() req: Request, @Body() dto: BulkIdsDto) {
    const { sub } = req.user as AuthenticatedUser;
    const done = await this.cdn.unpublishMany(sub, dto.ids);
    const doneSet = new Set(done);
    const failed = await this.explainFailures(
      sub,
      dto.ids.filter((id) => !doneSet.has(id)),
      'UNPUBLISH_FAILED',
    );
    return { done, failed };
  }

  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Post('/trash')
  @HttpCode(HttpStatus.OK)
  async trash(@Req() req: Request, @Body() dto: BulkIdsDto) {
    const { sub } = req.user as AuthenticatedUser;
    const done: string[] = [];
    const failed: { id: string; code: string }[] = [];
    for (const id of dto.ids) {
      try {
        await this.cdn.trashMedia(sub, id);
        done.push(id);
      } catch (err) {
        failed.push({ id, code: errorCode(err) });
      }
    }
    return { done, failed };
  }

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('/destroy')
  @HttpCode(HttpStatus.OK)
  async destroy(@Req() req: Request, @Body() dto: BulkIdsDto) {
    const { sub } = req.user as AuthenticatedUser;
    const done: string[] = [];
    const failed: { id: string; code: string }[] = [];
    for (const id of dto.ids) {
      try {
        await this.cdn.destroyMedia(sub, id);
        done.push(id);
      } catch (err) {
        failed.push({ id, code: errorCode(err) });
      }
    }
    return { done, failed };
  }

  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @Post('/uploads')
  async createUpload(@Req() req: Request, @Body() dto: CreateUploadDto) {
    const { sub } = req.user as AuthenticatedUser;
    return this.cdn.createUpload({
      ownerId: sub,
      contentType: dto.contentType,
      contentLength: dto.contentLength,
      durationMs: dto.durationMs,
      purpose: 'content',
    });
  }

  @Throttle({ default: { limit: 240, ttl: 60000 } })
  @Post('/uploads/:mediaId/multipart/complete')
  @HttpCode(HttpStatus.OK)
  async completeMultipart(@Req() req: Request, @Param('mediaId', new ParseUUIDPipe({ version: '4' })) mediaId: string, @Body() dto: CompleteMultipartDto) {
    const { sub } = req.user as AuthenticatedUser;
    if (!dto.key.startsWith(`originals/${sub}/${mediaId}.`)) {
      throw new BadRequestException({ code: 'BAD_KEY' });
    }
    const { size } = await this.cdn.completeMultipart({
      key: dto.key,
      uploadId: dto.uploadId,
      parts: dto.parts.map((p) => ({ partNumber: p.partNumber, etag: p.etag })),
    });
    return { key: dto.key, size: String(size) };
  }

  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @Post('/uploads/:mediaId/multipart/abort')
  @HttpCode(HttpStatus.OK)
  async abortMultipart(@Req() req: Request, @Param('mediaId', new ParseUUIDPipe({ version: '4' })) mediaId: string, @Body() dto: AbortMultipartDto) {
    const { sub } = req.user as AuthenticatedUser;
    if (!dto.key.startsWith(`originals/${sub}/${mediaId}.`)) {
      throw new BadRequestException({ code: 'BAD_KEY' });
    }
    await this.cdn.abortMultipart(dto.key, dto.uploadId);
    await this.cdn.destroyMedia(sub, mediaId).catch(() => undefined);
    return { success: true };
  }

  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @Post('/uploads/:mediaId/complete')
  @HttpCode(HttpStatus.OK)
  async completeUpload(@Req() req: Request, @Param('mediaId', new ParseUUIDPipe({ version: '4' })) mediaId: string) {
    const { sub } = req.user as AuthenticatedUser;
    const media = await this.cdn.completeUpload(sub, mediaId);
    if (media.purpose !== 'content') {
      throw new BadRequestException({ code: 'NOT_A_LIBRARY_MEDIA' });
    }
    return {
      id: media.id,
      kind: media.kind,
      status: media.status,
      visibility: media.visibility,
      width: media.width,
      height: media.height,
      durationMs: media.durationMs,
      bytes: media.bytes,
      errorCode: media.errorCode,
      takenAt: (media.capturedAt ?? media.createdAt).toISOString(),
      ...this.cdn.urlsFor(media),
    };
  }
}
