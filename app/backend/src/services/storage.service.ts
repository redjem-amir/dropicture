// dropicture/app/backend/src/services/storage.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

@Injectable()
export class StorageService implements OnModuleInit {
    private readonly logger = new Logger(StorageService.name);
    private readonly bucket = process.env.S3_BUCKET ?? 'media';
    private readonly region = process.env.S3_REGION ?? 'garage';
    private readonly forcePathStyle = process.env.S3_FORCE_PATH_STYLE !== 'false';
    private readonly credentials = {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    };

    private readonly s3 = new S3Client({
        endpoint: process.env.S3_ENDPOINT,
        region: this.region,
        forcePathStyle: this.forcePathStyle,
        credentials: this.credentials,
        requestChecksumCalculation: 'WHEN_REQUIRED',
        responseChecksumValidation: 'WHEN_REQUIRED',
    });

    private readonly signer = new S3Client({
        endpoint: process.env.S3_PUBLIC_ENDPOINT ?? process.env.S3_ENDPOINT,
        region: this.region,
        forcePathStyle: this.forcePathStyle,
        credentials: this.credentials,
        requestChecksumCalculation: 'WHEN_REQUIRED',
        responseChecksumValidation: 'WHEN_REQUIRED',
    });

    async onModuleInit() {
        try {
            await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
        } catch {
            this.logger.warn(
                `S3 bucket "${this.bucket}" unreachable — did you run the Garage bootstrap (layout/key/bucket)?`,
            );
        }
    }

    async upload(key: string, body: Buffer, contentType: string): Promise<void> {
        await this.s3.send(
            new PutObjectCommand({
                Bucket: this.bucket,
                Key: key,
                Body: body,
                ContentType: contentType,
                CacheControl: 'private, max-age=86400',
            }),
        );
    }

    async download(key: string): Promise<Readable> {
        const res = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
        return res.Body as Readable;
    }

    async remove(key: string): Promise<void> {
        await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    }

    async getPresignedUrl(key: string, expiresIn = 3600, downloadName?: string): Promise<string> {
        return getSignedUrl(
            this.signer,
            new GetObjectCommand({
                Bucket: this.bucket,
                Key: key,
                ...(downloadName
                    ? { ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}` }
                    : {}),
            }),
            { expiresIn },
        );
    }
}