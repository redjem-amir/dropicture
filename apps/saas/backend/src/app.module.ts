// dropicture/apps/saas/backend/src/app.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';
import { RedisService } from './services/redis.service';
import { MediaService } from './services/media.service';
import { AccessTokenStrategy } from './guards/access.strategy';
import { ApiKeyStrategy } from './guards/api-key.strategy';
import { dataSourceOptions, entities } from './db/data-source';
import { SettingsController } from './controllers/settings.controller';
import { ProfileController } from './controllers/profile.controller';
import { LibraryController } from './controllers/library.controller';
import { DiscoverController } from './controllers/discover.controller';
import { PublicController } from './controllers/public.controller';
import IORedis from 'ioredis';

/**
 * Module racine de l'API. Il câble la source de données Postgres, le magasin Redis de limitation de
 * débit, les six contrôleurs de domaine (authentification, paramètres, profil, bibliothèque, découverte,
 * API publique) et les fournisseurs partagés par tous, gestion de session, accès aux médias et
 * stratégies d'authentification.
 *
 * @remarks `ThrottlerGuard` est déclaré en garde globale via `APP_GUARD`, la limitation par défaut est
 * de soixante requêtes par minute, les routes sensibles la resserrent avec leur propre décorateur
 * `Throttle`. Le compteur vit dans Redis et non en mémoire de processus, la limite reste donc commune
 * quand plusieurs instances de l'API tournent derrière le répartiteur de charge, ce qui la rend
 * réellement opposable à une attaque par force brute. `PassportModule` fixe `access-token` comme
 * stratégie par défaut, la stratégie `api-key` doit être demandée explicitement par les routes qui
 * l'acceptent. `ConfigModule` est global, les variables d'environnement sont lisibles sans réimport.
 * `TypeOrmModule.forFeature(entities)` rend les dépôts des cinq entités injectables dans les
 * contrôleurs, aucun module de domaine séparé n'est nécessaire.
 */
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
  controllers: [AuthController, SettingsController, ProfileController, LibraryController, DiscoverController, PublicController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }, AccessTokenStrategy, ApiKeyStrategy, AuthService, RedisService, MediaService],
})
export class AppModule {}
