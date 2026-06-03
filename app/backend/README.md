## Project setup

> This section describes the initial project setup: configuring the PostgreSQL credentials and synchronizing the environment variables.

### Backend — Environment variables

Create the backend `.env` file with randomly generated PostgreSQL credentials:

```bash
cat >> .env <<EOF
POSTGRES_DB=db-app
POSTGRES_HOST=localhost
POSTGRES_USER=$(openssl rand -hex 12)
POSTGRES_PASSWORD=$(openssl rand -hex 12)
REDIS_HOST=localhost
EOF
```

> **Note:** Run this once to avoid duplicate entries. Never commit `.env` — add it to `.gitignore`.