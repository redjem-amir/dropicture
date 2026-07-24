# 12 · Sauvegarde et plan de reprise

Principe directeur, sauvegarder ce qu'on ne sait pas recréer, et savoir recréer le reste. Le plan de reprise d'activité complet est en Annexe U.

## Ce qui se sauvegarde et ce qui se reconstruit

| Actif | Stratégie |
|---|---|
| Base PostgreSQL | dumps chiffrés sur S3, quotidiens et mensuels |
| Médias S3 | versioning du bucket, région européenne |
| Infrastructure | reconstructible par Terraform et Ansible |
| Configuration | dans le code (IaC, gabarits Ansible) |
| Secrets | hors dépôt, dans les GitHub Secrets |

Les nœuds de calcul sont considérés comme jetables. Aucune donnée ne vit uniquement sur un nœud.

## Sauvegardes

Le workflow `saas-backup.yml` s'exécute toutes les 6 heures (et à la demande). Ansible `backup.yml` réalise un `pg_dump` au format custom compressé dans le conteneur, l'envoie sous `daily/` avec une somme de contrôle SHA256 et une vérification de taille, conserve trois dumps locaux et promeut le premier dump du mois sous `monthly/`.

Cycle de vie S3 (défini en Terraform).

- `daily/` · classe archive à 30 jours, expiration à 35 jours.
- `monthly/` · Glacier, expiration à un an.

## Restauration

Le workflow `saas-recovery.yml` est manuel et protégé. Il exige la saisie `RESTORE`, le choix du préfixe et éventuellement d'une clé S3 précise, et propose de descendre le backend à zéro réplica pendant l'opération. Ansible `restore.yml` vérifie la somme de contrôle, réalise un **dump de sécurité avant écrasement**, puis restaure en transaction unique (`pg_restore --single-transaction --exit-on-error`) et remet le backend en service.

Sauvegarde et restauration partagent le même verrou de concurrency, elles ne peuvent donc jamais se chevaucher.

## Reprise d'activité

Objectifs indicatifs (détaillés en Annexe U).

- **Perte d'un nœud de calcul** · le Swarm reprogramme les services, reprovisionner le nœud par Terraform et Ansible.
- **Perte de la base** · restaurer le dernier dump par `saas-recovery`, perte au pire égale à l'intervalle de sauvegarde.
- **Perte totale de la région Hetzner** · reconstruction complète par `terraform apply` puis `ansible playbook.yml` et `deploy.yml`, restauration du dump. Le CDN médias et les sauvegardes vivent chez AWS, hors du périmètre Hetzner.

## Répétition

La reprise n'a de valeur que si elle est éprouvée. Une restauration de test peut être lancée sur un environnement dédié via `saas-recovery` en pointant une clé précise. La [checklist d'exploitation](13-exploitation-runbooks.md) décrit le déroulé.

Pages liées · [CI/CD](09-cicd.md) · [Runbooks](13-exploitation-runbooks.md).
