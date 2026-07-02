// dropicture/apps/backend/src/controllers/pictures.controller.ts
import { Body, Controller, Delete, Get, HttpCode, HttpException, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, Req, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { Throttle } from '@nestjs/throttler';
import { ArrayNotEmpty, IsArray, IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { extname, join } from 'path';
import { Readable } from 'stream';
import { spawn } from 'child_process';
import { mkdtemp, readFile, writeFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import sharp from 'sharp';
import exifReader from 'exif-reader';
import ffmpegPath from 'ffmpeg-static';
import { Picture, PictureKind } from '../models/picture.model';
import { Album } from '../models/album.model';
import { ShareLink, ShareKind } from '../models/share-link.model';
import type { AuthenticatedUser } from '../services/auth.service';
import { StorageService } from '../services/storage.service';

const DEFAULT_LIMIT = 60;
const MAX_LIMIT = 100;
const MAX_FILES_PER_UPLOAD = 50;
const MAX_FILE_BYTES = 100 * 1024 * 1024;
const FILE_URL_TTL = 3600;

const MAX_SIMILAR_SCAN = 6000;
const REINDEX_BATCH = 25;

interface UploadedFileLike {
    originalname: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
}

interface ImageAnalysis {
    sha256: string;
    phash: string | null;
    width: number | null;
    height: number | null;
    takenAt: Date | null;
}

export class UpdatePictureDto {
    @IsOptional() @IsBoolean() favorite?: boolean;
    @IsOptional() @IsBoolean() archived?: boolean;
}

export class AlbumNameDto {
    @IsString() @IsNotEmpty({ message: 'MISSING_FIELDS' }) @MaxLength(80, { message: 'INVALID_ALBUM_NAME' })
    name: string | undefined;
}

export class AddPicturesDto {
    @IsArray() @ArrayNotEmpty() @IsUUID('4', { each: true })
    pictureIds: string[] = [];
}

export class CreateShareDto {
    @IsOptional() @IsUUID('4')
    albumId?: string;

    @IsOptional() @IsArray() @ArrayNotEmpty() @IsUUID('4', { each: true })
    pictureIds?: string[];

    @IsOptional() @IsInt() @Min(1) @Max(365)
    expiresInDays?: number;
}

export class CreateAlbumFromSuggestionDto {
    @IsString() @IsNotEmpty({ message: 'MISSING_FIELDS' }) @MaxLength(80, { message: 'INVALID_ALBUM_NAME' })
    name: string | undefined;

    @IsArray() @ArrayNotEmpty() @IsUUID('4', { each: true })
    pictureIds: string[] = [];
}

@Controller('/api/pictures')
export class PicturesController {
    constructor(
        @InjectRepository(Picture)
        private readonly pictureRepository: Repository<Picture>,
        @InjectRepository(Album)
        private readonly albumRepository: Repository<Album>,
        @InjectRepository(ShareLink)
        private readonly shareRepository: Repository<ShareLink>,
        private readonly storage: StorageService,
    ) { }

    private ownerId(req: Request): string {
        return (req.user as AuthenticatedUser).sub;
    }

    private kindFromMime(mime: string): PictureKind | null {
        if (!mime) return null;
        if (mime.startsWith('image/')) return PictureKind.IMAGE;
        if (mime.startsWith('video/')) return PictureKind.VIDEO;
        return null;
    }

    private encodeCursor(date: Date, id: string): string {
        return Buffer.from(`${date.toISOString()}|${id}`).toString('base64url');
    }

    private decodeCursor(cursor?: string): { ts: Date; id: string } | null {
        if (!cursor) return null;
        try {
            const [iso, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
            const ts = new Date(iso);
            if (Number.isNaN(ts.getTime()) || !id) return null;
            return { ts, id };
        } catch {
            return null;
        }
    }

    private fileUrl(p: Picture): Promise<string> {
        return this.storage.getPresignedUrl(p.storageKey, FILE_URL_TTL);
    }

    private async posterUrlFor(p: Picture): Promise<string | null> {
        return p.thumbnailKey ? this.storage.getPresignedUrl(p.thumbnailKey, FILE_URL_TTL) : null;
    }

    private async coverUrlFor(p: Picture): Promise<string> {
        if (p.kind === PictureKind.VIDEO && p.thumbnailKey) {
            return this.storage.getPresignedUrl(p.thumbnailKey, FILE_URL_TTL);
        }
        return this.fileUrl(p);
    }

    private async pictureDto(p: Picture) {
        return {
            id: p.id,
            filename: p.filename,
            mimeType: p.mimeType,
            kind: p.kind,
            sizeBytes: Number(p.sizeBytes),
            width: p.width,
            height: p.height,
            durationSeconds: p.durationSeconds,
            favorite: p.favorite,
            archived: p.archived,
            takenAt: p.takenAt,
            createdAt: p.createdAt,
            url: await this.fileUrl(p),
            posterUrl: await this.posterUrlFor(p),
        };
    }

    private async albumDto(album: Album) {
        const pics = album.pictures ?? [];
        const cover = pics.length
            ? [...pics].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0]
            : null;
        return {
            id: album.id,
            name: album.name,
            count: pics.length,
            coverUrl: cover ? await this.coverUrlFor(cover) : null,
            createdAt: album.createdAt,
            updatedAt: album.updatedAt,
        };
    }

    private shareDto(s: ShareLink) {
        return {
            id: s.id,
            token: s.token,
            kind: s.kind,
            title: s.title,
            items: s.itemCount,
            views: s.views,
            albumId: s.albumId,
            expiresAt: s.expiresAt,
            createdAt: s.createdAt,
            path: `/share/${s.token}`,
        };
    }

    private async cleanupSharesForPicture(owner: string, pictureId: string): Promise<void> {
        const selectionShares = await this.shareRepository.find({
            where: { ownerId: owner, kind: ShareKind.SELECTION },
        });
        for (const share of selectionShares) {
            const ids = share.pictureIds ?? [];
            if (!ids.includes(pictureId)) continue;
            const remaining = ids.filter(id => id !== pictureId);
            if (remaining.length === 0) {
                await this.shareRepository.delete({ id: share.id });
            } else {
                share.pictureIds = remaining;
                share.itemCount = remaining.length;
                share.title = `${remaining.length} photo${remaining.length > 1 ? 's' : ''}`;
                await this.shareRepository.save(share);
            }
        }
    }

    @Throttle({ default: { limit: 120, ttl: 60000 } })
    @UseGuards(AuthGuard('access-token'))
    @Get('/albums')
    async listAlbums(@Req() req: Request) {
        const albums = await this.albumRepository.find({
            where: { ownerId: this.ownerId(req) },
            relations: { pictures: true },
            order: { createdAt: 'DESC' },
        });
        return { items: await Promise.all(albums.map(a => this.albumDto(a))) };
    }

    @Throttle({ default: { limit: 120, ttl: 60000 } })
    @UseGuards(AuthGuard('access-token'))
    @Get('/albums/:albumId')
    async getAlbum(@Param('albumId', new ParseUUIDPipe()) albumId: string, @Req() req: Request) {
        const album = await this.albumRepository.findOne({
            where: { id: albumId, ownerId: this.ownerId(req) },
            relations: { pictures: true },
        });
        if (!album) throw new HttpException({ code: 'ALBUM_NOT_FOUND' }, HttpStatus.NOT_FOUND);
        const items = await Promise.all(
            (album.pictures ?? [])
                .filter(p => !p.deletedAt)
                .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
                .map(p => this.pictureDto(p)),
        );
        return { album: await this.albumDto(album), items };
    }

    @Throttle({ default: { limit: 30, ttl: 60000 } })
    @UseGuards(AuthGuard('access-token'))
    @Post('/albums')
    @HttpCode(HttpStatus.CREATED)
    async createAlbum(@Body() body: AlbumNameDto, @Req() req: Request) {
        if (!body.name?.trim()) throw new HttpException({ code: 'MISSING_FIELDS' }, HttpStatus.BAD_REQUEST);
        const album = await this.albumRepository.save(
            this.albumRepository.create({ ownerId: this.ownerId(req), name: body.name.trim().slice(0, 80), pictures: [] }),
        );
        return { success: true, album: await this.albumDto(album) };
    }

    @Throttle({ default: { limit: 60, ttl: 60000 } })
    @UseGuards(AuthGuard('access-token'))
    @Patch('/albums/:albumId')
    @HttpCode(HttpStatus.OK)
    async renameAlbum(@Param('albumId', new ParseUUIDPipe()) albumId: string, @Body() body: AlbumNameDto, @Req() req: Request) {
        if (!body.name?.trim()) throw new HttpException({ code: 'MISSING_FIELDS' }, HttpStatus.BAD_REQUEST);
        const album = await this.albumRepository.findOne({ where: { id: albumId, ownerId: this.ownerId(req) } });
        if (!album) throw new HttpException({ code: 'ALBUM_NOT_FOUND' }, HttpStatus.NOT_FOUND);
        album.name = body.name.trim().slice(0, 80);
        await this.albumRepository.save(album);
        return { success: true };
    }

    @Throttle({ default: { limit: 30, ttl: 60000 } })
    @UseGuards(AuthGuard('access-token'))
    @Post('/albums/:albumId/pictures')
    @HttpCode(HttpStatus.OK)
    async addToAlbum(@Param('albumId', new ParseUUIDPipe()) albumId: string, @Body() body: AddPicturesDto, @Req() req: Request) {
        const owner = this.ownerId(req);
        const album = await this.albumRepository.findOne({ where: { id: albumId, ownerId: owner }, relations: { pictures: true } });
        if (!album) throw new HttpException({ code: 'ALBUM_NOT_FOUND' }, HttpStatus.NOT_FOUND);

        const toAdd = await this.pictureRepository.find({ where: { id: In(body.pictureIds), ownerId: owner } });
        const existing = new Set((album.pictures ?? []).map(p => p.id));
        album.pictures = [...(album.pictures ?? []), ...toAdd.filter(p => !existing.has(p.id))];
        await this.albumRepository.save(album);
        return { success: true, count: album.pictures.length };
    }

    @Throttle({ default: { limit: 60, ttl: 60000 } })
    @UseGuards(AuthGuard('access-token'))
    @Delete('/albums/:albumId/pictures/:pictureId')
    @HttpCode(HttpStatus.OK)
    async removeFromAlbum(
        @Param('albumId', new ParseUUIDPipe()) albumId: string,
        @Param('pictureId', new ParseUUIDPipe()) pictureId: string,
        @Req() req: Request,
    ) {
        const album = await this.albumRepository.findOne({ where: { id: albumId, ownerId: this.ownerId(req) }, relations: { pictures: true } });
        if (!album) throw new HttpException({ code: 'ALBUM_NOT_FOUND' }, HttpStatus.NOT_FOUND);
        album.pictures = (album.pictures ?? []).filter(p => p.id !== pictureId);
        await this.albumRepository.save(album);
        return { success: true };
    }

    @Throttle({ default: { limit: 30, ttl: 60000 } })
    @UseGuards(AuthGuard('access-token'))
    @Delete('/albums/:albumId')
    @HttpCode(HttpStatus.OK)
    async deleteAlbum(@Param('albumId', new ParseUUIDPipe()) albumId: string, @Req() req: Request) {
        const album = await this.albumRepository.findOne({ where: { id: albumId, ownerId: this.ownerId(req) }, relations: { pictures: true } });
        if (!album) throw new HttpException({ code: 'ALBUM_NOT_FOUND' }, HttpStatus.NOT_FOUND);
        await this.shareRepository.delete({ albumId: album.id });
        album.pictures = [];
        await this.albumRepository.save(album);
        await this.albumRepository.delete({ id: album.id });
        return { success: true };
    }

    @Throttle({ default: { limit: 120, ttl: 60000 } })
    @UseGuards(AuthGuard('access-token'))
    @Get('/shares')
    async listShares(@Req() req: Request) {
        const shares = await this.shareRepository.find({
            where: { ownerId: this.ownerId(req) },
            order: { createdAt: 'DESC' },
        });
        return { items: shares.map(s => this.shareDto(s)) };
    }

    @Throttle({ default: { limit: 30, ttl: 60000 } })
    @UseGuards(AuthGuard('access-token'))
    @Post('/shares')
    @HttpCode(HttpStatus.CREATED)
    async createShare(@Body() body: CreateShareDto, @Req() req: Request) {
        const owner = this.ownerId(req);
        const expiresAt = body.expiresInDays ? new Date(Date.now() + body.expiresInDays * 86400000) : null;
        const token = randomBytes(16).toString('base64url');
        if (body.albumId) {
            const album = await this.albumRepository.findOne({ where: { id: body.albumId, ownerId: owner }, relations: { pictures: true } });
            if (!album) throw new HttpException({ code: 'ALBUM_NOT_FOUND' }, HttpStatus.NOT_FOUND);
            const share = await this.shareRepository.save(
                this.shareRepository.create({
                    ownerId: owner, token, kind: ShareKind.ALBUM, albumId: album.id,
                    pictureIds: [], title: album.name.slice(0, 120), itemCount: (album.pictures ?? []).length, expiresAt,
                }),
            );
            return { success: true, share: this.shareDto(share) };
        }
        if (body.pictureIds && body.pictureIds.length > 0) {
            const owned = await this.pictureRepository.find({ where: { id: In(body.pictureIds), ownerId: owner } });
            if (owned.length === 0) throw new HttpException({ code: 'NOT_FOUND' }, HttpStatus.NOT_FOUND);
            const ids = owned.map(p => p.id);
            const share = await this.shareRepository.save(
                this.shareRepository.create({
                    ownerId: owner, token, kind: ShareKind.SELECTION, albumId: null,
                    pictureIds: ids, title: `${ids.length} photo${ids.length > 1 ? 's' : ''}`, itemCount: ids.length, expiresAt,
                }),
            );
            return { success: true, share: this.shareDto(share) };
        }
        throw new HttpException({ code: 'NOTHING_TO_SHARE' }, HttpStatus.BAD_REQUEST);
    }

    @Throttle({ default: { limit: 60, ttl: 60000 } })
    @UseGuards(AuthGuard('access-token'))
    @Delete('/shares/:shareId')
    @HttpCode(HttpStatus.OK)
    async revokeShare(@Param('shareId', new ParseUUIDPipe()) shareId: string, @Req() req: Request) {
        const share = await this.shareRepository.findOne({ where: { id: shareId, ownerId: this.ownerId(req) } });
        if (!share) throw new HttpException({ code: 'NOT_FOUND' }, HttpStatus.NOT_FOUND);
        await this.shareRepository.delete({ id: share.id });
        return { success: true };
    }

    @Throttle({ default: { limit: 120, ttl: 60000 } })
    @Get('/shared/:token')
    async getSharedAlbum(@Param('token') token: string) {
        const share = await this.shareRepository.findOne({ where: { token } });
        if (!share) throw new HttpException({ code: 'SHARE_NOT_FOUND' }, HttpStatus.NOT_FOUND);
        if (share.expiresAt && new Date(share.expiresAt).getTime() <= Date.now()) {
            throw new HttpException({ code: 'SHARE_EXPIRED' }, HttpStatus.GONE);
        }
        let pictures: Picture[];
        if (share.kind === ShareKind.ALBUM && share.albumId) {
            const album = await this.albumRepository.findOne({
                where: { id: share.albumId },
                relations: { pictures: true },
            });
            pictures = (album?.pictures ?? [])
                .filter(p => !p.deletedAt)
                .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
        } else {
            const ids = share.pictureIds ?? [];
            if (ids.length === 0) {
                pictures = [];
            } else {
                const pics = await this.pictureRepository.find({ where: { id: In(ids) } });
                const byId = new Map(pics.map(p => [p.id, p]));
                pictures = ids
                    .map(id => byId.get(id))
                    .filter((p): p is Picture => !!p && !p.deletedAt);
            }
        }
        this.shareRepository.increment({ id: share.id }, 'views', 1).catch(() => undefined);
        const items = await Promise.all(
            pictures.map(async p => ({
                id: p.id,
                filename: p.filename,
                mimeType: p.mimeType,
                kind: p.kind,
                width: p.width,
                height: p.height,
                durationSeconds: p.durationSeconds,
                takenAt: p.takenAt,
                url: await this.fileUrl(p),
                posterUrl: await this.posterUrlFor(p),
            })),
        );
        return {
            share: {
                token: share.token,
                kind: share.kind,
                title: share.title,
                count: pictures.length,
                expiresAt: share.expiresAt,
                createdAt: share.createdAt,
            },
            items,
        };
    }

    @Throttle({ default: { limit: 120, ttl: 60000 } })
    @UseGuards(AuthGuard('access-token'))
    @Get('/collections')
    async collections(@Req() req: Request) {
        const owner = this.ownerId(req);
        const base = () => this.pictureRepository.createQueryBuilder('p').where('p.ownerId = :owner', { owner });
        const [all, favorites, archive, trash, shared] = await Promise.all([
            base().andWhere('p.archived = false').andWhere('p.deletedAt IS NULL').getCount(),
            base().andWhere('p.favorite = true').andWhere('p.archived = false').andWhere('p.deletedAt IS NULL').getCount(),
            base().andWhere('p.archived = true').andWhere('p.deletedAt IS NULL').getCount(),
            base().andWhere('p.deletedAt IS NOT NULL').getCount(),
            this.shareRepository.count({ where: { ownerId: owner } }),
        ]);
        const cover = async (apply: (qb: ReturnType<typeof base>) => void): Promise<string | null> => {
            const qb = base().orderBy('p.createdAt', 'DESC').take(1);
            apply(qb);
            const p = await qb.getOne();
            return p ? await this.coverUrlFor(p) : null;
        };
        const [allCover, favCover, archiveCover, trashCover] = await Promise.all([
            cover(q => q.andWhere('p.archived = false').andWhere('p.deletedAt IS NULL')),
            cover(q => q.andWhere('p.favorite = true').andWhere('p.archived = false').andWhere('p.deletedAt IS NULL')),
            cover(q => q.andWhere('p.archived = true').andWhere('p.deletedAt IS NULL')),
            cover(q => q.andWhere('p.deletedAt IS NOT NULL')),
        ]);
        return {
            all: { count: all, coverUrl: allCover },
            favorites: { count: favorites, coverUrl: favCover },
            archive: { count: archive, coverUrl: archiveCover },
            trash: { count: trash, coverUrl: trashCover },
            shared: { count: shared },
        };
    }

    @Throttle({ default: { limit: 120, ttl: 60000 } })
    @UseGuards(AuthGuard('access-token'))
    @Get()
    async list(
        @Req() req: Request,
        @Query('limit') limitRaw?: string,
        @Query('cursor') cursor?: string,
        @Query('filter') filter?: string,
    ) {
        const owner = this.ownerId(req);
        const limit = Math.min(Math.max(parseInt(limitRaw ?? '', 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);
        const qb = this.pictureRepository
            .createQueryBuilder('p')
            .where('p.ownerId = :owner', { owner })
            .orderBy('p.createdAt', 'DESC')
            .addOrderBy('p.id', 'DESC')
            .take(limit + 1);
        if (filter === 'favorites') {
            qb.andWhere('p.favorite = true').andWhere('p.archived = false').andWhere('p.deletedAt IS NULL');
        } else if (filter === 'archive') {
            qb.andWhere('p.archived = true').andWhere('p.deletedAt IS NULL');
        } else if (filter === 'trash') {
            qb.andWhere('p.deletedAt IS NOT NULL');
        } else {
            qb.andWhere('p.archived = false').andWhere('p.deletedAt IS NULL');
        }
        const cur = this.decodeCursor(cursor);
        if (cur) {
            qb.andWhere('(p.createdAt < :ts OR (p.createdAt = :ts AND p.id < :id))', { ts: cur.ts, id: cur.id });
        }
        const rows = await qb.getMany();
        const hasMore = rows.length > limit;
        const pageRows = hasMore ? rows.slice(0, limit) : rows;
        const last = pageRows[pageRows.length - 1];
        const nextCursor = hasMore && last ? this.encodeCursor(last.createdAt, last.id) : null;
        return { items: await Promise.all(pageRows.map(p => this.pictureDto(p))), nextCursor };
    }

    @Throttle({ default: { limit: 60, ttl: 60000 } })
    @UseGuards(AuthGuard('access-token'))
    @Post()
    @HttpCode(HttpStatus.CREATED)
    @UseInterceptors(FilesInterceptor('files', MAX_FILES_PER_UPLOAD, { limits: { fileSize: MAX_FILE_BYTES } }))
    async upload(@UploadedFiles() files: UploadedFileLike[], @Req() req: Request) {
        const owner = this.ownerId(req);
        if (!files || files.length === 0) throw new HttpException({ code: 'NO_FILES' }, HttpStatus.BAD_REQUEST);
        for (const f of files) {
            if (!this.kindFromMime(f.mimetype)) {
                throw new HttpException({ code: 'UNSUPPORTED_TYPE' }, HttpStatus.UNSUPPORTED_MEDIA_TYPE);
            }
        }
        const created: Picture[] = [];
        for (const f of files) {
            const kind = this.kindFromMime(f.mimetype)!;
            const ext = extname(f.originalname || '').slice(0, 12);
            const key = `pictures/${owner}/${randomUUID()}${ext}`;
            await this.storage.upload(key, f.buffer, f.mimetype);
            const base = {
                ownerId: owner,
                filename: (f.originalname || 'upload').slice(0, 255),
                mimeType: f.mimetype.slice(0, 127),
                kind,
                sizeBytes: String(f.size),
                storageKey: key,
            };
            let extra: Partial<Picture> = { sha256: this.sha256(f.buffer) };
            if (kind === PictureKind.IMAGE) {
                const a = await this.analyzeImage(f.buffer).catch(() => null);
                if (a) {
                    extra = {
                        sha256: a.sha256,
                        phash: a.phash,
                        width: a.width,
                        height: a.height,
                        takenAt: a.takenAt,
                    };
                }
            } else if (kind === PictureKind.VIDEO) {
                const thumb = await this.extractVideoThumbnail(f.buffer).catch(() => null);
                if (thumb) {
                    const thumbKey = `thumbnails/${owner}/${randomUUID()}.jpg`;
                    const uploaded = await this.storage.upload(thumbKey, thumb, 'image/jpeg').then(() => true).catch(() => false);
                    if (uploaded) {
                        const dims = await sharp(thumb).metadata().catch(() => null);
                        extra = {
                            ...extra,
                            thumbnailKey: thumbKey,
                            width: dims?.width ?? null,
                            height: dims?.height ?? null,
                        };
                    }
                }
            }

            const pic = await this.pictureRepository.save(
                this.pictureRepository.create({ ...base, ...extra }),
            );
            created.push(pic);
        }
        return { success: true, items: await Promise.all(created.map(p => this.pictureDto(p))) };
    }

    @Throttle({ default: { limit: 120, ttl: 60000 } })
    @UseGuards(AuthGuard('access-token'))
    @Post('/:id/restore')
    @HttpCode(HttpStatus.OK)
    async restore(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
        const picture = await this.pictureRepository.findOne({ where: { id, ownerId: this.ownerId(req) } });
        if (!picture) throw new HttpException({ code: 'NOT_FOUND' }, HttpStatus.NOT_FOUND);
        if (picture.deletedAt) {
            picture.deletedAt = null;
            await this.pictureRepository.save(picture);
        }
        return { success: true };
    }

    @Throttle({ default: { limit: 120, ttl: 60000 } })
    @UseGuards(AuthGuard('access-token'))
    @Patch('/:id')
    @HttpCode(HttpStatus.OK)
    async update(@Param('id', new ParseUUIDPipe()) id: string, @Body() body: UpdatePictureDto, @Req() req: Request) {
        const picture = await this.pictureRepository.findOne({ where: { id, ownerId: this.ownerId(req) } });
        if (!picture) throw new HttpException({ code: 'NOT_FOUND' }, HttpStatus.NOT_FOUND);
        if (picture.deletedAt) throw new HttpException({ code: 'IN_TRASH' }, HttpStatus.CONFLICT);
        if (body.favorite !== undefined) picture.favorite = body.favorite;
        if (body.archived !== undefined) picture.archived = body.archived;
        await this.pictureRepository.save(picture);
        return { success: true, picture: await this.pictureDto(picture) };
    }

    @Throttle({ default: { limit: 120, ttl: 60000 } })
    @UseGuards(AuthGuard('access-token'))
    @Delete('/:id/permanent')
    @HttpCode(HttpStatus.OK)
    async destroy(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
        const owner = this.ownerId(req);
        const picture = await this.pictureRepository.findOne({ where: { id, ownerId: owner } });
        if (!picture) throw new HttpException({ code: 'NOT_FOUND' }, HttpStatus.NOT_FOUND);
        await this.cleanupSharesForPicture(owner, picture.id);
        await this.storage.remove(picture.storageKey).catch(() => undefined);
        if (picture.thumbnailKey) await this.storage.remove(picture.thumbnailKey).catch(() => undefined);
        await this.pictureRepository.delete({ id: picture.id });
        return { success: true };
    }

    @Throttle({ default: { limit: 120, ttl: 60000 } })
    @UseGuards(AuthGuard('access-token'))
    @Delete('/:id')
    @HttpCode(HttpStatus.OK)
    async remove(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
        const picture = await this.pictureRepository.findOne({ where: { id, ownerId: this.ownerId(req) } });
        if (!picture) throw new HttpException({ code: 'NOT_FOUND' }, HttpStatus.NOT_FOUND);
        if (!picture.deletedAt) {
            picture.deletedAt = new Date();
            await this.pictureRepository.save(picture);
        }
        return { success: true };
    }

    @Throttle({ default: { limit: 12, ttl: 60000 } })
    @UseGuards(AuthGuard('access-token'))
    @Get('/duplicates')
    async duplicates(@Req() req: Request, @Query('distance') distanceRaw?: string) {
        const owner = this.ownerId(req);
        const distance = this.clampInt(distanceRaw, 8, 0, 24);
        const pics = await this.pictureRepository.find({ where: { ownerId: owner, deletedAt: IsNull() } });
        const includeSimilar = pics.length <= MAX_SIMILAR_SCAN;
        const clusters = this.groupDuplicates(
            pics.map(p => ({ id: p.id, sha256: p.sha256, phash: p.phash })),
            includeSimilar,
            distance,
        );
        const byId = new Map(pics.map(p => [p.id, p]));
        const area = (p: Picture) => (p.width ?? 0) * (p.height ?? 0);
        const groups = await Promise.all(
            clusters.map(async ids => {
                const members = ids.map(id => byId.get(id)).filter((p): p is Picture => !!p);
                const sha = members[0].sha256;
                const exact = !!sha && members.every(m => m.sha256 === sha);
                const ordered = [...members].sort(
                    (a, b) =>
                        area(b) - area(a) ||
                        Number(b.sizeBytes) - Number(a.sizeBytes) ||
                        +new Date(a.createdAt) - +new Date(b.createdAt),
                );
                return {
                    kind: exact ? 'exact' : 'similar',
                    count: members.length,
                    keep: await this.pictureDto(ordered[0]),
                    duplicates: await Promise.all(ordered.slice(1).map(p => this.pictureDto(p))),
                };
            }),
        );
        groups.sort((a, b) => (a.kind === b.kind ? b.count - a.count : a.kind === 'exact' ? -1 : 1));
        return { scanned: pics.length, similarScan: includeSimilar, groups };
    }

    @Throttle({ default: { limit: 12, ttl: 60000 } })
    @UseGuards(AuthGuard('access-token'))
    @Get('/suggestions/albums')
    async suggestAlbums(
        @Req() req: Request,
        @Query('gapHours') gapHoursRaw?: string,
        @Query('min') minRaw?: string,
    ) {
        const owner = this.ownerId(req);
        const gapMs = this.clampInt(gapHoursRaw, 24, 1, 24 * 14) * 3600000;
        const minCount = this.clampInt(minRaw, 4, 2, 100);
        const pics = await this.pictureRepository.find({
            where: { ownerId: owner, archived: false, deletedAt: IsNull() },
        });
        const albums = await this.albumRepository.find({ where: { ownerId: owner }, relations: { pictures: true } });
        const inAlbum = new Set<string>();
        for (const a of albums) for (const p of a.pictures ?? []) inAlbum.add(p.id);
        const candidates = pics.filter(p => !inAlbum.has(p.id));
        const items = candidates.map(p => ({ id: p.id, date: +new Date(p.takenAt ?? p.createdAt) }));
        const events = this.suggestEvents(items, gapMs, minCount);
        const byId = new Map(candidates.map(p => [p.id, p]));
        const suggestions = await Promise.all(
            events
                .sort((a, b) => b.end - a.end)
                .slice(0, 30)
                .map(async ev => {
                    const cover = byId.get(ev.ids[0])!;
                    return {
                        id: `sug_${ev.ids[0]}`,
                        name: this.eventName(new Date(ev.start), new Date(ev.end)),
                        count: ev.ids.length,
                        coverUrl: await this.coverUrlFor(cover),
                        pictureIds: ev.ids,
                        start: new Date(ev.start),
                        end: new Date(ev.end),
                    };
                }),
        );
        return { suggestions };
    }

    @Throttle({ default: { limit: 30, ttl: 60000 } })
    @UseGuards(AuthGuard('access-token'))
    @Post('/suggestions/albums')
    @HttpCode(HttpStatus.CREATED)
    async createSuggestedAlbum(@Body() body: CreateAlbumFromSuggestionDto, @Req() req: Request) {
        const owner = this.ownerId(req);
        const name = (body.name ?? '').trim().slice(0, 80);
        if (!name) throw new HttpException({ code: 'MISSING_FIELDS' }, HttpStatus.BAD_REQUEST);
        const owned = await this.pictureRepository.find({
            where: { id: In(body.pictureIds), ownerId: owner, deletedAt: IsNull() },
        });
        if (owned.length === 0) throw new HttpException({ code: 'NOTHING_TO_ADD' }, HttpStatus.BAD_REQUEST);
        const album = await this.albumRepository.save(
            this.albumRepository.create({ ownerId: owner, name, pictures: owned }),
        );
        return { success: true, album: await this.albumDto(album) };
    }

    @Throttle({ default: { limit: 20, ttl: 60000 } })
    @UseGuards(AuthGuard('access-token'))
    @Post('/reindex')
    @HttpCode(HttpStatus.OK)
    async reindex(@Req() req: Request) {
        const owner = this.ownerId(req);
        const batch = await this.pictureRepository.find({
            where: [
                { ownerId: owner, deletedAt: IsNull(), sha256: IsNull() },
                { ownerId: owner, deletedAt: IsNull(), kind: PictureKind.VIDEO, thumbnailKey: IsNull() },
            ],
            order: { createdAt: 'DESC' },
            take: REINDEX_BATCH,
        });
        let processed = 0;
        for (const p of batch) {
            try {
                const buf = await this.streamToBuffer(await this.storage.download(p.storageKey));
                if (!p.sha256) p.sha256 = this.sha256(buf);
                if (p.kind === PictureKind.IMAGE) {
                    const a = await this.analyzeImage(buf).catch(() => null);
                    if (a) {
                        if (a.phash) p.phash = a.phash;
                        if (a.width) p.width = a.width;
                        if (a.height) p.height = a.height;
                        if (a.takenAt && !p.takenAt) p.takenAt = a.takenAt;
                    }
                } else if (p.kind === PictureKind.VIDEO && !p.thumbnailKey) {
                    const thumb = await this.extractVideoThumbnail(buf).catch(() => null);
                    if (thumb) {
                        const thumbKey = `thumbnails/${owner}/${randomUUID()}.jpg`;
                        const uploaded = await this.storage.upload(thumbKey, thumb, 'image/jpeg').then(() => true).catch(() => false);
                        if (uploaded) {
                            p.thumbnailKey = thumbKey;
                            const dims = await sharp(thumb).metadata().catch(() => null);
                            if (dims?.width) p.width = dims.width;
                            if (dims?.height) p.height = dims.height;
                        }
                    }
                }
                await this.pictureRepository.save(p);
                processed++;
            } catch {
                // Storage object unreadable this round; leave it for a later pass.
            }
        }
        const remaining = await this.pictureRepository.count({
            where: [
                { ownerId: owner, deletedAt: IsNull(), sha256: IsNull() },
                { ownerId: owner, deletedAt: IsNull(), kind: PictureKind.VIDEO, thumbnailKey: IsNull() },
            ],
        });
        return { processed, remaining };
    }

    private sha256(buffer: Buffer): string {
        return createHash('sha256').update(buffer).digest('hex');
    }

    private async analyzeImage(buffer: Buffer): Promise<ImageAnalysis> {
        const sha256 = this.sha256(buffer);
        let width: number | null = null;
        let height: number | null = null;
        let takenAt: Date | null = null;
        let phash: string | null = null;
        try {
            const meta = await sharp(buffer).metadata();
            width = meta.width ?? null;
            height = meta.height ?? null;
            if (meta.orientation && meta.orientation >= 5 && width && height) {
                [width, height] = [height, width];
            }
            if (meta.exif) {
                try {
                    const ex = exifReader(meta.exif) as Record<string, any>;
                    const raw =
                        ex?.Photo?.DateTimeOriginal ??
                        ex?.Image?.DateTime ??
                        ex?.Photo?.DateTimeDigitized;
                    if (raw instanceof Date && !Number.isNaN(raw.getTime())) takenAt = raw;
                    else if (typeof raw === 'string') takenAt = this.parseExifDate(raw);
                } catch {
                    /* unreadable EXIF, ignore */
                }
            }
            phash = await this.dHash(buffer);
        } catch {
            /* sharp could not decode; keep sha256 only */
        }
        return { sha256, phash, width, height, takenAt };
    }

    private async dHash(buffer: Buffer): Promise<string | null> {
        try {
            const raw = await sharp(buffer)
                .rotate()
                .greyscale()
                .resize(9, 8, { fit: 'fill' })
                .raw()
                .toBuffer();
            if (raw.length < 72) return null;
            let hash = 0n;
            let bit = 0n;
            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    if (raw[r * 9 + c] > raw[r * 9 + c + 1]) hash |= 1n << bit;
                    bit++;
                }
            }
            return hash.toString(16).padStart(16, '0');
        } catch {
            return null;
        }
    }

    private parseExifDate(s: string): Date | null {
        const m = s.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
        if (!m) {
            const d = new Date(s);
            return Number.isNaN(d.getTime()) ? null : d;
        }
        const [, y, mo, d, h, mi, se] = m;
        const dt = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(se));
        return Number.isNaN(dt.getTime()) ? null : dt;
    }

    private clampInt(raw: string | undefined, def: number, lo: number, hi: number): number {
        const n = parseInt(raw ?? '', 10);
        return Math.min(Math.max(Number.isNaN(n) ? def : n, lo), hi);
    }

    private async streamToBuffer(stream: Readable): Promise<Buffer> {
        const chunks: Buffer[] = [];
        for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        return Buffer.concat(chunks);
    }

    private async extractVideoThumbnail(buffer: Buffer): Promise<Buffer | null> {
        if (!ffmpegPath) return null;
        const dir = await mkdtemp(join(tmpdir(), 'dp-thumb-'));
        const input = join(dir, 'input');
        const output = join(dir, 'thumb.jpg');
        try {
            await writeFile(input, buffer);
            const ok = (await this.runFfmpegFrame(input, output, '1')) || (await this.runFfmpegFrame(input, output, '0'));
            return ok ? await readFile(output) : null;
        } catch {
            return null;
        } finally {
            await rm(dir, { recursive: true, force: true }).catch(() => undefined);
        }
    }

    private runFfmpegFrame(input: string, output: string, seekSeconds: string): Promise<boolean> {
        return new Promise(resolve => {
            const proc = spawn(ffmpegPath as string, [
                '-y',
                '-ss', seekSeconds,
                '-i', input,
                '-frames:v', '1',
                '-vf', 'scale=640:-1',
                output,
            ]);
            proc.on('error', () => resolve(false));
            proc.on('close', code => resolve(code === 0));
        });
    }

    private eventName(start: Date, end: Date): string {
        const full = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        if (start.toDateString() === end.toDateString()) return full(end);
        if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
            return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}-${end.getDate()}, ${end.getFullYear()}`;
        }
        return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${full(end)}`;
    }

    private groupDuplicates(
        items: { id: string; sha256: string | null; phash: string | null }[],
        includeSimilar: boolean,
        maxDistance: number,
    ): string[][] {
        const parent = new Map<string, string>();
        for (const it of items) parent.set(it.id, it.id);

        const find = (x: string): string => {
            let root = x;
            while (parent.get(root) !== root) root = parent.get(root)!;
            while (parent.get(x) !== root) {
                const next = parent.get(x)!;
                parent.set(x, root);
                x = next;
            }
            return root;
        };
        const union = (a: string, b: string) => {
            const ra = find(a);
            const rb = find(b);
            if (ra !== rb) parent.set(ra, rb);
        };
        const bySha = new Map<string, string>();
        for (const it of items) {
            if (!it.sha256) continue;
            const seen = bySha.get(it.sha256);
            if (seen) union(seen, it.id);
            else bySha.set(it.sha256, it.id);
        }
        if (includeSimilar) {
            const withP = items.filter(
                (i): i is { id: string; sha256: string | null; phash: string } => !!i.phash,
            );
            const parsed = withP.map(i => ({
                id: i.id,
                hi: parseInt(i.phash.slice(0, 8), 16) >>> 0,
                lo: parseInt(i.phash.slice(8), 16) >>> 0,
            }));
            for (let i = 0; i < parsed.length; i++) {
                for (let j = i + 1; j < parsed.length; j++) {
                    const d =
                        this.popcount((parsed[i].hi ^ parsed[j].hi) >>> 0) +
                        this.popcount((parsed[i].lo ^ parsed[j].lo) >>> 0);
                    if (d <= maxDistance) union(parsed[i].id, parsed[j].id);
                }
            }
        }
        const groups = new Map<string, string[]>();
        for (const it of items) {
            const root = find(it.id);
            const arr = groups.get(root);
            if (arr) arr.push(it.id);
            else groups.set(root, [it.id]);
        }
        return [...groups.values()].filter(g => g.length > 1);
    }

    private popcount(v: number): number {
        v = v - ((v >>> 1) & 0x55555555);
        v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
        return (((v + (v >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
    }

    private suggestEvents(
        items: { id: string; date: number }[],
        gapMs: number,
        minCount: number,
    ): { ids: string[]; start: number; end: number }[] {
        const sorted = [...items].sort((a, b) => a.date - b.date);
        const clusters: { id: string; date: number }[][] = [];
        let cur: { id: string; date: number }[] = [];
        for (let i = 0; i < sorted.length; i++) {
            if (cur.length === 0) {
                cur = [sorted[i]];
                continue;
            }
            if (sorted[i].date - sorted[i - 1].date > gapMs) {
                clusters.push(cur);
                cur = [sorted[i]];
            } else {
                cur.push(sorted[i]);
            }
        }
        if (cur.length) clusters.push(cur);
        return clusters
            .filter(c => c.length >= minCount)
            .map(c => ({ ids: c.map(x => x.id), start: c[0].date, end: c[c.length - 1].date }));
    }
}