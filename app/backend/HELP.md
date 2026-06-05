## Project setup

> The backend talks to PgBouncer (not PostgreSQL directly), DragonflyDB and
> the Garage S3 store. The full data layer comes from
> [`docker-compose.local.yml`](../../docker-compose.local.yml) at the
> repository root — see [`HELP.md`](../../HELP.md) for the one-time `.env`
> setup there.

### 1. Start the data layer

From the **repository root**:

```bash
set -a; source .env; set +a
docker compose -f docker-compose.local.yml up -d
```

This brings up PgBouncer on `localhost:5432` (the app's entry point),
PostgreSQL on `localhost:5433` (direct access for psql/IDEs), DragonflyDB on
`localhost:6379` and the Garage S3 API on `localhost:3900` — with the access
key and the media bucket auto-created on first boot.

### 2. Backend — Environment variables

Create the backend `.env` (in `app/backend/`), reusing the credentials from
the **root** `.env` so the app matches what the containers were started with:

```bash
set -a; source ../../.env; set +a

cat > .env <<EOF
# Database — through PgBouncer (transaction pooling), like production
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=${POSTGRES_DB}
POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}

# Cache / rate limiting
REDIS_HOST=localhost
REDIS_PORT=6379

# Object storage (Garage, S3-compatible)
S3_ENDPOINT=http://localhost:3900
S3_REGION=garage
S3_BUCKET=${S3_BUCKET}
S3_FORCE_PATH_STYLE=true
S3_ACCESS_KEY_ID=${S3_ACCESS_KEY_ID}
S3_SECRET_ACCESS_KEY=${S3_SECRET_ACCESS_KEY}
EOF
```

> **Notes:** this overwrites any existing `app/backend/.env` (`>` not `>>`).
> Never commit `.env` files — both are gitignored. Don't generate fresh
> random credentials here: the containers were initialised with the root
> `.env` values, and Garage only reads its key on **first** boot.

### 3. Run

```bash
npm install
npm run start:dev
```

The API listens on http://localhost:3001.

> **Pooling caveat:** PgBouncer runs in `transaction` mode, exactly like
> production. Session-level features (`LISTEN/NOTIFY`, session `SET`,
> advisory locks) won't work through `localhost:5432` — use the direct
> PostgreSQL port `5433` for those and for admin tasks.