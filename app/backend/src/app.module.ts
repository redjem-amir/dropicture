// dropicture/app/backend/src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisService } from './services/redis.service';
import { APP_GUARD } from '@nestjs/core';
import { IpThrottlerGuard } from './guards/throttler.guard';
import { ThrottlerModule } from '@nestjs/throttler';
import IORedis from 'ioredis';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { StorageService } from './services/storage.service';

const entities = [];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot({
      throttlers: [{ limit: 100, ttl: 60_000 }],
      storage: new ThrottlerStorageRedisService(
        new IORedis({
          host: process.env.REDIS_HOST,
          port: Number(process.env.REDIS_PORT ?? 6379),
          password: process.env.REDIS_PASSWORD,
          db: Number(process.env.REDIS_THROTTLE_DB ?? 1),
        }),
      ),
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.POSTGRES_HOST,
      port: parseInt(process.env.POSTGRES_PORT ?? '5432', 10),
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB,
      entities,
      synchronize: true,
      extra: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
        acquireTimeoutMillis: 10000,
        statement_timeout: 30000,
        prepare: false,
      },
    }),
    TypeOrmModule.forFeature(entities),
  ],
  controllers: [],
  providers: [
    { provide: APP_GUARD, useClass: IpThrottlerGuard },
    RedisService,
    StorageService,
  ],
})
export class AppModule {}