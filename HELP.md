# HELP: quick deploy

Assumes the infra is already provisioned (`terraform -chdir=infra/terraform apply` and `ansible-playbook infra/ansible/playbook.yml`). Run everything from the repo root.

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
DEFAULT_ADMIN_EMAIL=admin@dropicture.com
DEFAULT_ADMIN_PASSWORD=$(openssl rand -hex 16)
APP_DOMAIN=dropicture.com
NEXT_PUBLIC_API_URL=https://dropicture.com
EOF
```

`.env` is gitignored, so don't commit it. Your generated admin password is in there: `grep DEFAULT_ADMIN_PASSWORD .env`. For a local run, set `NEXT_PUBLIC_API_URL=http://localhost:3001` instead (`APP_DOMAIN` is unused locally).

> `docker-compose.yml` requires `APP_DOMAIN`, `DEFAULT_ADMIN_EMAIL`, `DEFAULT_ADMIN_PASSWORD` and `NEXT_PUBLIC_API_URL`, so `docker stack deploy` aborts if they aren't set. That's why they're in the file above.

> You don't need to set Garage up by hand. On first boot, `--single-node` assigns the layout and `--default-bucket` creates the access key and bucket from the `GARAGE_DEFAULT_*` variables in the compose files. Those S3 values are only read on the first start, so changing them later won't touch the existing key.

## 1. Cloud (Docker Swarm)

```bash
docker context create dropicture \
  --docker "host=ssh://root@$(terraform -chdir=infra/terraform output -raw manager_public_ip)"

docker context use dropicture
set -a; source .env; set +a
docker stack deploy --detach=false -c docker-compose.yml dropicture
```

Check it: `docker stack services dropicture`, then `curl -I https://dropicture.com`.
To update or roll back, redeploy with a different `IMAGE_TAG`.

## 2. Local

```bash
docker context use default
set -a; source .env; set +a
docker compose -f docker-compose.local.yml up -d
```

Open http://localhost:3000 (API at http://localhost:3001).
To stop: `docker compose -f docker-compose.local.yml down` (add `-v` to wipe data).

## Troubleshooting

| Symptom | Fix |
|---|---|
| `"VAR is required"` | Run `set -a; source .env; set +a`, and check `APP_DOMAIN`, `DEFAULT_ADMIN_*` and `NEXT_PUBLIC_API_URL` are set |
| `permission denied (publickey)` | Load the deploy key with `ssh-add` |
| `config not found: dropicture_origin_*` | Re-run the Ansible playbook |
| pull denied / `No such image` | The GHCR package goes private after the first push, so set it to Public. Or the tag wasn't built |
| task stuck on `Pending` | `docker service ps dropicture_<svc> --no-trunc` |
| Traefik / proxy returns `502` | `docker service logs dropicture_dropicture-backend` |
| `failed to update config` | Configs are immutable, so bump the version suffix in `name:` (e.g. `_v1` to `_v2`) |
| Cloudflare `52x` | Set the zone SSL mode to Full (strict) |
| deploys land in the wrong place | `docker context ls`, then `use default` for local or `use dropicture` for cloud |
| app throws S3 errors | Keys and bucket are only created on Garage's first boot. Check `docker exec $(docker ps -qf name=garage) /garage key list` and `/garage bucket list`. If the `.env` keys changed since then, put the old ones back or wipe the garage volumes to re-init |