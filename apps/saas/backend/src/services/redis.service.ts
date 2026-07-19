// dropicture/apps/saas/backend/src/services/redis.service.ts
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

const isProd = process.env.NODE_ENV === 'production';

function env(name: string, fallback: string): string {
  const value = process.env[name];
  if (value) return value;
  if (isProd) throw new Error(`${name} is required in production`);
  return fallback;
}

const COMMON = {
  db: 0,
  connectTimeout: 10_000,
  retryStrategy: (times: number) => Math.min(times * 100, 3_000),
};

export const REDIS_CACHE_OPTIONS = {
  ...COMMON,
  host: env('REDIS_CACHE_HOST_DROPICTURE_SAAS', '127.0.0.1'),
  port: 6379,
  maxRetriesPerRequest: 3,
};

export const REDIS_QUEUE_OPTIONS = {
  ...COMMON,
  host: env('REDIS_QUEUE_HOST_DROPICTURE_SAAS', '127.0.0.1'),
  port: 6380,
  maxRetriesPerRequest: null,
  commandTimeout: 5_000,
};

export const REDIS_QUEUE_BLOCKING_OPTIONS = {
  ...REDIS_QUEUE_OPTIONS,
  commandTimeout: undefined,
};

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  readonly cache = new Redis({
    ...REDIS_CACHE_OPTIONS,
    connectionName: 'saas-backend:cache',
  });

  constructor() {
    this.cache.on('connect', () =>
      this.logger.log(
        `Redis cache connected (${REDIS_CACHE_OPTIONS.host}:${REDIS_CACHE_OPTIONS.port})`,
      ),
    );
    this.cache.on('reconnecting', (delay: number) =>
      this.logger.warn(`Redis cache reconnecting in ${delay}ms`),
    );
    this.cache.on('error', (err: Error) =>
      this.logger.error(`Redis cache error: ${err.message}`),
    );
    this.logger.log(
      `Redis queue → ${REDIS_QUEUE_OPTIONS.host}:${REDIS_QUEUE_OPTIONS.port} (BullMQ)`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.cache.quit();
    } catch {
      this.cache.disconnect();
    }
  }
}
