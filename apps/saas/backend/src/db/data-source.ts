// dropicture/apps/saas/backend/src/db/data-source.ts
import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import { Account } from '../models/account.entity';
import { Follow } from '../models/follow.entity';
import { Media } from '../models/media.entity';
import { Album } from '../models/album.entity';
import { Placement } from '../models/placement.entity';

// Chargement du fichier .env avant toute lecture de `process.env`. La CLI TypeORM consomme ce module
// sans amorcer Nest, elle ne bénéficie donc pas de `ConfigModule` et doit peupler l'environnement
// elle-même. Aucun identifiant de base n'est écrit en dur dans le dépôt.
config();

/**
 * Inventaire des entités TypeORM du domaine. Cette constante est la source unique consommée à la fois
 * par les deux sources de données et par `TypeOrmModule.forFeature` dans le module racine, ce qui évite
 * qu'un dépôt injectable et une migration ne travaillent sur des jeux de tables divergents.
 */
export const entities = [Account, Album, Follow, Media, Placement];

/**
 * Réglages communs aux deux sources de données, identité de connexion et jeu d'entités.
 *
 * @remarks `synchronize` reste à `false` en toutes circonstances. Le schéma n'évolue que par migrations
 * versionnées et relues, jamais par alignement automatique au démarrage, qui pourrait détruire des
 * colonnes ou des index en production.
 */
const base = {
  type: 'postgres' as const,
  username: process.env.POSTGRES_USER_DROPICTURE_SAAS,
  password: process.env.POSTGRES_PASSWORD_DROPICTURE_SAAS,
  database: process.env.POSTGRES_DB_DROPICTURE_SAAS,
  entities,
  synchronize: false,
  migrationsTableName: 'migrations',
};

/**
 * Options employées par l'application à l'exécution. Le trafic transite par PgBouncer et non par
 * Postgres en direct, et aucune migration n'est déclarée ici.
 *
 * @remarks Le pool applicatif est délibérément court, dix connexions, parce que PgBouncer mutualise déjà
 * les sessions côté serveur, un pool large ne ferait qu'épuiser les emplacements du moteur sans gagner
 * en débit. Les gardes de temps bornent la propagation des incidents, cinq secondes pour obtenir une
 * connexion et trente secondes par requête, une requête bloquée ne peut donc pas retenir un travailleur
 * indéfiniment ni servir de levier à un déni de service. `keepAlive` et le recyclage des connexions au
 * bout de trente minutes (`maxLifetimeSeconds`) écartent les sockets coupées silencieusement par les
 * équipements réseau intermédiaires, tandis que les connexions inactives sont rendues au bout de cinq
 * minutes.
 */
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

/**
 * Source de données réservée à la CLI TypeORM, génération et exécution des migrations. Elle attaque
 * Postgres directement sur `POSTGRES_HOST_DROPICTURE_SAAS` et contourne PgBouncer.
 *
 * @remarks Une migration a besoin d'une session stable du début à la fin, ce que l'assemblage par
 * transaction de PgBouncer ne garantit pas, d'où la connexion directe au port 5432. C'est aussi la seule
 * source qui déclare `migrations`, le processus applicatif ne dispose donc d'aucun chemin pour altérer
 * le schéma de lui-même, l'évolution de structure reste un acte de déploiement explicite.
 */
export default new DataSource({
  ...base,
  host: process.env.POSTGRES_HOST_DROPICTURE_SAAS,
  port: Number(process.env.POSTGRES_PORT_DROPICTURE_SAAS ?? 5432),
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
});
