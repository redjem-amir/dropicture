# HELP — Quick deploy

Prereqs: infra provisioned (`terraform apply` + `ansible-playbook ansible/playbook.yml`).
All commands run from the repository root.

## 0. Configure (once)

```bash
cat > .env <<EOF
IMAGE_TAG=latest
POSTGRES_DB=dropicture
POSTGRES_USER=$(openssl rand -hex 12)
POSTGRES_PASSWORD=$(openssl rand -hex 12)
GARAGE_RPC_SECRET=$(openssl rand -hex 32)
S3_ACCESS_KEY_ID=GK$(openssl rand -hex 16)
S3_SECRET_ACCESS_KEY=$(openssl rand -hex 32)
S3_BUCKET=dropicture-media
EOF
```

`.env` is gitignored — never commit it.

> No Garage setup needed: on first boot, `--single-node` assigns the layout and
> `--default-bucket` creates the access key and the bucket from the
> `GARAGE_DEFAULT_*` variables wired in the compose files. The S3 values above
> are only read on the **first** start — changing them later does not update
> the existing key.

## 1. Cloud (Docker Swarm)

```bash
docker context create dropicture \
  --docker "host=ssh://root@$(terraform -chdir=terraform output -raw manager_public_ip)"

docker context use dropicture
set -a; source .env; set +a
docker stack deploy --detach=false -c docker-compose.yml dropicture
```

Check: `docker stack services dropicture`, then `curl -I https://dropicture.com`.
Update / rollback: redeploy with another `IMAGE_TAG`.

## 2. Local

```bash
docker context use default
set -a; source .env; set +a
docker compose -f docker-compose.local.yml up -d
```

Open http://localhost:3000 (API: http://localhost:3001).
Stop: `docker compose -f docker-compose.local.yml down` (`-v` wipes data).

## Troubleshooting

| Symptom | Fix |
|---|---|
| `"VAR is required"` | `set -a; source .env; set +a` |
| `permission denied (publickey)` | load the deploy key: `ssh-add` |
| `config not found: dropicture_origin_*` | re-run the Ansible playbook |
| pull denied / `No such image` | GHCR package is private after first push → set it **Public**; or tag not built |
| task stuck `Pending` | `docker service ps dropicture_<svc> --no-trunc` |
| nginx `502` | `docker service logs dropicture_dropicture-backend` |
| `failed to update config` | configs are immutable → bump `name:` (`_v2` → `_v3`) |
| Cloudflare `52x` | zone SSL mode = **Full (strict)** |
| deploys to the wrong place | `docker context ls` → `use default` (local) / `use dropicture` (cloud) |
| app S3 errors | keys/bucket are created on Garage's **first** boot only → check `docker exec $(docker ps -qf name=garage) /garage key list` and `/garage bucket list`; if the `.env` keys changed since, restore them or wipe the garage volumes to re-init |