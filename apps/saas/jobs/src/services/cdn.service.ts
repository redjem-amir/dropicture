// dropicture/apps/saas/jobs/src/services/cdn.service.ts
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { spawn } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Worker, UnrecoverableError, type Job } from 'bullmq';
import sharp from 'sharp';
import { rgbaToThumbHash } from 'thumbhash';
import { SSMClient, GetParametersByPathCommand } from '@aws-sdk/client-ssm';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Media } from '../models/media.entity';

const PREFIX = { ORIGINAL: 'originals', PRIVATE: 'private', PUBLIC: 'public' } as const;

const LIMITS = {
  VIDEO_MIN_DURATION_MS: 3_000,
  VIDEO_MAX_DURATION_MS: 15 * 60 * 1000,
  DECODE_MAX_PIXELS: 100_000_000,
} as const;

const OUTPUT = {
  IMAGE_MAX_WIDTH: 1440,
  AVATAR_MAX_WIDTH: 480,
  VIDEO_MAX_HEIGHT: 1080,
  VIDEO_MAX_FPS: 30,
} as const;

const CONTENT_WIDTHS = [160, 320, 480, 720, 1080, 1440];
const AVATAR_WIDTHS = [64, 160, 480];

const HLS_LADDER = [
  { height: 360, bitrate: '800k', maxrate: '900k', bufsize: '1200k' },
  { height: 720, bitrate: '2400k', maxrate: '2700k', bufsize: '3600k' },
  { height: 1080, bitrate: '4500k', maxrate: '5000k', bufsize: '7000k' },
];

const QUEUE = 'media';

class RejectedError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

