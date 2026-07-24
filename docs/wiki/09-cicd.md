# 09 · CI/CD

Huit workflows GitHub Actions, deux domaines (SaaS et Website) plus une analyse assistée par IA. Registre d'images GHCR (`ghcr.io/redjem-amir/dropicture/saas/<service>`), région AWS `eu-west-3`, Terraform `< 1.12`.

## Vue d'ensemble

| Workflow | Déclencheur | Rôle |
|---|---|---|
| `saas-deploy.yml` | manuel | pipeline complet du SaaS |
| `saas-cdn.yml` | manuel | infra CDN et sauvegardes seules |
| `saas-backup.yml` | cron toutes les 6 h + manuel | dump PostgreSQL vers S3 |
| `saas-recovery.yml` | manuel avec confirmation | restauration depuis S3 |
| `saas-destroy.yml` | manuel avec garde-fous | destruction ciblée ou totale |
| `website-deploy.yml` | push sur `main` (chemins website) + manuel | build, apply, sync S3, invalidation |
| `website-destroy.yml` | manuel avec confirmation | destruction du site |
| `ai-rightsizing.yml` | pull request sur l'infra + manuel | analyse de right-sizing et éco-conception assistée par IA |

## SaaS Deploy · le pipeline complet

Déclenché manuellement (`workflow_dispatch`), groupe de concurrency `saas-deploy` sans annulation. Enchaînement des jobs.

1. **checks** · formatage et validation Terraform, tests backend (`bun run test --ci`, Jest), analyse Trivy en système de fichiers (vulnérabilités et secrets) et en configuration (IaC), bloquante sur CRITICAL et HIGH, résultats poussés dans GitHub Code Scanning (SARIF) et archivés 90 jours.
2. **versions** · calcule un tag d'image par service, égal au SHA du dernier commit touchant `apps/saas/<service>`.
3. **terraform** · crée le bucket d'état si absent, `plan` puis `apply` conditionnel s'il y a des changements.
4. **build** · matrice frontend et backend, build et push vers GHCR (`:<SHA>` et `:latest`), avec saut si l'image du SHA existe déjà (idempotence).
5. **scan** · SBOM CycloneDX par image, scan d'image Trivy bloquant, résultats en Code Scanning.
6. **provision** · Ansible `playbook.yml`, uniquement si Terraform a produit des changements.
7. **deploy** · Ansible `deploy.yml` (déploie la stack, exécute les migrations), toujours joué, tolérant un `provision` sauté.

Secrets référencés · clés AWS, `TF_VAR_HCLOUD_TOKEN`, `TF_VAR_SSH_PUBLIC_KEY_B64`, `CLOUDFLARE_API_TOKEN`, `SSH_PRIVATE_KEY_B64`, `GHCR_TOKEN`, identifiants PostgreSQL, `GRAFANA_ADMIN_PASSWORD`, `NEXT_PUBLIC_API_URL`.

## SaaS Cdn · périmètre isolé

Ne touche que le CDN et les buckets de sauvegarde. Refuse de s'exécuter hors de `main`. Le `plan` est ciblé (`-target`) sur les ressources CDN et de sauvegarde, et un garde-fou analyse le plan (`terraform show -json`) pour échouer s'il touche une ressource Hetzner ou détruit un bucket ou une distribution critique. Hetzner est explicitement hors périmètre.

## SaaS Backup et Recovery

- **Backup** · cron toutes les 6 heures plus déclenchement manuel. Ansible `backup.yml` réalise un `pg_dump` compressé dans le conteneur, l'envoie sous `daily/` avec somme de contrôle, garde trois dumps locaux et promeut le premier dump du mois sous `monthly/`.
- **Recovery** · manuel, exige la saisie `RESTORE`, choix du préfixe (`daily/` ou `monthly/`) et d'une clé S3 précise (vide pour le dernier dump), option de descendre le backend à zéro réplica pendant l'opération. Ansible `restore.yml` réalise un dump de sécurité avant écrasement puis restaure en transaction unique.

Les deux workflows **partagent le groupe de concurrency `saas-backup`** sans annulation, ce qui garantit qu'une sauvegarde et une restauration ne se chevauchent jamais.

## Destruction

- **saas-destroy** · impose `main` et une chaîne de confirmation exacte, avec deux portées. `hetzner-only` détruit uniquement les nœuds Hetzner via un plan ciblé et vérifie que le CDN a survécu. `everything` détruit tout (le bucket d'état, la clé KMS et l'utilisateur IAM sont conservés), avec option de vider le bucket CDN. Un job final révoque les certificats Origin CA Cloudflare.
- **website-destroy** · confirmation `destroy`, vide et détruit le site, option de supprimer aussi le bucket d'état.

## Website Deploy · GitOps

Déclenché par tout push sur `main` touchant `apps/website/**` ou `infra/website/**` (les pull requests n'exécutent que validation et build). Jobs · validate, build (contrôle des URL publiques, `bun run build`, vérification de l'export), bootstrap du bucket d'état, plan, apply conditionnel, puis deploy. Le deploy résout la distribution par son alias, **synchronise S3 en trois passes de cache-control** (assets immuables un an, autres une heure, HTML sans cache) avec suppression des fichiers obsolètes, puis **invalide CloudFront** sur `/*`. Aucun scan de sécurité sur ce pipeline.

## AI Rightsizing · optimisation assistée par IA

Déclenché sur les pull requests touchant la stack Swarm, les règles d'énergie ou le dimensionnement des nœuds, et à la demande. Le job extrait les réservations, limites et règles green IT, les soumet à un modèle Claude et publie des recommandations de right-sizing et d'éco-conception dans le résumé de run et en commentaire de pull request. Le job est **gardé**, il ne s'exécute que si le secret `ANTHROPIC_API_KEY` est présent, sans jamais bloquer un dépôt qui ne l'a pas configuré. Il répond au critère BC4C « l'IA est utilisée pour optimiser les ressources ».

## Synthèse

Le SaaS se livre manuellement, la traçabilité venant du SHA par service, sans rollback automatique (revenir en arrière consiste à relancer le déploiement sur un ancien commit, voir [Runbooks](13-exploitation-runbooks.md)). Le site se livre en continu à chaque push. Tous les workflows destructifs exigent la branche `main`, une confirmation exacte et un plan de destruction prévisualisé.

Pages liées · [Stratégie DevOps](06-strategie-devops.md) · [Sécurité et conformité](11-securite-conformite.md) · [Sauvegarde et PRA](12-sauvegarde-pra.md).
