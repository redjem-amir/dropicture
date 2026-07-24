# 05 · Base de données

PostgreSQL 18, accédée par le backend au travers de PgBouncer, schéma géré par migrations TypeORM. Les modèles conceptuel et logique détaillés sont en Annexe D (MCD) et Annexe E (MLD), le script SQL complet en Annexe E bis.

## Entités

Cinq entités, dans l'ordre d'enregistrement `Account, Album, Follow, Media, Placement`.

### Account · table `accounts`
Identité et sécurité d'un membre. `id` uuid (clé primaire), `username` (30, unique), `email` (255, unique), `passwordHash` (texte, non sélectionné par défaut), `firstname` et `lastname` (30), `bio` (160, nullable), `avatarMediaId` (uuid nullable, référence `Media`, mise à NULL en cascade), `tokenVersion` (entier, défaut 1), `apiKey` (64, non sélectionné, unique partiel), `apiKeyIssuedAt`, `lastSeenAt`, `createdAt`, `updatedAt`. Index uniques sur username, email, apiKey.

### Media · table `media`
Un cliché ou une vidéo. `id` uuid, `ownerId` (référence `Account`, suppression en cascade), `role` (énumération `content` ou `avatar`, défaut `content`), `mimeType` (64), `bytes` (bigint stocké en chaîne), `width`, `height`, `durationMs` (entiers nullables), `capturedAt`, `publishedAt`, horodatages. Index `IDX_media_library` sur (ownerId, capturedAt) et index partiel `IDX_media_feed` sur les médias publiés de rôle `content`.

### Album · table `albums`
Regroupement ordonné. `id` uuid, `ownerId` (référence `Account`, cascade), `title` (60), `coverMediaId` (référence `Media`, mise à NULL), horodatages. Index unique (ownerId, title).

### Placement · table `placements`
Table de jointure ordonnée entre album et média. Clé primaire composite (`albumId`, `mediaId`), chacune référençant sa table en cascade, `position` (entier, défaut 0), `createdAt`. Index (albumId, position) et (mediaId).

### Follow · table `follows`
Relation de suivi. Clé primaire composite (`followerId`, `followingId`) vers `Account` en cascade, `createdAt`, contrainte CHECK `followerId <> followingId`, index sur followingId.

## Connexions

Deux sources de données coexistent.

- **Applicatif** · le backend se connecte par **PgBouncer** en pooling de transaction (port 6432), pool applicatif limité, `query_timeout` de 30 secondes.
- **Migrations** · le `DataSource` de la ligne de commande TypeORM vise **PostgreSQL directement** (port 5432).

## Migrations

`synchronize` est désactivé. Une migration initiale (`1784545615923-init.ts`) crée l'ensemble du schéma (énumération `media_role_enum`, cinq tables, index, clés étrangères). Les migrations se lancent depuis `src/db/data-source.ts` en développement, et depuis `dist/db/data-source.js` en production (`migration:run:prod`). En déploiement, elles sont exécutées par Ansible après démarrage de Postgres (voir [CI/CD](09-cicd.md)).

Commandes utiles.

```bash
npm run migration:run       # applique les migrations en attente
npm run migration:generate  # génère une migration à partir des entités
npm run migration:revert    # annule la dernière migration
npm run migration:show      # liste l'état des migrations
```

## Compose local

Le `docker-compose.yml` du backend fournit Postgres 18.4 (`statement_timeout` 30 s), PgBouncer `edoburu/pgbouncer:v1.24.1-p1` (pooling de transaction, port 6432) et Redis 8.8 (`maxmemory 256mb`, `allkeys-lru`, sans persistance). Ces trois services ont un healthcheck.

Pages liées · [API backend](03-backend-api.md) · [Sauvegarde et PRA](12-sauvegarde-pra.md).