@Injectable()
export class CdnService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CdnService.name);
  private readonly region = process.env.AWS_REGION ?? 'eu-west-3';
  private readonly ssmPrefix = process.env.CDN_SSM_PREFIX ?? '/dropicture/cloudfront';

  private readonly s3: S3Client;
  private bucket!: string;
  private worker!: Worker;

  constructor(
    @InjectRepository(Media)
    private readonly mediaRepository: Repository<Media>,
  ) {
    this.s3 = new S3Client({ region: this.region });
    sharp.concurrency(1);
    sharp.cache({ files: 0, memory: 128 });
  }

  async onModuleInit(): Promise<void> {
    const ssm = new SSMClient({ region: this.region });
    try {
      const page = await ssm.send(
        new GetParametersByPathCommand({
          Path: this.ssmPrefix,
          Recursive: true,
          WithDecryption: false,
        }),
      );
      for (const p of page.Parameters ?? []) {
        if (p.Name?.endsWith('/bucket') && p.Value) this.bucket = p.Value;
      }
    } finally {
      ssm.destroy();
    }
    if (!this.bucket) throw new Error(`SSM ${this.ssmPrefix}/bucket est absent.`);
    this.worker = new Worker(
      QUEUE,
      async (job: Job<{ mediaId: string; ownerId: string }>) => {
        await this.process(job.data.mediaId);
      },
      {
        connection: {
          host: process.env.REDIS_QUEUE_HOST_DROPICTURE_SAAS ?? '127.0.0.1',
          port: 6380,
          maxRetriesPerRequest: null,
        },
        concurrency: 1,
        lockDuration: 45 * 60 * 1000,
      },
    );
    this.worker.on('failed', (job, err) =>
      this.logger.error(`Traitement échoué ${job?.data?.mediaId} : ${err.message}`),
    );
    this.logger.log(`Worker média prêt · bucket ${this.bucket}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close().catch(() => undefined);
  }

  async process(mediaId: string): Promise<void> {
    const media = await this.mediaRepository.findOne({ where: { id: mediaId } });
    if (!media) return;
    media.status = 'processing';
    await this.mediaRepository.save(media);
    const dir = await mkdtemp(join(tmpdir(), 'dp-'));
    try {
      const srcKey = `${PREFIX.ORIGINAL}/${media.ownerId}/${media.id}.${media.ext}`;
      const obj = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: srcKey }));
      const source = Buffer.from(await obj.Body!.transformToByteArray());
      const root = media.visibility === 'public' ? PREFIX.PUBLIC : PREFIX.PRIVATE;
      const dest = `${root}/${media.ownerId}/${media.id}`;
      if (media.kind === 'image') {
        await this.processImage(media, source, dest);
      } else {
        await this.processVideo(media, source, dest, dir);
      }
      media.status = 'ready';
      media.errorCode = null;
      media.error = null;
      await this.mediaRepository.save(media);
    } catch (err) {
      const rejected = err instanceof RejectedError;
      media.status = rejected ? 'rejected' : 'failed';
      media.errorCode = rejected ? err.code : 'PROCESSING_FAILED';
      media.error = (err as Error).message.slice(0, 500);
      await this.mediaRepository.save(media);
      if (rejected) throw new UnrecoverableError((err as Error).message);
      throw err;
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  async processImage(media: Media, source: Buffer, dest: string): Promise<void> {
    const probe = await sharp(source, { limitInputPixels: LIMITS.DECODE_MAX_PIXELS })
      .metadata()
      .catch(() => {
        throw new RejectedError('IMAGE_UNREADABLE', 'Image illisible.');
      });
    const turned = (probe.orientation ?? 1) >= 5;
    const srcWidth = (turned ? probe.height : probe.width) ?? 0;
    const srcHeight = (turned ? probe.width : probe.height) ?? 0;
    if (!srcWidth || !srcHeight) {
      throw new RejectedError('IMAGE_UNREADABLE', 'Dimensions introuvables.');
    }
    media.width = srcWidth;
    media.height = srcHeight;
    if (probe.exif) media.capturedAt = this.readCapturedAt(probe.exif);
    const base = sharp(source, { limitInputPixels: LIMITS.DECODE_MAX_PIXELS }).rotate();
    const avatar = media.purpose === 'avatar';
    const shaped = avatar
      ? base.clone().resize({
        width: OUTPUT.AVATAR_MAX_WIDTH,
        height: OUTPUT.AVATAR_MAX_WIDTH,
        fit: 'cover',
        position: 'attention',
      })
      : base;
    const cap = avatar ? OUTPUT.AVATAR_MAX_WIDTH : OUTPUT.IMAGE_MAX_WIDTH;
    const usable = Math.min(srcWidth, cap);
    const ladder = avatar ? AVATAR_WIDTHS : CONTENT_WIDTHS;
    const widths = ladder.filter((w) => w <= usable);
    if (!widths.length) widths.push(usable);
    if (!widths.includes(usable) && usable < cap) widths.push(usable);
    widths.sort((a, b) => a - b);
    for (const w of widths) {
      const resized = shaped.clone().resize({ width: w, withoutEnlargement: true });
      const [avif, webp] = await Promise.all([
        resized.clone().avif({ quality: 62, effort: 4 }).toBuffer(),
        resized.clone().webp({ quality: 78 }).toBuffer(),
      ]);
      await Promise.all([
        this.put(`${dest}/${w}.avif`, avif, 'image/avif'),
        this.put(`${dest}/${w}.webp`, webp, 'image/webp'),
      ]);
    }
    media.widths = widths;
    const { data, info } = await base
      .clone()
      .resize(100, 100, { fit: 'inside' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    media.thumbhash = Buffer.from(rgbaToThumbHash(info.width, info.height, data));
  }

  async processVideo(media: Media, source: Buffer, dest: string, dir: string): Promise<void> {
    const input = join(dir, `src.${media.ext}`);
    await writeFile(input, source);
    const probe = await this.run('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height:format=duration',
      '-of', 'json',
      input,
    ]).catch(() => {
      throw new RejectedError('VIDEO_UNREADABLE', 'Vidéo illisible.');
    });
    const info = JSON.parse(probe) as {
      streams?: { width?: number; height?: number }[];
      format?: { duration?: string };
    };
    const stream = info.streams?.[0];
    if (!stream?.width || !stream?.height) {
      throw new RejectedError('VIDEO_UNREADABLE', 'Piste vidéo introuvable.');
    }
    const durationMs = info.format?.duration
      ? Math.round(Number(info.format.duration) * 1000)
      : 0;
    if (durationMs > LIMITS.VIDEO_MAX_DURATION_MS) {
      throw new RejectedError(
        'VIDEO_TOO_LONG',
        `Durée maximale : ${LIMITS.VIDEO_MAX_DURATION_MS / 60000} minutes.`,
      );
    }
    if (durationMs && durationMs < LIMITS.VIDEO_MIN_DURATION_MS) {
      throw new RejectedError(
        'VIDEO_TOO_SHORT',
        `Durée minimale : ${LIMITS.VIDEO_MIN_DURATION_MS / 1000} secondes.`,
      );
    }
    media.width = stream.width;
    media.height = stream.height;
    media.durationMs = durationMs || null;
    const posterPath = join(dir, 'poster.jpg');
    await this.run('ffmpeg', [
      '-v', 'error', '-y',
      '-ss', durationMs > 1500 ? '00:00:01' : '00:00:00',
      '-i', input,
      '-frames:v', '1',
      '-vf', `scale='min(1080,iw)':-2`,
      posterPath,
    ]);
    const poster = await readFile(posterPath);
    await this.put(`${dest}/poster.jpg`, poster, 'image/jpeg');
    const rgba = await sharp(poster)
      .resize(100, 100, { fit: 'inside' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    media.thumbhash = Buffer.from(rgbaToThumbHash(rgba.info.width, rgba.info.height, rgba.data));
    const ceiling = Math.min(stream.height, OUTPUT.VIDEO_MAX_HEIGHT);
    const rungs = HLS_LADDER.filter((r) => r.height <= ceiling);
    if (!rungs.length) rungs.push(HLS_LADDER[0]);
    const args = ['-v', 'error', '-y', '-i', input];
    const varmap: string[] = [];
    rungs.forEach((r, i) => {
      args.push(
        '-map', '0:v:0', '-map', '0:a:0?',
        `-filter:v:${i}`, `scale=-2:${r.height}`,
        `-c:v:${i}`, 'libx264', '-preset', 'veryfast', '-profile:v', 'main',
        `-b:v:${i}`, r.bitrate, `-maxrate:v:${i}`, r.maxrate, `-bufsize:v:${i}`, r.bufsize,
        '-g', '48', '-keyint_min', '48', '-sc_threshold', '0',
      );
      varmap.push(`v:${i},a:${i}`);
    });
    args.push(
      '-r', String(OUTPUT.VIDEO_MAX_FPS),
      '-c:a', 'aac', '-b:a', '128k', '-ac', '2',
      '-f', 'hls',
      '-hls_time', '4',
      '-hls_playlist_type', 'vod',
      '-hls_segment_filename', join(dir, 'v%v_%03d.ts'),
      '-master_pl_name', 'index.m3u8',
      '-var_stream_map', varmap.join(' '),
      join(dir, 'v%v.m3u8'),
    );
    await this.run('ffmpeg', args);
    for (const name of await readdir(dir)) {
      if (name.startsWith('src.') || name === 'poster.jpg') continue;
      const body = await readFile(join(dir, name));
      const type = name.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/mp2t';
      await this.put(`${dest}/${name}`, body, type);
    }
    media.widths = [];
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
  }

  readCapturedAt(exif: Buffer): Date | null {
    const match = exif.toString('latin1').match(/(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
    if (!match) return null;
    const [, y, mo, d, h, mi, s] = match;
    const date = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  run(bin: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(bin, args);
      let out = '';
      let err = '';
      child.stdout.on('data', (c) => (out += c));
      child.stderr.on('data', (c) => (err += c));
      child.on('error', reject);
      child.on('close', (code) =>
        code === 0 ? resolve(out) : reject(new Error(`${bin} (${code}) : ${err.slice(0, 400)}`)),
      );
    });
  }
}