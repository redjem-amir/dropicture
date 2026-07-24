# 01 · Démarrage rapide

Pour lancer l'ensemble en local et retrouver ses marques en quelques minutes.

## Prérequis

| Outil | Rôle | Note |
|---|---|---|
| [Task](https://taskfile.dev) | lanceur de commandes du projet (`Taskfile.yml`) | interface principale |
| Docker + Docker Compose | Postgres, PgBouncer, Redis en local | requis par le backend |
| Node.js 24 | exécution des applications en développement | les tâches utilisent `npm` |
| Bun 1.3.14 | runtime de production (images Docker) | facultatif en local |

Aucune version n'est épinglée par un fichier (`packageManager`, `engines`, `.nvmrc` absents). Chaque application porte à la fois un `package-lock.json` et un `bun.lock`. Les tâches locales installent avec `npm`, tandis que les images Docker et le hook de commit utilisent `bun` (voir [Amélioration continue](14-amelioration-continue.md)).

## Ports et services locaux

| Application | Port | Adresse |
|---|---|---|
| Site vitrine (`apps/website`) | 3000 | http://localhost:3000 |
| Frontend authentifié (`apps/saas/frontend`) | 3001 | http://localhost:3001 |
| API backend (`apps/saas/backend`) | 3002 | http://localhost:3002 |
| Documentation API (Swagger) | 3002 | http://localhost:3002/api/docs |
| Sonde de vie | 3002 | http://localhost:3002/health |

## Commandes

Tout passe par `Taskfile.yml`.

```bash
task saas       # backend NestJS + frontend Next.js (setup complet)
task backend    # backend seul (démarre Postgres/PgBouncer/Redis via docker compose, migrations, dev)
task frontend   # frontend authentifié seul
task website    # site vitrine seul
```

Détail de ce que fait chaque tâche.

- `task backend` génère `apps/saas/backend/.env` s'il manque (mots de passe via `openssl rand -hex 12`), lance `docker compose up -d --wait` (Postgres, PgBouncer, Redis), puis `npm install`, `npm run migration:run` et `npm run start:dev`.
- `task frontend` et `task website` créent leur `.env` s'il manque, puis `npm install` et `npm run dev`.
- `task saas` enchaîne backend et frontend.

## Variables d'environnement

Chaque application lit son propre `.env`. Les noms attendus, sans valeurs.

**Backend** (`apps/saas/backend/.env`)

| Variable | Rôle |
|---|---|
| `POSTGRES_DB / HOST / PORT / USER / PASSWORD _DROPICTURE_SAAS` | accès PostgreSQL |
| `PGBOUNCER_HOST / PORT _DROPICTURE_SAAS` | connexion applicative via PgBouncer (port 6432) |
| `REDIS_CACHE_HOST_DROPICTURE_SAAS` | Redis (sessions, cache, throttling) |
| `AWS_REGION` | région AWS (défaut `eu-west-3`) |
| `AWS_ACCESS_KEY_ID / SECRET_ACCESS_KEY` | accès S3 et CloudFront |
| `CDN_SSM_PREFIX` | préfixe SSM d'où le backend lit la configuration CDN (défaut `/dropicture/cloudfront`) |
| `NODE_ENV` | bascule des cookies sécurisés et des origines CORS |

**Frontend authentifié** (`apps/saas/frontend/.env`) · `NEXT_PUBLIC_API_URL` (dev `http://localhost:3002`).

**Site vitrine** (`apps/website/.env`) · `NEXT_PUBLIC_SAAS_BACKEND_URL` et `NEXT_PUBLIC_SAAS_FRONTEND_URL`.

> Attention, le `.env` à la racine du dépôt contient des secrets et une valeur `NEXT_PUBLIC_API_URL` pointant sur le port 3001 (destinée à un usage docker-compose), différente de celle du frontend (3002). Ces points sont recensés dans [Amélioration continue](14-amelioration-continue.md).

## Qualité avant commit

Un hook `pre-commit` (Husky) lance `lint-staged`, qui applique `terraform fmt` aux fichiers `*.tf` et `*.tfvars`. Chaque application possède en plus son propre `eslint` et son `prettier`, exécutés dans ses propres scripts.

## Étapes suivantes

- Comprendre l'ensemble · [Architecture](02-architecture.md)
- Contribuer au backend · [API backend](03-backend-api.md)
- Contribuer au front · [Frontends](04-frontends.md)
