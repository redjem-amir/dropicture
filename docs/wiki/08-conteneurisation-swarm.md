# 08 · Conteneurisation et Swarm

La stack applicative tourne en Docker Swarm sur les quatre nœuds Hetzner. Le fichier de stack est un gabarit Ansible (`templates/docker-compose.yml.j2`) rendu et déployé par `deploy.yml`.

## Services

Quatorze services, placés par étiquette de nœud (`dropicture.role`) ou par rôle Swarm.

| Service | Image | Placement | Réplicas |
|---|---|---|---|
| proxy (Traefik) | `traefik:v3.7.4` | role proxy | 1 |
| socket-proxy | `tecnativa/docker-socket-proxy:v0.4.2` | manager | 1 |
| frontend | GHCR frontend | role frontend | variable |
| backend | GHCR backend | role backend | variable |
| pgbouncer | `edoburu/pgbouncer:v1.24.1-p1` | role db | 1 |
| postgres | `postgres:18.4` | role db | 1 |
| redis-cache | `redis:8.8.0-alpine` | role proxy | 1 |
| prometheus | `prom/prometheus:v3.13.1` | role proxy | 1 |
| alertmanager | `prom/alertmanager:v0.28.1` | role proxy | 1 |
| loki | `grafana/loki:3.7.3` | role proxy | 1 |
| grafana | `grafana/grafana:13.1.0` | role proxy | 1 |
| node-exporter | `prom/node-exporter:v1.12.0` | global | par nœud |
| cadvisor | `ghcr.io/google/cadvisor:v0.60.5` | global | par nœud |
| alloy | `grafana/alloy:v1.16.3` | global | par nœud |

Le nombre de réplicas frontend et backend est dérivé de l'état Terraform au déploiement.

## Réseaux

Cinq réseaux overlay, tous en MTU 1400 pour absorber l'encapsulation du réseau privé Hetzner.

- `frontend` · exposition du frontend derrière Traefik.
- `backend` · interne et attachable, backend et bases.
- `socket` · interne, accès filtré au socket Docker.
- `egress` · sortie contrôlée.
- `monitoring` · pile d'observabilité.

## Routage Traefik

Traefik parle au Swarm par le socket-proxy (`tcp://socket-proxy:2375`) plutôt que par le socket Docker direct, ce qui réduit la surface d'attaque. `exposedByDefault=false`, redirection 80 vers 443, TLS assuré par le certificat Origin Cloudflare. Les en-têtes de confiance sont limités aux plages Cloudflare.

Routeurs.

- `app.dropicture.com` vers le frontend (priorité basse) et vers le backend sur le préfixe `/api` (priorité haute).
- `grafana.dropicture.com` vers Grafana.
- Métriques Prometheus exposées sur l'entrypoint `:8082`.

## Sondes, ressources, données

- **Sondes de vie** définies sur presque tous les services (ping Traefik, requête HTTP, `pg_isready`, `redis-cli ping`).
- **Ressources** · chaque service déclare réservations et limites CPU et mémoire. PostgreSQL est le plus lourd (réservation 1 CPU et 2 Go, limite 3,4 CPU et 6 Go), avec un tuning dédié et un tmpfs de 512 Mo sur `/dev/shm`.
- **Configs et secrets Swarm** · le certificat d'origine et la configuration dynamique Traefik sont créés par `playbook.yml`, les configurations d'observabilité portent un hash de leur contenu dans leur nom, ce qui force une rotation propre à chaque changement.

## Idempotence et rotation

Les objets `docker config` sont immuables. Le déploiement calcule un hash de chaque configuration et l'intègre au nom de l'objet. Un changement de contenu crée un nouvel objet et met à jour le service, sans jamais tenter de modifier un objet en cours d'usage.

Pages liées · [Infrastructure](07-infrastructure.md) · [Observabilité](10-observabilite.md) · [Runbooks](13-exploitation-runbooks.md).
