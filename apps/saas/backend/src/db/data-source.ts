// dropicture/apps/saas/backend/src/db/data-source.ts
import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import { Account } from '../models/account.entity';
import { Follow } from '../models/follow.entity';
import { Media } from '../models/media.entity';
import { Gallery } from '../models/gallery.entity';
import { GalleryMedia } from '../models/gallery-media.entity';

config();

export const entities = [Account, Media, Gallery, GalleryMedia, Follow];

const base = {
  type: 'postgres' as const,
  username: process.env.POSTGRES_USER_DROPICTURE_SAAS,
  password: process.env.POSTGRES_PASSWORD_DROPICTURE_SAAS,
  database: process.env.POSTGRES_DB_DROPICTURE_SAAS,
  entities,
  synchronize: false,
  migrationsTableName: 'migrations',
};

export const dataSourceOptions: DataSourceOptions = {
  ...base,
  host: process.env.PGBOUNCER_HOST_DROPICTURE_SAAS,
  port: Number(process.env.PGBOUNCER_PORT_DROPICTURE_SAAS ?? 6432),
  extra: {
    max: 10,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    idleTimeoutMillis: 300000,
    maxLifetimeSeconds: 1800,
    connectionTimeoutMillis: 5000,
    query_timeout: 30000,
  },
};

export default new DataSource({
  ...base,
  host: process.env.POSTGRES_HOST_DROPICTURE_SAAS,
  port: Number(process.env.POSTGRES_PORT_DROPICTURE_SAAS ?? 5432),
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
});
