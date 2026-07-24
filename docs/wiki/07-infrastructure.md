# 07 · Infrastructure

Deux stacks Terraform indépendantes (`infra/saas`, `infra/website`) et un jeu de playbooks Ansible pour le SaaS. Les `required_providers` sont déclarés en tête de chaque `main.tf` (pas de `versions.tf`).

## Terraform · SaaS

`infra/saas/terraform`. Providers `hetznercloud/hcloud ~> 1.45`, `cloudflare/cloudflare ~> 5`, `hashicorp/http ~> 3.4` (récupère les plages d'adresses Cloudflare), `hashicorp/aws ~> 6.0` (région `eu-west-3` plus un alias `us-east-1` pour ACM et WAF de CloudFront). État distant sur S3 (`dropicture-tfstate-prod`, chiffré, verrouillé).

### Calcul et réseau (Hetzner)

Quatre nœuds Ubuntu 24.04 à Falkenstein (`fsn1`), sur un réseau privé `10.0.0.0/16`.

| Nœud | Type | Ressources | Rôle Swarm | IP privée |
|---|---|---|---|---|
| proxy | cpx32 | 4 vCPU / 8 Go | manager | 10.0.0.10 |
| db | cpx32 | 4 vCPU / 8 Go | worker | 10.0.0.20 |
| backend | cpx12 | 2 vCPU / 2 Go | worker (scalable) | 10.0.0.30 |
| frontend | cpx12 | 2 vCPU / 2 Go | worker (scalable) | 10.0.0.40 |

Les contraintes sont validées dans `variables.tf` (proxy et db forcés à un seul réplica, seuls backend et frontend peuvent monter en charge, adresses privées consécutives). Le pare-feu Hetzner ouvre SSH et ICMP à tous, mais **restreint 80 et 443 aux plages Cloudflare** récupérées dynamiquement.

### Périphérie (Cloudflare)

Zone `dropicture.com`. Enregistrements A `app` et `grafana` vers le proxy en mode proxied, CNAME `cdn` vers CloudFront en DNS-only. Réglages de zone SSL strict, redirection HTTPS forcée, TLS minimum 1.2.

### CDN médias (AWS)

Bucket `dropicture-cdn-prod` (accès public bloqué, chiffrement AES256, versioning, cycle de vie), certificat ACM sur `cdn.dropicture.com`, distribution CloudFront avec Origin Access Control, HTTP/2 et 3, et un WAFv2 (limitation par IP, réputation IP, règles communes). Le domaine, le bucket, la région et l'identifiant de distribution sont publiés dans SSM sous `/dropicture/cloudfront`, où le backend les lit.

### Sauvegardes (AWS)

Bucket `dropicture-db-backups-prod` (chiffrement, versioning, Object Lock optionnel), cycle de vie à préfixes `daily/` (classe archive à 30 jours, expiration 35 jours) et `monthly/` (Glacier, expiration un an). Paramètres sous SSM `/dropicture/backup`.

## Terraform · Website

`infra/website/terraform`. Providers `aws ~> 5.0` et `cloudflare ~> 5.0`, état S3 partiel (configuré par la ligne de commande en intégration). Site statique sur bucket `dropicture-website-prod` (accès public bloqué, OAC), une fonction CloudFront réécrit les URI vers `index.html`, WAFv2 (limitation, réputation IP), ACM multi-domaines `dropicture.com` et `www`, DNS Cloudflare en DNS-only, et un **budget mensuel AWS de 20 USD** alertant par courriel aux seuils 50, 80 et 100 %.

| | SaaS | Website |
|---|---|---|
| Calcul | Hetzner (Docker Swarm) | aucun, 100 % AWS |
| Cloudflare | proxied | DNS-only |
| État Terraform | S3 codé en dur | S3 configuré en ligne de commande |
| Objet | application dynamique + CDN médias | vitrine statique |

## Ansible · SaaS

`infra/saas/ansible`. Pas de dossier `roles/`, pas d'inventaire statique, pas de `group_vars`, pas d'ansible-vault. L'inventaire est **entièrement dynamique** · chaque playbook télécharge l'état Terraform depuis S3 et construit l'inventaire en mémoire (`add_host`) à partir des sorties. Le nœud dont la clé commence par `proxy-` devient manager Swarm, les autres deviennent workers.

Playbooks.

- `playbook.yml` · provisionnement complet.
- `deploy.yml` · déploiement de la stack et migrations.
- `backup.yml` · dump PostgreSQL vers S3.
- `restore.yml` · restauration depuis S3.
- `requirements.yml` · collections requises (`community.docker`, `amazon.aws`, `community.general`, `ansible.posix`, `community.crypto`).

### Ce que fait `playbook.yml`

1. Découverte des nœuds depuis l'état S3, attente SSH, configuration du réseau privé.
2. **Durcissement** SSH (mot de passe désactivé, root sans mot de passe, `MaxAuthTries 3`) et installation de Docker CE, rotation des journaux, modules noyau et sysctls.
3. Création des répertoires de données `/opt/dropicture/data/*` avec les UID et GID propres à chaque service.
4. **Initialisation du Swarm** sur le manager (annonce sur IP privée, pool `10.100.0.0/16`), jonction des workers avec gestion des états incomplets.
5. **Réconciliation** de la composition du cluster (retrait des nœuds détruits côté Terraform, avec garde de sécurité).
6. **Étiquetage** `dropicture.role` par nœud.
7. **PKI et TLS** · génération d'une clé et d'une CSR, demande d'un certificat **Origin CA Cloudflare** (validité 15 ans), stockage en `docker config` et `docker secret`, et génération de la configuration dynamique Traefik.

### Ce que fait `deploy.yml`

Dérive le nombre de réplicas depuis l'état Terraform, vérifie que les objets Swarm attendus existent, s'authentifie sur GHCR, rend les configurations d'observabilité (avec un hash de contenu dans leur nom pour forcer la rotation), déploie la stack par `docker stack deploy` (nom `dropicture`, `resolve_image: always`), attend PostgreSQL, puis exécute les **migrations TypeORM** (`bunx typeorm migration:run`).

## Secrets

Aucun secret dans le dépôt (hors le `.env` racine, voir [Amélioration continue](14-amelioration-continue.md)). Tout transite par variables d'environnement, fournies par les GitHub Secrets et vérifiées en début de playbook · clés AWS, `SSH_PRIVATE_KEY_B64`, identifiants PostgreSQL, `GRAFANA_ADMIN_PASSWORD`, `GHCR_TOKEN`, `CLOUDFLARE_API_TOKEN`, tags d'images. La clé SSH privée est matérialisée dans un fichier temporaire à droits restreints, supprimé en fin d'exécution.

Pages liées · [Conteneurisation Swarm](08-conteneurisation-swarm.md) · [CI/CD](09-cicd.md) · [Sauvegarde et PRA](12-sauvegarde-pra.md).
