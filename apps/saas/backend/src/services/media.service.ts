// dropicture/apps/saas/backend/src/services/media.service.ts
import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { Transform, type Readable } from 'node:stream';
import { SSMClient, GetParametersByPathCommand } from '@aws-sdk/client-ssm';
import { DeleteObjectsCommand, S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import { Media, type MediaKind, type MediaRole } from '../models/media.entity';

export const MEDIA_PREFIX = 'media';

export const MEDIA_TYPES: Record<string, { ext: string; kind: MediaKind }> = {
  'image/jpeg': { ext: 'jpg', kind: 'image' },
  'image/png': { ext: 'png', kind: 'image' },
  'image/webp': { ext: 'webp', kind: 'image' },
  'image/avif': { ext: 'avif', kind: 'image' },
  'image/heic': { ext: 'heic', kind: 'image' },
  'video/mp4': { ext: 'mp4', kind: 'video' },
  'video/quicktime': { ext: 'mov', kind: 'video' },
  'video/webm': { ext: 'webm', kind: 'video' },
};

export const MEDIA_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const MEDIA_LIMITS = {
  IMAGE_MAX_BYTES: 8 * 1024 * 1024,
  AVATAR_MAX_BYTES: 8 * 1024 * 1024,
  VIDEO_MAX_BYTES: 100 * 1024 * 1024,
  PART_SIZE: 5 * 1024 * 1024,
  PART_CONCURRENCY: 2,
  DELETE_BATCH: 1000,
} as const;

export const extOf = (mimeType: string): string => MEDIA_TYPES[mimeType]?.ext ?? 'bin';
export const kindOf = (mimeType: string): MediaKind => MEDIA_TYPES[mimeType]?.kind ?? 'image';

export type MediaView = {
  id: string;
  kind: MediaKind;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  url: string;
};

export type UploadParams = {
  ownerId: string;
  role: MediaRole;
  stream: Readable;
  mimeType: string;
  contentLength?: number;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
  capturedAt?: Date | null;
};

class TooLargeError extends Error {}

@Injectable()
export class MediaService implements OnModuleInit {
  private readonly logger = new Logger(MediaService.name);
  private readonly region = process.env.AWS_REGION ?? 'eu-west-3';
  private readonly ssmPrefix = process.env.CDN_SSM_PREFIX ?? '/dropicture/cloudfront';

  private readonly s3 = new S3Client({ region: this.region });
  private readonly cloudfront = new CloudFrontClient({ region: 'us-east-1' });
  private bucket!: string;
  private domain!: string;
  private distributionId!: string;

  constructor(
    @InjectRepository(Media)
    private readonly mediaRepository: Repository<Media>,
  ) {}

  async onModuleInit(): Promise<void> {
    const ssm = new SSMClient({ region: this.region });
    const params: Record<string, string> = {};
    try {
      let token: string | undefined;
      do {
        const page = await ssm.send(new GetParametersByPathCommand({ Path: this.ssmPrefix, Recursive: true, NextToken: token }));
        for (const p of page.Parameters ?? []) {
          if (p.Name && p.Value) params[p.Name.slice(this.ssmPrefix.length + 1)] = p.Value;
        }
        token = page.NextToken;
      } while (token);
    } finally {
      ssm.destroy();
    }
    this.bucket = params['bucket'];
    this.domain = params['domain'];
    this.distributionId = params['distribution_id'];
    const missing = Object.entries({ bucket: this.bucket, domain: this.domain, distribution_id: this.distributionId })
      .filter(([, v]) => !v)
      .map(([k]) => k);
    if (missing.length) {
      throw new Error(`Configuration CDN incomplète dans SSM ${this.ssmPrefix} (${missing.join(', ')}).`);
    }
    this.logger.log(`Média prêt · ${this.domain}`);
  }

  key(media: Pick<Media, 'id' | 'ownerId' | 'mimeType'>): string {
    return `${MEDIA_PREFIX}/${media.ownerId}/${media.id}.${extOf(media.mimeType)}`;
  }

  view(media: Media): MediaView {
    return {
      id: media.id,
      kind: kindOf(media.mimeType),
      width: media.width,
      height: media.height,
      durationMs: media.durationMs,
      url: `${this.domain}/${this.key(media)}`,
    };
  }

  limits() {
    return {
      image: { maxBytes: MEDIA_LIMITS.IMAGE_MAX_BYTES },
      video: { maxBytes: MEDIA_LIMITS.VIDEO_MAX_BYTES },
      avatar: { maxBytes: MEDIA_LIMITS.AVATAR_MAX_BYTES, accepted: MEDIA_AVATAR_TYPES },
      accepted: Object.keys(MEDIA_TYPES),
    };
  }

  maxBytes(kind: MediaKind, role: MediaRole): number {
    if (role === 'avatar') return MEDIA_LIMITS.AVATAR_MAX_BYTES;
    return kind === 'video' ? MEDIA_LIMITS.VIDEO_MAX_BYTES : MEDIA_LIMITS.IMAGE_MAX_BYTES;
  }

  async upload(params: UploadParams): Promise<Media> {
    const type = MEDIA_TYPES[params.mimeType];
    if (!type) {
      throw new BadRequestException({
        code: 'UNSUPPORTED_MEDIA_TYPE',
        message: `Type non accepté. Formats : ${Object.keys(MEDIA_TYPES).join(', ')}.`,
      });
    }
    const isAvatar = params.role === 'avatar';
    if (isAvatar && !MEDIA_AVATAR_TYPES.includes(params.mimeType)) {
      throw new BadRequestException({ code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Photo de profil : JPEG, PNG ou WEBP.' });
    }
    const max = this.maxBytes(type.kind, params.role);
    if (params.contentLength && params.contentLength > max) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: `Poids maximal : ${Math.round(max / 1024 / 1024)} Mo.`,
      });
    }
    const id = randomUUID();
    const key = `${MEDIA_PREFIX}/${params.ownerId}/${id}.${type.ext}`;
    let bytes = 0;
    const guard = new Transform({
      transform(chunk: Buffer, _enc, cb) {
        bytes += chunk.length;
        if (bytes > max) return cb(new TooLargeError());
        cb(null, chunk);
      },
    });
    params.stream.pipe(guard);
    const upload = new Upload({
      client: this.s3,
      params: {
        Bucket: this.bucket,
        Key: key,
        Body: guard,
        ContentType: params.mimeType,
        CacheControl: 'public, max-age=31536000, immutable',
      },
      partSize: MEDIA_LIMITS.PART_SIZE,
      queueSize: MEDIA_LIMITS.PART_CONCURRENCY,
    });
    try {
      await upload.done();
    } catch (err) {
      await upload.abort().catch(() => undefined);
      if (err instanceof TooLargeError || (err as Error)?.cause instanceof TooLargeError) {
        throw new BadRequestException({
          code: 'FILE_TOO_LARGE',
          message: `Poids maximal : ${Math.round(max / 1024 / 1024)} Mo.`,
        });
      }
      throw new BadRequestException({ code: 'UPLOAD_FAILED', message: 'Envoi interrompu.' });
    }
    if (!bytes) {
      await this.s3.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: [{ Key: key }], Quiet: true },
        }),
      );
      throw new BadRequestException({ code: 'FILE_REQUIRED' });
    }
    return this.mediaRepository.save(
      this.mediaRepository.create({
        id,
        ownerId: params.ownerId,
        role: params.role,
        mimeType: params.mimeType,
        bytes: String(bytes),
        width: params.width ?? null,
        height: params.height ?? null,
        durationMs: params.durationMs ?? null,
        capturedAt: params.capturedAt ?? null,
        publishedAt: isAvatar ? new Date() : null,
      }),
    );
  }

  async publish(ownerId: string, mediaIds: string[]): Promise<string[]> {
    if (!mediaIds.length) return [];
    const result = await this.mediaRepository
      .createQueryBuilder()
      .update(Media)
      .set({ publishedAt: () => 'COALESCE("publishedAt", NOW())' })
      .where('id IN (:...ids)', { ids: mediaIds })
      .andWhere('"ownerId" = :ownerId', { ownerId })
      .returning('id')
      .execute();
    return ((result.raw ?? []) as { id: string }[]).map((r) => r.id);
  }

  async unpublish(ownerId: string, mediaIds: string[]): Promise<string[]> {
    if (!mediaIds.length) return [];
    const result = await this.mediaRepository
      .createQueryBuilder()
      .update(Media)
      .set({ publishedAt: null })
      .where('id IN (:...ids)', { ids: mediaIds })
      .andWhere('"ownerId" = :ownerId', { ownerId })
      .andWhere("role <> 'avatar'")
      .returning('id')
      .execute();
    return ((result.raw ?? []) as { id: string }[]).map((r) => r.id);
  }

  async destroy(ownerId: string, mediaIds: string[]): Promise<string[]> {
    if (!mediaIds.length) return [];
    const rows = await this.mediaRepository.find({ where: { id: In(mediaIds), ownerId } });
    if (!rows.length) return [];
    const keys = rows.map((m) => this.key(m));

    for (let i = 0; i < keys.length; i += MEDIA_LIMITS.DELETE_BATCH) {
      const slice = keys.slice(i, i + MEDIA_LIMITS.DELETE_BATCH);
      if (!slice.length) continue;
      await this.s3.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: slice.map((Key) => ({ Key })), Quiet: true },
        }),
      );
    }

    await this.mediaRepository.delete({ id: In(rows.map((r) => r.id)), ownerId });

    const paths = keys.map((k) => `/${k}`);
    if (paths.length) {
      try {
        await this.cloudfront.send(
          new CreateInvalidationCommand({
            DistributionId: this.distributionId,
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

    return rows.map((r) => r.id);
  }
}
