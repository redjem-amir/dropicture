# 14 · Amélioration continue

Un plan d'amélioration n'a de valeur que s'il nomme honnêtement ce qui n'est pas fini. Cette page recense les écarts connus, relevés directement dans le code, puis la feuille de route. Elle répond à l'attendu « plan d'amélioration continue » du bloc BC4C.

## Écarts et dette technique constatés

| # | Constat | Emplacement | Priorité |
|---|---|---|---|
| 1 | Aucun `.env.example` publié pour documenter les variables attendues. Le `.env` réel est exclu du dépôt par `.gitignore` et n'a jamais été commité, vérifié par `git log --all -- .env` | racine et chaque app | basse |
| 2 | La stratégie Passport `api-key` est déclarée dans `AppModule` et exposée comme schéma de sécurité OpenAPI, mais aucune route ne l'active par `AuthGuard('api-key')` | `apps/saas/backend/src/guards/api-key.strategy.ts` | haute |
| 3 | Le middleware de garde du frontend n'est pas câblé (export `proxy` au lieu de `middleware`, pas de `middleware.ts`) | `apps/saas/frontend/src/proxy.ts` | haute |
| 4 | ~~Receiver Alertmanager vide~~ **Corrigé**, deux canaux configurés, courriel en SMTP authentifié et webhook Slack. Restent à créer et à monter les secrets `dropicture_alertmanager_smtp_password` et `dropicture_alertmanager_slack_webhook` | `infra/saas/ansible/files/alertmanager.yml` | corrigé |
| 5 | Double lockfile par application (npm et bun) avec des outils d'installation divergents (Taskfile en npm, Docker et lint-staged en bun) | chaque app | moyenne |
| 6 | Incohérence de port de l'API, `:3001` dans le `.env` racine contre `:3002` ailleurs | `/.env` | moyenne |
| 7 | `NEXT_PUBLIC_WEBSITE_URL` utilisée par la barre de navigation mais absente du `.env` du frontend | `apps/saas/frontend` | basse |
| 8 | Répertoire de données `redis-queue` provisionné et `REDIS_QUEUE_HOST` déclarée, mais aucun service ni usage | Ansible, backend | basse |
| 9 | Dépendances présentes mais inexploitées (`bullmq`, `multer`, signeurs S3 et CloudFront) | `apps/saas/backend/package.json` | basse |
| 10 | Pas de `HEALTHCHECK` dans le Dockerfile du backend (la sonde `/health` existe et sert au compose Swarm) | `apps/saas/backend/Dockerfile` | basse |
| 11 | Aucun `CONTRIBUTING.md` ni `LICENSE` à la racine | racine | basse |
| 12 | Aucune version de runtime épinglée (`engines`, `.nvmrc`, `packageManager` absents) | racine | basse |

## Feuille de route DevOps

Alignée sur les critères BC4C et les fonctionnalités en attente au tableau de suivi (Annexe T).

**Fait lors de la revue de complétude RNCP.**
- Alertmanager doté de deux canaux, courriel en SMTP authentifié et webhook Slack, alerting rendu actionnable (restent à fournir les deux secrets).
- Outil d'IA introduit dans la chaîne, workflow `ai-rightsizing.yml` d'analyse de right-sizing assistée par IA.
- Note de cadrage et étude d'opportunité formalisées, maquettes F.1 produites et alignées au code.
- Backend documenté en JSDoc, 46 routes sur 46 et toutes les fonctions publiques des services, 228 blocs pour 1 806 lignes de commentaire sur 4 776.

**Court terme.**
- Publier un `.env.example` par application pour documenter les variables attendues sans exposer de valeur.
- Créer et monter les secrets Docker `dropicture_alertmanager_smtp_password` et `dropicture_alertmanager_slack_webhook` pour activer l'envoi d'alertes.
- Câbler ou retirer le middleware de garde du frontend, et le guard de clé d'API du backend.
- Unifier le gestionnaire de paquets sur un seul outil.

**Moyen terme.**
- Étendre l'usage de l'IA (prédiction d'incident, aide au code) au-delà du right-sizing.
- Automatiser un retour arrière applicatif (redéploiement de l'image N-1 sur échec du `deploy`).
- Étendre l'analyse de sécurité au pipeline du site vitrine.

**Produit (backlog).**
- Étiquetage automatique des photos par IA.
- Recherche sémantique dans la bibliothèque.
- Application mobile.
- Upload vidéo et transcodage, partage d'album par lien privé, fil social (commentaires et réactions).

## Méthode

Le suivi s'appuie sur un tableau Trello à cinq colonnes (Backlog, Ready, In progress, In review, Done), avec une limite de travail en cours de quatre, le journal des décisions d'architecture (Annexe J) pour les choix structurants, et le registre des risques (Annexe O) pour la provision d'aléas.

Pages liées · [Stratégie DevOps](06-strategie-devops.md) · [Sécurité et conformité](11-securite-conformite.md).
