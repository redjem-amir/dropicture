// dropicture/apps/saas/backend/src/controllers/gallery.controller.ts
import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import type { Request } from 'express';
import { CdnService } from '../services/cdn.service';
import type { AuthenticatedUser } from '../services/auth.service';
import { Media } from '../models/media.entity';
import { Gallery, GALLERY_LIMITS, normalizeTag } from '../models/gallery.entity';
import { GalleryMedia } from '../models/gallery-media.entity';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

function slugify(title: string): string {
  return (
    title
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 64) || 'album'
  );
}

function cleanTags(raw: string[]): { tags: string[]; tagLabels: string[] } {
  const tags: string[] = [];
  const tagLabels: string[] = [];
  for (const entry of raw) {
    const label = entry.trim().slice(0, GALLERY_LIMITS.TAG_MAX);
    const tag = normalizeTag(label);
    if (!tag || tags.includes(tag)) continue;
    tags.push(tag);
    tagLabels.push(label);
    if (tags.length >= GALLERY_LIMITS.TAGS_MAX) break;
  }
  return { tags, tagLabels };
}

class CreateGalleryDto {
  @IsString()
  @MinLength(1, { message: 'TITLE_REQUIRED' })
  @MaxLength(GALLERY_LIMITS.TITLE_MAX, { message: 'TITLE_TOO_LONG' })
  @Transform(trim)
  title!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(GALLERY_LIMITS.TAGS_MAX, { message: 'TOO_MANY_TAGS' })
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200, { message: 'TOO_MANY_ITEMS' })
  @IsUUID('4', { each: true })
  mediaIds?: string[];
}

class UpdateGalleryDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'TITLE_REQUIRED' })
  @MaxLength(GALLERY_LIMITS.TITLE_MAX, { message: 'TITLE_TOO_LONG' })
  @Transform(trim)
  title?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(GALLERY_LIMITS.TAGS_MAX, { message: 'TOO_MANY_TAGS' })
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsUUID('4')
  coverMediaId?: string;
}

class MediaIdsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200, { message: 'TOO_MANY_ITEMS' })
  @IsUUID('4', { each: true })
  ids!: string[];
}

class ReorderDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(500, { message: 'TOO_MANY_ITEMS' })
  @IsUUID('4', { each: true })
  ids!: string[];
}

@Controller('/api/galleries')
@UseGuards(AuthGuard('access-token'))
export class GalleryController {
  constructor(
    private readonly cdn: CdnService,
    @InjectRepository(Gallery)
    private readonly galleryRepository: Repository<Gallery>,
    @InjectRepository(GalleryMedia)
    private readonly galleryMediaRepository: Repository<GalleryMedia>,
    @InjectRepository(Media)
    private readonly mediaRepository: Repository<Media>,
  ) {}

  private async stillPublicElsewhere(mediaIds: string[], exceptGalleryId: string): Promise<Set<string>> {
    if (!mediaIds.length) return new Set();
    const rows = await this.galleryMediaRepository
      .createQueryBuilder('gm')
      .innerJoin(Gallery, 'g', 'g.id = gm.galleryId')
      .select('gm.mediaId', 'mediaId')
      .where('gm.mediaId IN (:...ids)', { ids: mediaIds })
      .andWhere('gm.galleryId <> :except', { except: exceptGalleryId })
      .andWhere("g.visibility = 'public'")
      .andWhere('g.deletedAt IS NULL')
      .groupBy('gm.mediaId')
      .getRawMany<{ mediaId: string }>();
    return new Set(rows.map((r) => r.mediaId));
  }

  private async nextPosition(galleryId: string): Promise<number> {
    const last = await this.galleryMediaRepository.createQueryBuilder('gm').select('COALESCE(MAX(gm.position), -1)', 'max').where('gm.galleryId = :id', { id: galleryId }).getRawOne<{ max: string }>();
    return Number(last?.max ?? -1) + 1;
  }

