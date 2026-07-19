// dropicture/apps/saas/backend/src/app.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import IORedis from 'ioredis';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';
import { RedisService } from './services/redis.service';
import { CdnService } from './services/cdn.service';
import { AccessTokenStrategy } from './guards/access.strategy';
import { ApiKeyStrategy } from './guards/api-key.strategy';
import { dataSourceOptions, entities } from './db/data-source';
import { SettingsController } from './controllers/settings.controller';
import { ProfileController } from './controllers/profile.controller';
import { LibraryController } from './controllers/library.controller';
import { GalleryController } from './controllers/gallery.controller';
import { DiscoverController } from './controllers/discover.controller';
import { PublicProfileController } from './controllers/public-profile.controller';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'access-token' }),
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot({
      throttlers: [{ limit: 60, ttl: 60_000 }],
      storage: new ThrottlerStorageRedisService(new IORedis({ host: process.env.REDIS_CACHE_HOST_DROPICTURE_SAAS })),
    }),
    TypeOrmModule.forRoot(dataSourceOptions),
    TypeOrmModule.forFeature(entities),
  ],
  controllers: [AuthController, SettingsController, ProfileController, LibraryController, GalleryController, DiscoverController, PublicProfileController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }, AccessTokenStrategy, ApiKeyStrategy, AuthService, RedisService, CdnService],
})
export class AppModule {}
