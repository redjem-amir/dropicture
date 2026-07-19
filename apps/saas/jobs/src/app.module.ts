// dropicture/apps/saas/jobs/src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Media } from './models/media.entity';
import { CdnService } from './services/cdn.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.PGBOUNCER_HOST_DROPICTURE_SAAS,
      port: Number(process.env.PGBOUNCER_PORT_DROPICTURE_SAAS),
      database: process.env.POSTGRES_DB_DROPICTURE_SAAS,
      username: process.env.POSTGRES_USER_DROPICTURE_SAAS,
      password: process.env.POSTGRES_PASSWORD_DROPICTURE_SAAS,
      entities: [Media],
      synchronize: false,
      migrationsRun: false,
      extra: {
        max: 4,
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
        idleTimeoutMillis: 300000,
        maxLifetimeSeconds: 1800,
        connectionTimeoutMillis: 5000,
        query_timeout: 60000,
      },
    }),
    TypeOrmModule.forFeature([Media]),
  ],
  providers: [CdnService],
})
export class AppModule { }