# 15 · Glossaire

Termes et acronymes employés dans ce wiki, par ordre alphabétique.

- **Alloy** · agent Grafana qui collecte les journaux des conteneurs et les envoie à Loki.
- **Argon2id** · fonction de hachage de mots de passe résistante aux attaques matérielles, utilisée pour `passwordHash`.
- **cAdvisor** · exportateur de métriques par conteneur.
- **CloudFront** · réseau de diffusion de contenu d'AWS, sert les médias et le site statique.
- **Curseur opaque** · jeton de pagination encodant la position (date et identifiant) sans exposer la structure interne.
- **DevSecOps** · intégration de la sécurité au plus tôt dans la chaîne de livraison (ici, analyse Trivy bloquante).
- **GHCR** · GitHub Container Registry, registre où sont poussées les images du SaaS.
- **GitOps** · pratique où le dépôt Git est la source de vérité de l'état déployé.
- **IaC** · Infrastructure as Code, description de l'infrastructure en fichiers versionnés (Terraform, Ansible).
- **Idempotence** · propriété d'une opération qui, rejouée, produit le même état sans effet supplémentaire (build sauté si l'image existe déjà).
- **Loki** · base de journaux de Grafana, indexée par étiquettes.
- **Nonce** · valeur à usage unique dans le cookie de session, sert à détecter le rejeu.
- **node-exporter** · exportateur de métriques de l'hôte (CPU, mémoire, disque).
- **OAC** · Origin Access Control, mécanisme CloudFront qui réserve la lecture d'un bucket S3 à la distribution.
- **Origin CA** · certificat émis par Cloudflare pour chiffrer le lien entre Cloudflare et l'origine.
- **PgBouncer** · mutualiseur de connexions PostgreSQL, en pooling de transaction.
- **PKI** · infrastructure à clés publiques, ici la génération et la garde du certificat d'origine.
- **Right-sizing** · dimensionnement au besoin réel des réservations et limites de ressources.
- **SBOM** · Software Bill of Materials, inventaire des composants d'une image (format CycloneDX).
- **SSM** · AWS Systems Manager Parameter Store, où le backend lit la configuration du CDN.
- **socket-proxy** · intermédiaire en lecture filtrée devant le socket Docker, réduit la surface d'attaque de Traefik.
- **Swarm** · orchestrateur de conteneurs intégré à Docker, pilote la stack sur les nœuds Hetzner.
- **Traefik** · reverse proxy et routeur d'entrée du cluster, termine le TLS.
- **Trivy** · scanner de vulnérabilités, de secrets et de configuration, bloquant dans le pipeline SaaS.
- **WAF** · pare-feu applicatif web, présent chez Cloudflare et sur les distributions CloudFront (WAFv2).

Retour au [README du dépôt](../../README.md).
