# 03 · API backend

API REST du produit. NestJS 11 sur runtime Bun, PostgreSQL via TypeORM, Redis pour les sessions et le cache, stockage objet S3 servi par CloudFront.

## Pile technique

| Élément | Version | Rôle |
|---|---|---|
| NestJS (`common`, `core`, `platform-express`) | ^11.0.1 | framework |
| Runtime | Bun 1.3.14 (image `oven/bun:1.3.14-alpine`) | exécution |
| TypeORM | via lockfile | ORM PostgreSQL |
| `pg` | ^8.22 | pilote PostgreSQL |
| `ioredis` + `@nest-lab/throttler-storage-redis` | ^5.11 | Redis, stockage du throttling |
| `@node-rs/argon2` | ^2.0 | hachage des mots de passe (Argon2id) |
| `@nestjs/throttler` | ^6.5 | limitation de débit |
| `@nestjs/swagger` | ^11.2 | contrat OpenAPI |
| AWS SDK v3 | ^3.10x | S3, CloudFront, SSM |
| `helmet`, `class-validator`, `cookie-parser` | · | sécurité, validation, cookies |

Le port d'écoute est **3002**. La documentation Swagger est servie sur `/api/docs` (JSON sur `/api/docs-json`).

## Organisation du code

Un seul module racine (`AppModule`), pas de sous-modules par fonctionnalité.

```
src/
├── main.ts                  bootstrap (helmet, CORS, ValidationPipe, Swagger, /health)
├── app.module.ts            module racine, guards globaux
├── controllers/             auth, settings, profile, library, discover, public
├── services/                auth.service, redis.service, media.service
├── guards/                  stratégies Passport (access.strategy, api-key.strategy)
├── models/                  entités TypeORM (account, media, album, placement, follow)
├── middleware/              access-log.middleware (journal HTTP JSON)
├── db/                      data-source + migrations
└── specs/                   tests Jest
```

## Points d'accès

Sonde hors routeur · `GET /health` retourne `{ status: 'ok' }`, en amont des guards et du throttling, exclue des journaux d'accès.

### `/api/auth`
`GET /me`, `GET /username/:username`, `POST /resolve`, `POST /signin`, `POST /signup`, `POST /session` (rotation), `POST /signout`.

### `/api/settings` (session requise)
`GET /`, `PATCH /me`, `PATCH /username`, `PATCH /email`, `PATCH /password`, `GET /apikey`, `POST /apikey` (régénérer), `DELETE /apikey`, `DELETE /account`.

### `/api/profile` (session requise)
`GET /`, `PATCH /` (bio), `GET /media`, `PATCH /media/unpublish`, `POST /avatar`, `DELETE /avatar`.

### `/api/library` (session requise)
`POST /uploads` (flux), `GET /summary`, `GET /`, `POST /download`, `PATCH /publish`, `PATCH /unpublish`, `DELETE /media`, `GET /albums`, `POST /albums`, `PATCH /albums/:albumId`, `POST /albums/:albumId/media`, `DELETE /albums/:albumId/media`, `PATCH /albums/:albumId/cover/:mediaId`, `DELETE /albums/:albumId`.

### `/api/discover` (session requise)
`GET /feed` (portée `following` optionnelle), `GET /me`, `POST /follows/:username`, `DELETE /follows/:username`.

### `/api/public` (sans authentification)
`GET /stats`, `GET /search`, `GET /profiles`, `GET /feed`, `GET /:username`, `GET /:username/media`.

Le contrat complet OpenAPI 3.0.3 est décrit en Annexe Q.

## Authentification et sécurité

- **Sessions Redis.** Cookie opaque `session` au format `sid.nonce`. L'enregistrement JSON est stocké sous `session:{sid}`. Durée glissante d'inactivité 30 minutes, durée absolue 8 heures, jeton d'accès logique 5 minutes. L'écriture glissante est throttlée à 30 secondes.
- **Rotation et anti-rejeu.** `rotateSession` sous verrou Redis (`lock:rotate:{sid}`), fenêtre de grâce 30 secondes. La réutilisation d'un nonce hors grâce déclenche `revokeAllTokens`, qui incrémente `tokenVersion` et invalide toutes les sessions du compte.
- **Cookies.** `httpOnly`, `secure` en production, `sameSite=lax`, `path=/`.
- **Mots de passe.** Argon2id (`@node-rs/argon2`), `memoryCost 19456`, `timeCost 2`, `parallelism 1`. Comparaison à un hash factice pour ne pas révéler l'existence d'un email par le temps de réponse.
- **Clé d'API.** 24 octets base64url, présentée par l'en-tête `x-api-key` ou la query `?appid=`. Stratégie Passport `api-key` déclarée (son branchement sur les routes est un point ouvert, voir [Amélioration continue](14-amelioration-continue.md)).
- **Limitation de débit.** `ThrottlerGuard` global, stockage Redis, défaut 60 requêtes par 60 secondes, ajusté par route (signin 10 par minute, signup 5 par heure, feed 240 par minute).
- **Durcissement HTTP.** Helmet (HSTS 2 ans preload, CORP cross-origin), CORS restreint aux origines connues avec `credentials`, `ValidationPipe` global (`whitelist`, `forbidNonWhitelisted`, `transform`), `trust proxy` derrière Traefik, corps JSON limité à 100 ko (l'upload contourne le bodyParser en flux brut).
- **Convention d'erreurs.** Corps `{ code: string }` (par exemple `FILE_TOO_LARGE`, `AVATAR_NOT_ALLOWED`, `BAD_CURSOR`).

## Stockage des médias

`media.service.ts` charge sa configuration depuis AWS SSM au démarrage (bucket, domaine, identifiant de distribution, sous `CDN_SSM_PREFIX`).

- **Upload en flux** via `@aws-sdk/lib-storage` (multipart, parts de 5 Mo). Le flux entrant traverse un `Transform` qui compte les octets et coupe au-delà de la limite.
- **Clé objet** `media/{ownerId}/{id}.{ext}`, `CacheControl: public, max-age=31536000, immutable`.
- **Limites** image 8 Mo, avatar 8 Mo, vidéo 100 Mo. Types acceptés jpeg, png, webp, avif, heic pour l'image, mp4, quicktime, webm pour la vidéo.
- **Suppression** par lots de 1000 objets, suivie d'une invalidation CloudFront best-effort.
- **URL publique** `{domain}/media/{ownerId}/{id}.{ext}` servie par CloudFront (non signée dans l'état actuel).

## Pagination

Curseur opaque, encodage base64url de `{ISO}|{id}`, décodé dans library, profile, discover et public. Cursor invalide, code `BAD_CURSOR`.

## Conteneur

`Dockerfile` multi-étapes sur `oven/bun:1.3.14-alpine`, utilisateur non-root, `EXPOSE 3002`, `CMD ["bun","run","dist/main"]`. Le `docker-compose.yml` du dossier backend fournit les dépendances locales (Postgres 18.4, PgBouncer, Redis 8.8) mais pas le backend lui-même. Il n'y a pas de `HEALTHCHECK` dans le Dockerfile, la sonde `/health` est utilisée par le compose Swarm de production.

## Tests

Jest (ts-jest), configuration inline, `maxWorkers: 1`. Huit fichiers dans `src/specs/` couvrant le service d'authentification, la bibliothèque, les contrôleurs, les réglages, le profil, le public, la découverte et le throttling (de l'ordre de deux cents cas). Voir [CI/CD](09-cicd.md) pour leur exécution en intégration continue.

Pages liées · [Base de données](05-base-de-donnees.md) · [Sécurité et conformité](11-securite-conformite.md).
