// dropicture/apps/saas/backend/src/services/cdn.service.ts
import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { Queue } from 'bullmq';
import { SSMClient, GetParametersByPathCommand } from '@aws-sdk/client-ssm';
import { S3Client, CopyObjectCommand, DeleteObjectsCommand, HeadObjectCommand, ListObjectsV2Command, CreateMultipartUploadCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand, UploadPartCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import { getSignedCookies, getSignedUrl as getCloudFrontSignedUrl } from '@aws-sdk/cloudfront-signer';
import { Media, type MediaPurpose } from '../models/media.entity';
import { REDIS_QUEUE_OPTIONS } from './redis.service';

export const PREFIX = { ORIGINAL: 'originals', PRIVATE: 'private', PUBLIC: 'public' } as const;

export const MIME = {
    'image/jpeg': { ext: 'jpg', kind: 'image' },
    'image/png': { ext: 'png', kind: 'image' },
    'image/webp': { ext: 'webp', kind: 'image' },
    'image/avif': { ext: 'avif', kind: 'image' },
    'image/heic': { ext: 'heic', kind: 'image' },
    'video/mp4': { ext: 'mp4', kind: 'video' },
    'video/quicktime': { ext: 'mov', kind: 'video' },
    'video/webm': { ext: 'webm', kind: 'video' },
} as const;

export type Mime = keyof typeof MIME;

const LIMITS = {
    IMAGE_MAX_BYTES: 8 * 1024 * 1024,
    VIDEO_MAX_BYTES: 100 * 1024 * 1024,
    AVATAR_MAX_BYTES: 8 * 1024 * 1024,
    VIDEO_MIN_DURATION_MS: 3_000,
    VIDEO_MAX_DURATION_MS: 15 * 60 * 1000,
    DECODE_MAX_PIXELS: 100_000_000,
    MULTIPART_THRESHOLD: 32 * 1024 * 1024,
    MULTIPART_PART_SIZE: 8 * 1024 * 1024,
    UPLOAD_TTL_SECONDS: 900,
    READ_TTL_SECONDS: 3600,
} as const;

export const OUTPUT = {
    IMAGE_MAX_WIDTH: 1440,
    AVATAR_MAX_WIDTH: 480,
    VIDEO_MAX_HEIGHT: 1080,
    VIDEO_MAX_FPS: 30,
} as const;

export const MEDIA_LIMITS = LIMITS;
export const MEDIA_QUEUE = 'media';
export const ORIGINAL_KEY_RE = /^originals\/[\w-]+\/[\w-]+\.[a-z0-9]+$/;

type CdnRuntimeConfig = {
    bucket: string;
    bucketRegion: string;
    domain: string;
    distributionId: string;
    keyPairId: string;
    privateKey: string;
};

export type UploadTicket =
    | { strategy: 'post'; mediaId: string; key: string; url: string; fields: Record<string, string>; expiresAt: string }
    | { strategy: 'multipart'; mediaId: string; key: string; uploadId: string; partSize: number; partUrls: { partNumber: number; url: string }[]; expiresAt: string };

export type SignedCookie = { name: string; value: string; maxAge: number };

@Injectable()
export class CdnService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(CdnService.name);
    private readonly region = process.env.AWS_REGION ?? 'eu-west-3';
    private readonly ssmPrefix = process.env.CDN_SSM_PREFIX ?? '/dropicture/cloudfront';

    private readonly s3: S3Client;
    private readonly cloudfront: CloudFrontClient;
    private readonly queue: Queue;
    private config!: CdnRuntimeConfig;

    constructor(
        @InjectRepository(Media)
        private readonly mediaRepository: Repository<Media>,
    ) {
        this.s3 = new S3Client({ region: this.region });
        this.cloudfront = new CloudFrontClient({ region: 'us-east-1' });
        this.queue = new Queue(MEDIA_QUEUE, {
            connection: REDIS_QUEUE_OPTIONS,
            defaultJobOptions: {
                attempts: 3,
                backoff: { type: 'exponential', delay: 5000 },
                removeOnComplete: 500,
                removeOnFail: 1000,
            },
        });
    }

    async onModuleInit(): Promise<void> {
        const ssm = new SSMClient({ region: this.region });
        const params: Record<string, string> = {};
        let token: string | undefined;
        try {
            do {
                const page = await ssm.send(
                    new GetParametersByPathCommand({
                        Path: this.ssmPrefix,
                        Recursive: true,
                        WithDecryption: true,
                        NextToken: token,
                    }),
                );
                for (const p of page.Parameters ?? []) {
                    if (p.Name && p.Value) params[p.Name.slice(this.ssmPrefix.length + 1)] = p.Value;
                }
                token = page.NextToken;
            } while (token);
        } finally {
            ssm.destroy();
        }
        const version = params['active_key_version'];
        if (!version) throw new Error(`SSM ${this.ssmPrefix}/active_key_version est absent.`);
        const resolved = {
            bucket: params['bucket'],
            bucketRegion: params['bucket_region'] ?? this.region,
            domain: params['domain'],
            distributionId: params['distribution_id'],
            keyPairId: params[`key_pair_id_${version}`],
            privateKey: params[`private_key_${version}`],
        };
        const missing = Object.entries(resolved).filter(([, v]) => !v).map(([k]) => k);
        if (missing.length) {
            throw new Error(
                `Configuration CDN incomplète dans SSM (${missing.join(', ')}). ` +
                `Vérifie que l'utilisateur IAM porte kms:Decrypt sur la CMK du CDN — ` +
                `sans ça les SecureString remontent vides, sans erreur explicite.`,
            );
        }
        this.config = resolved as CdnRuntimeConfig;
        this.logger.log(`CDN prêt · ${this.config.domain} · clé ${version}`);
    }

    async onModuleDestroy(): Promise<void> {
        await this.queue.close().catch(() => undefined);
    }

    limits() {
        return {
            image: { maxBytes: LIMITS.IMAGE_MAX_BYTES },
            video: {
                maxBytes: LIMITS.VIDEO_MAX_BYTES,
                minDurationMs: LIMITS.VIDEO_MIN_DURATION_MS,
                maxDurationMs: LIMITS.VIDEO_MAX_DURATION_MS,
            },
            avatar: { maxBytes: LIMITS.AVATAR_MAX_BYTES },
            accepted: Object.keys(MIME),
        };
    }

    maxBytesFor(kind: 'image' | 'video', purpose: MediaPurpose): number {
        if (purpose === 'avatar') return LIMITS.AVATAR_MAX_BYTES;
        return kind === 'video' ? LIMITS.VIDEO_MAX_BYTES : LIMITS.IMAGE_MAX_BYTES;
    }

    async createUpload(params: {
        ownerId: string;
        contentType: string;
        contentLength: number;
        purpose?: MediaPurpose;
        durationMs?: number;
    }): Promise<UploadTicket> {
        if (!this.config) throw new Error('CdnService non initialisé.');
        const { ownerId, contentType, contentLength } = params;
        const purpose: MediaPurpose = params.purpose ?? 'content';
        if (!(contentType in MIME)) {
            throw new BadRequestException({
                code: 'UNSUPPORTED_MEDIA_TYPE',
                message: `Type non accepté. Formats : ${Object.keys(MIME).join(', ')}.`,
            });
        }
        const { ext, kind } = MIME[contentType as Mime];
        if (purpose === 'avatar' && !['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) {
            throw new BadRequestException({
                code: 'UNSUPPORTED_MEDIA_TYPE',
                message: 'Photo de profil : JPEG, PNG ou WEBP.',
            });
        }
        const max = this.maxBytesFor(kind, purpose);
        if (contentLength <= 0 || contentLength > max) {
            throw new BadRequestException({
                code: 'FILE_TOO_LARGE',
                message: `Poids maximal : ${Math.round(max / 1024 / 1024)} Mo.`,
            });
        }
        if (kind === 'video' && typeof params.durationMs === 'number') {
            if (params.durationMs > LIMITS.VIDEO_MAX_DURATION_MS) {
                throw new BadRequestException({
                    code: 'VIDEO_TOO_LONG',
                    message: `Durée maximale : ${LIMITS.VIDEO_MAX_DURATION_MS / 60000} minutes.`,
                });
            }
            if (params.durationMs < LIMITS.VIDEO_MIN_DURATION_MS) {
                throw new BadRequestException({
                    code: 'VIDEO_TOO_SHORT',
                    message: `Durée minimale : ${LIMITS.VIDEO_MIN_DURATION_MS / 1000} secondes.`,
                });
            }
        }
        const { bucket } = this.config;
        const mediaId = randomUUID();
        const key = `${PREFIX.ORIGINAL}/${ownerId}/${mediaId}.${ext}`;
        const expiresAt = new Date(Date.now() + LIMITS.UPLOAD_TTL_SECONDS * 1000).toISOString();
        await this.mediaRepository.save(
            this.mediaRepository.create({
                id: mediaId,
                ownerId,
                kind,
                purpose,
                status: 'pending',
                visibility: purpose === 'avatar' ? 'public' : 'private',
                mimeType: contentType,
                ext,
                bytes: String(contentLength),
                durationMs: params.durationMs ?? null,
            }),
        );
        if (contentLength >= LIMITS.MULTIPART_THRESHOLD) {
            const created = await this.s3.send(
                new CreateMultipartUploadCommand({
                    Bucket: bucket,
                    Key: key,
                    ContentType: contentType,
                    Metadata: { owner: ownerId, 'media-id': mediaId },
                }),
            );
            if (!created.UploadId) throw new BadRequestException({ code: 'UPLOAD_INIT_FAILED' });
            const partCount = Math.ceil(contentLength / LIMITS.MULTIPART_PART_SIZE);
            const partUrls = await Promise.all(
                Array.from({ length: partCount }, (_, i) => i + 1).map(async (partNumber) => ({
                    partNumber,
                    url: await getSignedUrl(
                        this.s3,
                        new UploadPartCommand({
                            Bucket: bucket,
                            Key: key,
                            UploadId: created.UploadId,
                            PartNumber: partNumber,
                        }),
                        { expiresIn: LIMITS.UPLOAD_TTL_SECONDS },
                    ),
                })),
            );
            return {
                strategy: 'multipart',
                mediaId,
                key,
                uploadId: created.UploadId,
                partSize: LIMITS.MULTIPART_PART_SIZE,
                partUrls,
                expiresAt,
            };
        }
        const { url, fields } = await createPresignedPost(this.s3, {
            Bucket: bucket,
            Key: key,
            Expires: LIMITS.UPLOAD_TTL_SECONDS,
            Conditions: [
                ['content-length-range', 1, Math.min(contentLength, max)],
                ['eq', '$Content-Type', contentType],
            ],
            Fields: {
                'Content-Type': contentType,
                'x-amz-meta-owner': ownerId,
                'x-amz-meta-media-id': mediaId,
            },
        });
        return { strategy: 'post', mediaId, key, url, fields, expiresAt };
    }

    async completeUpload(ownerId: string, mediaId: string): Promise<Media> {
        if (!this.config) throw new Error('CdnService non initialisé.');
        const media = await this.mediaRepository.findOne({
            where: { id: mediaId, ownerId, deletedAt: IsNull() },
        });
        if (!media) throw new NotFoundException({ code: 'MEDIA_NOT_FOUND' });
        const key = `${PREFIX.ORIGINAL}/${ownerId}/${mediaId}.${media.ext}`;
        const head = await this.s3
            .send(new HeadObjectCommand({ Bucket: this.config.bucket, Key: key }))
            .catch(() => null);
        if (!head) throw new BadRequestException({ code: 'UPLOAD_NOT_FOUND' });
        const size = head.ContentLength ?? 0;
        const max = this.maxBytesFor(media.kind, media.purpose);
        if (size > max) {
            await this.destroyMedia(ownerId, mediaId);
            throw new BadRequestException({
                code: 'FILE_TOO_LARGE',
                message: `Poids maximal : ${Math.round(max / 1024 / 1024)} Mo.`,
            });
        }
        media.bytes = String(size);
        media.status = 'queued';
        media.errorCode = null;
        media.error = null;
        await this.mediaRepository.save(media);
        await this.queue.add('process', { mediaId, ownerId }, { jobId: mediaId });
        return media;
    }

    async completeMultipart(params: {
        key: string;
        uploadId: string;
        parts: { partNumber: number; etag: string }[];
    }): Promise<{ key: string; size: number }> {
        if (!this.config) throw new Error('CdnService non initialisé.');
        const { bucket } = this.config;
        await this.s3.send(
            new CompleteMultipartUploadCommand({
                Bucket: bucket,
                Key: params.key,
                UploadId: params.uploadId,
                MultipartUpload: {
                    Parts: params.parts
                        .slice()
                        .sort((a, b) => a.partNumber - b.partNumber)
                        .map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })),
                },
            }),
        );
        const head = await this.s3.send(new HeadObjectCommand({ Bucket: bucket, Key: params.key }));
        return { key: params.key, size: head.ContentLength ?? 0 };
    }

    async abortMultipart(key: string, uploadId: string): Promise<void> {
        if (!this.config) throw new Error('CdnService non initialisé.');
        await this.s3.send(
            new AbortMultipartUploadCommand({ Bucket: this.config.bucket, Key: key, UploadId: uploadId }),
        );
    }

    issueReadCookies(ownerId: string): SignedCookie[] {
        if (!this.config) throw new Error('CdnService non initialisé.');
        const { domain, keyPairId, privateKey } = this.config;
        const scope = `${domain}/${PREFIX.PRIVATE}/${ownerId}/*`;
        const expiresAt = Math.floor(Date.now() / 1000) + LIMITS.READ_TTL_SECONDS;
        const cookies = getSignedCookies({
            url: scope,
            keyPairId,
            privateKey,
            policy: JSON.stringify({
                Statement: [
                    { Resource: scope, Condition: { DateLessThan: { 'AWS:EpochTime': expiresAt } } },
                ],
            }),
        });
        return Object.entries(cookies).map(([name, value]) => ({
            name,
            value: String(value),
            maxAge: LIMITS.READ_TTL_SECONDS * 1000,
        }));
    }

    signOne(key: string, ttlSeconds = 300): string {
        if (!this.config) throw new Error('CdnService non initialisé.');
        const { domain, keyPairId, privateKey } = this.config;
        return getCloudFrontSignedUrl({
            url: `${domain}/${key}`,
            keyPairId,
            privateKey,
            dateLessThan: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
        });
    }

    originalUrl(media: Media, ttlSeconds = 300): string {
        return this.signOne(
            `${PREFIX.ORIGINAL}/${media.ownerId}/${media.id}.${media.ext}`,
            ttlSeconds,
        );
    }

    urlsFor(media: Media): {
        base: string;
        srcSet: { avif: string; webp: string } | null;
        poster: string | null;
        hls: string | null;
        thumbhash: string | null;
    } {
        if (!this.config) throw new Error('CdnService non initialisé.');
        const root = media.visibility === 'public' ? PREFIX.PUBLIC : PREFIX.PRIVATE;
        const base = `${this.config.domain}/${root}/${media.ownerId}/${media.id}`;
        if (media.status !== 'ready') {
            return {
                base,
                srcSet: null,
                poster: null,
                hls: null,
                thumbhash: media.thumbhash ? media.thumbhash.toString('base64') : null,
            };
        }
        const widths = media.widths ?? [];
        const line = (fmt: 'avif' | 'webp') =>
            widths.map((w) => `${base}/${w}.${fmt} ${w}w`).join(', ');
        return {
            base,
            srcSet: widths.length ? { avif: line('avif'), webp: line('webp') } : null,
            poster: media.kind === 'video' ? `${base}/poster.jpg` : null,
            hls: media.kind === 'video' ? `${base}/index.m3u8` : null,
            thumbhash: media.thumbhash ? media.thumbhash.toString('base64') : null,
        };
    }

    async publishMedia(ownerId: string, mediaId: string): Promise<Media> {
        if (!this.config) throw new Error('CdnService non initialisé.');
        const { bucket } = this.config;
        const media = await this.mediaRepository.findOne({
            where: { id: mediaId, ownerId, deletedAt: IsNull() },
        });
        if (!media) throw new NotFoundException({ code: 'MEDIA_NOT_FOUND' });
        if (media.status !== 'ready') throw new BadRequestException({ code: 'MEDIA_NOT_READY' });
        if (media.visibility === 'public') return media;
        const from = `${PREFIX.PRIVATE}/${ownerId}/${mediaId}/`;
        const to = `${PREFIX.PUBLIC}/${ownerId}/${mediaId}/`;
        let token: string | undefined;
        do {
            const page = await this.s3.send(
                new ListObjectsV2Command({ Bucket: bucket, Prefix: from, ContinuationToken: token }),
            );
            for (const o of page.Contents ?? []) {
                if (!o.Key) continue;
                await this.s3.send(
                    new CopyObjectCommand({
                        Bucket: bucket,
                        CopySource: `${bucket}/${o.Key}`,
                        Key: to + o.Key.slice(from.length),
                        MetadataDirective: 'COPY',
                    }),
                );
            }
            token = page.NextContinuationToken;
        } while (token);
        media.visibility = 'public';
        return this.mediaRepository.save(media);
    }

    async unpublishMedia(ownerId: string, mediaId: string): Promise<Media> {
        if (!this.config) throw new Error('CdnService non initialisé.');
        const media = await this.mediaRepository.findOne({
            where: { id: mediaId, ownerId, deletedAt: IsNull() },
        });
        if (!media) throw new NotFoundException({ code: 'MEDIA_NOT_FOUND' });
        if (media.purpose === 'avatar') throw new ForbiddenException({ code: 'AVATAR_ALWAYS_PUBLIC' });
        if (media.visibility === 'private') return media;
        await this.purgePrefix(`${PREFIX.PUBLIC}/${ownerId}/${mediaId}/`);
        await this.invalidate([`/${PREFIX.PUBLIC}/${ownerId}/${mediaId}/*`]);
        media.visibility = 'private';
        return this.mediaRepository.save(media);
    }

    async trashMedia(ownerId: string, mediaId: string): Promise<void> {
        const media = await this.mediaRepository.findOne({
            where: { id: mediaId, ownerId, deletedAt: IsNull() },
        });
        if (!media) throw new NotFoundException({ code: 'MEDIA_NOT_FOUND' });
        if (media.visibility === 'public') {
            await this.purgePrefix(`${PREFIX.PUBLIC}/${ownerId}/${mediaId}/`);
            await this.invalidate([`/${PREFIX.PUBLIC}/${ownerId}/${mediaId}/*`]);
            media.visibility = 'private';
        }
        media.deletedAt = new Date();
        await this.mediaRepository.save(media);
    }

    async destroyMedia(ownerId: string, mediaId: string): Promise<void> {
        if (!this.config) throw new Error('CdnService non initialisé.');
        const media = await this.mediaRepository.findOne({ where: { id: mediaId, ownerId } });
        if (!media) throw new NotFoundException({ code: 'MEDIA_NOT_FOUND' });
        await this.purgePrefix(`${PREFIX.PRIVATE}/${ownerId}/${mediaId}/`);
        await this.purgePrefix(`${PREFIX.PUBLIC}/${ownerId}/${mediaId}/`);
        await this.s3.send(
            new DeleteObjectsCommand({
                Bucket: this.config.bucket,
                Delete: {
                    Objects: [{ Key: `${PREFIX.ORIGINAL}/${ownerId}/${mediaId}.${media.ext}` }],
                    Quiet: true,
                },
            }),
        );
        await this.mediaRepository.delete({ id: mediaId, ownerId });
        await this.invalidate([`/${PREFIX.PUBLIC}/${ownerId}/${mediaId}/*`]);
    }

    async purgePrefix(prefix: string): Promise<void> {
        if (!this.config) throw new Error('CdnService non initialisé.');
        const { bucket } = this.config;
        const keys: { Key: string }[] = [];
        let token: string | undefined;
        do {
            const page = await this.s3.send(
                new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }),
            );
            for (const o of page.Contents ?? []) if (o.Key) keys.push({ Key: o.Key });
            token = page.NextContinuationToken;
        } while (token);
        for (let i = 0; i < keys.length; i += 1000) {
            await this.s3.send(
                new DeleteObjectsCommand({
                    Bucket: bucket,
                    Delete: { Objects: keys.slice(i, i + 1000), Quiet: true },
                }),
            );
        }
    }

    async invalidate(paths: string[]): Promise<void> {
        if (!paths.length) return;
        if (!this.config) throw new Error('CdnService non initialisé.');
        try {
            await this.cloudfront.send(
                new CreateInvalidationCommand({
                    DistributionId: this.config.distributionId,
                    InvalidationBatch: {
                        CallerReference: randomUUID(),
                        Paths: { Quantity: paths.length, Items: paths },
                    },
                }),
            );
        } catch (err) {
            this.logger.warn(`Invalidation CloudFront échouée : ${(err as Error).message}`);
        }
    }
}