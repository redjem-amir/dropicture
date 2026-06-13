// dropicture/app/backend/src/controllers/pictures.controller.ts
import { Body, Controller, Delete, Get, HttpCode, HttpException, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, Req, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Throttle } from '@nestjs/throttler';
import { ArrayNotEmpty, IsArray, IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { randomBytes, randomUUID } from 'crypto';
import { extname } from 'path';
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

interface UploadedFileLike {
    originalname: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
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
            coverUrl: cover ? await this.fileUrl(cover) : null,
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
            return p ? await this.fileUrl(p) : null;
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
            const pic = await this.pictureRepository.save(
                this.pictureRepository.create({
                    ownerId: owner,
                    filename: (f.originalname || 'upload').slice(0, 255),
                    mimeType: f.mimetype.slice(0, 127),
                    kind,
                    sizeBytes: String(f.size),
                    storageKey: key,
                }),
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
}