  private async uniqueSlug(ownerId: string, title: string, selfId?: string): Promise<string> {
    const base = slugify(title);
    for (let i = 0; i < 50; i++) {
      const candidate = i ? `${base}-${i + 1}` : base;
      const clash = await this.galleryRepository.findOne({
        where: { ownerId, slug: candidate, deletedAt: IsNull() },
        select: { id: true },
      });
      if (!clash || clash.id === selfId) return candidate;
    }
    return `${base}-${Date.now().toString(36)}`;
  }

  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @Get('/')
  async list(@Req() req: Request) {
    const { sub } = req.user as AuthenticatedUser;
    const galleries = await this.galleryRepository.find({
      where: { ownerId: sub, deletedAt: IsNull() },
      order: { updatedAt: 'DESC' },
    });
    if (!galleries.length) return { galleries: [] };

    const counts = await this.galleryMediaRepository
      .createQueryBuilder('gm')
      .select('gm.galleryId', 'id')
      .addSelect('COUNT(*)', 'total')
      .where('gm.galleryId IN (:...ids)', { ids: galleries.map((g) => g.id) })
      .groupBy('gm.galleryId')
      .getRawMany<{ id: string; total: string }>();
    const totalById = new Map(counts.map((c) => [c.id, Number(c.total)]));

    const explicit = galleries.map((g) => g.coverMediaId).filter((v): v is string => !!v);
    const missing = galleries.filter((g) => !g.coverMediaId).map((g) => g.id);

    const firsts = missing.length
      ? await this.galleryMediaRepository
          .createQueryBuilder('gm')
          .select('DISTINCT ON (gm.galleryId) gm.galleryId', 'galleryId')
          .addSelect('gm.mediaId', 'mediaId')
          .where('gm.galleryId IN (:...ids)', { ids: missing })
          .orderBy('gm.galleryId')
          .addOrderBy('gm.position', 'ASC')
          .getRawMany<{ galleryId: string; mediaId: string }>()
      : [];

    const ids = [...explicit, ...firsts.map((f) => f.mediaId)];
    const media = ids.length ? await this.mediaRepository.find({ where: { id: In(ids), deletedAt: IsNull() } }) : [];
    const byId = new Map(media.map((m) => [m.id, m]));
    const firstByGallery = new Map(firsts.map((f) => [f.galleryId, f.mediaId]));
    const covers = new Map(
      galleries.map((g) => {
        const mediaId = g.coverMediaId ?? firstByGallery.get(g.id);
        const m = mediaId ? byId.get(mediaId) : undefined;
        return [g.id, m ? { id: m.id, kind: m.kind, ...this.cdn.urlsFor(m) } : null];
      }),
    );

    return {
      galleries: galleries.map((g) => ({
        id: g.id,
        title: g.title,
        slug: g.slug,
        tags: g.tagLabels ?? [],
        visibility: g.visibility,
        publishedAt: g.publishedAt?.toISOString() ?? null,
        total: totalById.get(g.id) ?? 0,
        cover: covers.get(g.id) ?? null,
      })),
    };
  }

  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @Get('/:galleryId')
  async show(@Req() req: Request, @Param('galleryId', new ParseUUIDPipe({ version: '4' })) galleryId: string) {
    const { sub } = req.user as AuthenticatedUser;
    const gallery = await this.galleryRepository.findOne({
      where: { id: galleryId, ownerId: sub, deletedAt: IsNull() },
    });
    if (!gallery) throw new NotFoundException({ code: 'GALLERY_NOT_FOUND' });
    const links = await this.galleryMediaRepository.find({
      where: { galleryId },
      order: { position: 'ASC' },
    });
    const media = links.length
      ? await this.mediaRepository.find({
          where: { id: In(links.map((l) => l.mediaId)), ownerId: sub, deletedAt: IsNull() },
        })
      : [];
    const byId = new Map(media.map((m) => [m.id, m]));

    return {
      id: gallery.id,
      title: gallery.title,
      slug: gallery.slug,
      tags: gallery.tagLabels ?? [],
      visibility: gallery.visibility,
      publishedAt: gallery.publishedAt?.toISOString() ?? null,
      coverMediaId: gallery.coverMediaId,
      items: links
        .map((l) => byId.get(l.mediaId))
        .filter((m): m is Media => !!m)
        .map((m) => ({
          id: m.id,
          kind: m.kind,
          status: m.status,
          visibility: m.visibility,
          width: m.width,
          height: m.height,
          durationMs: m.durationMs,
          ...this.cdn.urlsFor(m),
        })),
    };
  }

  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post('/')
  async create(@Req() req: Request, @Body() dto: CreateGalleryDto) {
    const { sub } = req.user as AuthenticatedUser;
    const { tags, tagLabels } = cleanTags(dto.tags ?? []);
    const slug = await this.uniqueSlug(sub, dto.title);
    const gallery = await this.galleryRepository.save(
      this.galleryRepository.create({
        ownerId: sub,
        title: dto.title,
        slug,
        tags,
        tagLabels,
        visibility: 'private',
      }),
    );
    const attachIds = dto.mediaIds ?? [];
    let added = 0;
    if (attachIds.length) {
      const media = await this.mediaRepository.find({
        where: { id: In(attachIds), ownerId: sub, purpose: 'content', status: 'ready', deletedAt: IsNull() },
        select: { id: true },
      });
      if (!media.length) throw new BadRequestException({ code: 'NO_READY_MEDIA' });
      let position = await this.nextPosition(gallery.id);
      await this.galleryMediaRepository
        .createQueryBuilder()
        .insert()
        .into(GalleryMedia)
        .values(media.map((m) => ({ galleryId: gallery.id, mediaId: m.id, position: position++ })))
        .orIgnore()
        .execute();
      added = media.length;
    }
    return {
      id: gallery.id,
      title: gallery.title,
      slug: gallery.slug,
      tags: gallery.tagLabels,
      visibility: gallery.visibility,
      total: added,
    };
  }

  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Patch('/:galleryId')
  async update(@Req() req: Request, @Param('galleryId', new ParseUUIDPipe({ version: '4' })) galleryId: string, @Body() dto: UpdateGalleryDto) {
    const { sub } = req.user as AuthenticatedUser;
    const gallery = await this.galleryRepository.findOne({
      where: { id: galleryId, ownerId: sub, deletedAt: IsNull() },
    });
    if (!gallery) throw new NotFoundException({ code: 'GALLERY_NOT_FOUND' });

    if (dto.title && dto.title !== gallery.title) {
      gallery.title = dto.title;
      if (gallery.visibility !== 'public') {
        gallery.slug = await this.uniqueSlug(sub, dto.title, gallery.id);
      }
    }
    if (dto.tags) {
      const { tags, tagLabels } = cleanTags(dto.tags);
      gallery.tags = tags;
      gallery.tagLabels = tagLabels;
    }
    if (dto.coverMediaId) {
      const link = await this.galleryMediaRepository.findOne({
        where: { galleryId, mediaId: dto.coverMediaId },
      });
      if (!link) throw new BadRequestException({ code: 'COVER_NOT_IN_GALLERY' });
      gallery.coverMediaId = dto.coverMediaId;
    }
    await this.galleryRepository.save(gallery);
    return { id: gallery.id, title: gallery.title, slug: gallery.slug, tags: gallery.tagLabels };
  }

  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Post('/:galleryId/media')
  @HttpCode(HttpStatus.OK)
  async addMedia(@Req() req: Request, @Param('galleryId', new ParseUUIDPipe({ version: '4' })) galleryId: string, @Body() dto: MediaIdsDto) {
    const { sub } = req.user as AuthenticatedUser;
    const gallery = await this.galleryRepository.findOne({
      where: { id: galleryId, ownerId: sub, deletedAt: IsNull() },
    });
    if (!gallery) throw new NotFoundException({ code: 'GALLERY_NOT_FOUND' });
    const media = await this.mediaRepository.find({
      where: { id: In(dto.ids), ownerId: sub, purpose: 'content', status: 'ready', deletedAt: IsNull() },
      select: { id: true },
    });
    if (!media.length) throw new BadRequestException({ code: 'NO_READY_MEDIA' });

    let position = await this.nextPosition(gallery.id);
    await this.galleryMediaRepository
      .createQueryBuilder()
      .insert()
      .into(GalleryMedia)
      .values(media.map((m) => ({ galleryId: gallery.id, mediaId: m.id, position: position++ })))
      .orIgnore()
      .execute();

    if (gallery.visibility === 'public') {
      await this.cdn.publishMany(
        sub,
        media.map((m) => m.id),
      );
    }
    return { added: media.length, visibility: gallery.visibility };
  }

  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Delete('/:galleryId/media')
  @HttpCode(HttpStatus.OK)
  async removeMedia(@Req() req: Request, @Param('galleryId', new ParseUUIDPipe({ version: '4' })) galleryId: string, @Body() dto: MediaIdsDto) {
    const { sub } = req.user as AuthenticatedUser;
    const gallery = await this.galleryRepository.findOne({
      where: { id: galleryId, ownerId: sub, deletedAt: IsNull() },
    });
    if (!gallery) throw new NotFoundException({ code: 'GALLERY_NOT_FOUND' });
    await this.galleryMediaRepository.delete({ galleryId, mediaId: In(dto.ids) });

    if (gallery.visibility === 'public') {
      const keep = await this.stillPublicElsewhere(dto.ids, galleryId);
      await this.cdn.unpublishMany(
        sub,
        dto.ids.filter((id) => !keep.has(id)),
      );
    }
    if (gallery.coverMediaId && dto.ids.includes(gallery.coverMediaId)) {
      gallery.coverMediaId = null;
      await this.galleryRepository.save(gallery);
    }
    return { removed: dto.ids.length };
  }

  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Patch('/:galleryId/order')
  @HttpCode(HttpStatus.OK)
  async reorder(@Req() req: Request, @Param('galleryId', new ParseUUIDPipe({ version: '4' })) galleryId: string, @Body() dto: ReorderDto) {
    const { sub } = req.user as AuthenticatedUser;
    const gallery = await this.galleryRepository.findOne({
      where: { id: galleryId, ownerId: sub, deletedAt: IsNull() },
    });
    if (!gallery) throw new NotFoundException({ code: 'GALLERY_NOT_FOUND' });
    await this.galleryMediaRepository.manager.transaction(async (trx) => {
      for (const [position, mediaId] of dto.ids.entries()) {
        await trx.update(GalleryMedia, { galleryId, mediaId }, { position });
      }
    });
    return { ordered: dto.ids.length };
  }

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('/:galleryId/publish')
  @HttpCode(HttpStatus.OK)
  async publish(@Req() req: Request, @Param('galleryId', new ParseUUIDPipe({ version: '4' })) galleryId: string) {
    const { sub } = req.user as AuthenticatedUser;
    const gallery = await this.galleryRepository.findOne({
      where: { id: galleryId, ownerId: sub, deletedAt: IsNull() },
    });
    if (!gallery) throw new NotFoundException({ code: 'GALLERY_NOT_FOUND' });
    const links = await this.galleryMediaRepository.find({
      where: { galleryId },
      order: { position: 'ASC' },
    });
    if (!links.length) throw new BadRequestException({ code: 'GALLERY_EMPTY' });
    const ordered = links.map((l) => l.mediaId);
    const published = await this.cdn.publishMany(sub, ordered);
    if (!published.length) throw new BadRequestException({ code: 'NOTHING_PUBLISHABLE' });

    const publishedSet = new Set(published);
    const skipped = ordered.filter((id) => !publishedSet.has(id));

    gallery.visibility = 'public';
    gallery.publishedAt = gallery.publishedAt ?? new Date();
    gallery.coverMediaId = gallery.coverMediaId ?? ordered.find((id) => publishedSet.has(id)) ?? null;
    await this.galleryRepository.save(gallery);
    return { id: gallery.id, visibility: 'public', published: published.length, skipped };
  }

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('/:galleryId/unpublish')
  @HttpCode(HttpStatus.OK)
  async unpublish(@Req() req: Request, @Param('galleryId', new ParseUUIDPipe({ version: '4' })) galleryId: string) {
    const { sub } = req.user as AuthenticatedUser;
    const gallery = await this.galleryRepository.findOne({
      where: { id: galleryId, ownerId: sub, deletedAt: IsNull() },
    });
    if (!gallery) throw new NotFoundException({ code: 'GALLERY_NOT_FOUND' });
    const links = await this.galleryMediaRepository.find({ where: { galleryId } });
    const mediaIds = links.map((l) => l.mediaId);
    const keep = await this.stillPublicElsewhere(mediaIds, galleryId);
    await this.cdn.unpublishMany(
      sub,
      mediaIds.filter((id) => !keep.has(id)),
    );

    gallery.visibility = 'private';
    await this.galleryRepository.save(gallery);
    return { id: gallery.id, visibility: 'private' };
  }

  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Delete('/:galleryId')
  @HttpCode(HttpStatus.OK)
  async remove(@Req() req: Request, @Param('galleryId', new ParseUUIDPipe({ version: '4' })) galleryId: string) {
    const { sub } = req.user as AuthenticatedUser;
    const gallery = await this.galleryRepository.findOne({
      where: { id: galleryId, ownerId: sub, deletedAt: IsNull() },
    });
    if (!gallery) throw new NotFoundException({ code: 'GALLERY_NOT_FOUND' });
    const links = await this.galleryMediaRepository.find({ where: { galleryId } });
    if (gallery.visibility === 'public') {
      const mediaIds = links.map((l) => l.mediaId);
      const keep = await this.stillPublicElsewhere(mediaIds, galleryId);
      await this.cdn.unpublishMany(
        sub,
        mediaIds.filter((id) => !keep.has(id)),
      );
    }
    await this.galleryMediaRepository.delete({ galleryId });
    gallery.visibility = 'private';
    gallery.deletedAt = new Date();
    await this.galleryRepository.save(gallery);
    return { success: true };
  }
}
