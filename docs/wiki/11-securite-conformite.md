# 11 · Sécurité et conformité

La sécurité est traitée à chaque couche, de la périphérie au code. La cartographie complète des mesures face à ISO/IEC 27001:2022 et au RGPD est en Annexe R, la chaîne DevSecOps en Annexe S.

## Sécurité applicative

- **Sessions opaques** adossées à Redis, glissantes 30 minutes, absolues 8 heures, avec rotation et détection de rejeu (réutilisation d'un nonce hors fenêtre de grâce, révocation globale par incrément de `tokenVersion`).
- **Mots de passe** hachés en Argon2id, comparaison à un hash factice pour ne pas trahir l'existence d'un compte par le temps de réponse.
- **Limitation de débit** globale et par route, stockée dans Redis.
- **Validation stricte** des entrées (`whitelist`, `forbidNonWhitelisted`, `transform`).
- **En-têtes** durcis par Helmet (HSTS 2 ans preload, CORP cross-origin), CORS restreint aux origines connues.
- **Clé d'API** personnelle, régénérable et révocable, pour l'accès programmatique à sa propre bibliothèque.
- **Privé par défaut** sur le stockage. Le bucket des médias bloque tout accès public, seule la distribution CloudFront lit les objets.

## Sécurité de l'infrastructure

- **Périphérie** · Cloudflare (pare-feu applicatif, anti-DDoS, TLS strict). Le pare-feu Hetzner n'ouvre 80 et 443 qu'aux plages Cloudflare.
- **Accès aux nœuds** · SSH durci (mot de passe désactivé, root sans mot de passe, tentatives limitées), clé fournie en base64 par un secret.
- **Socket Docker** · jamais monté directement dans Traefik, médié par un socket-proxy en lecture filtrée.
- **PKI** · certificat Origin CA Cloudflare généré par Ansible, clé privée stockée en secret Swarm.
- **Réseaux internes** · les bases et l'observabilité vivent sur des réseaux overlay internes, non exposés.
- **WAFv2 AWS** sur les deux distributions CloudFront (limitation par IP, réputation IP, règles communes).

## DevSecOps · analyse Trivy

Le pipeline SaaS embarque une analyse **bloquante** (CRITICAL et HIGH) avant tout déploiement.

- Système de fichiers · vulnérabilités des dépendances et détection de secrets.
- Configuration · analyse de l'IaC.
- Image · scan de chaque image construite.
- **SBOM CycloneDX** produit par image.

Les résultats sont poussés au format SARIF dans GitHub Code Scanning et archivés 90 jours. Le fichier `.trivyignore` du dépôt impose que toute exception porte un identifiant, une justification et une date de revue. Le site vitrine, statique, n'a pas de scan.

## Conformité RGPD

- **Minimisation** · aucune donnée superflue collectée.
- **Droits** · rectification par les réglages, effacement du compte (`DELETE /api/settings/account`) qui supprime les objets et invalide le cache, portabilité par l'export de la bibliothèque.
- **Localisation** · calcul et données en Europe (Hetzner Falkenstein, AWS `eu-west-3`).
- **Traçabilité** · journal d'accès structuré, décisions d'architecture consignées (Annexe J).

Le flux des données à caractère personnel est décrit en Annexe F.3, le registre simplifié des traitements dans le mémoire.

## Points ouverts de sécurité

Recensés dans [Amélioration continue](14-amelioration-continue.md) · stratégie `api-key` non branchée sur un guard, middleware de garde côté frontend non câblé, receiver Alertmanager vide, `.env` racine versionné avec des secrets.

Pages liées · [API backend](03-backend-api.md) · [Infrastructure](07-infrastructure.md) · [Sauvegarde et PRA](12-sauvegarde-pra.md).
