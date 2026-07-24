# Note de cadrage · projet dropicture

*Blocs RNCP · C14 (BC2), en appui de C15 (BC2)*

Document de cadrage du projet dropicture, plateforme SaaS de bibliothèque de photos et vidéos privée par défaut, à publication explicite et réversible. Il fixe le contexte, les objectifs, le périmètre, la méthode, le budget, les ressources, les contraintes et les risques avant l'engagement des travaux.

## 1. Contexte

Le marché du stockage et du partage de photographies est occupé par des acteurs installés (Google Photos, iCloud, Amazon Photos, Flickr). Ces services rendent la visibilité d'un média confuse, portée par un lien de partage plutôt que par un état explicite, et n'offrent ni vitrine publique sans compte ni accès programmatique à sa propre bibliothèque. dropicture répond à ce manque avec un produit dont la promesse fondatrice est le contrôle réel de la visibilité, la réversibilité technique et la souveraineté des données.

Le projet sert de support à la certification RNCP40573, spécialité DevOps (bloc BC4C). Il est donc autant un produit qu'une démonstration d'infrastructure DevOps automatisée, reconstructible par le code.

## 2. Objectifs

- Livrer un produit fonctionnel de bout en bout, téléversement, organisation en albums, publication sélective, profil public, découverte et fil social léger.
- Automatiser entièrement l'infrastructure (provisionnement Terraform, configuration Ansible, livraison GitHub Actions).
- Mettre en place une observabilité complète (métriques, journaux, alerting) incluant un suivi de la consommation énergétique.
- Intégrer la sécurité au plus tôt (analyse bloquante, durcissement, conformité RGPD et ISO/IEC 27001).
- Produire un dossier de certification complet couvrant les quatre blocs de compétences.

## 3. Périmètre

**Inclus**
- Trois applications, API NestJS, application authentifiée Next.js, site vitrine statique.
- Cluster Docker Swarm sur Hetzner, CDN médias et sauvegardes sur AWS, périphérie Cloudflare.
- Pipelines de déploiement, de sauvegarde, de restauration et de destruction contrôlée.
- Pile d'observabilité et cartographie de conformité.

**Exclus**
- Application mobile native.
- Recherche par contenu et étiquetage automatique par intelligence artificielle.
- Transcodage vidéo et fil social avancé (commentaires, réactions).

Ces éléments sont recensés au backlog et à la feuille de route (voir `docs/wiki/14-amelioration-continue.md`).

## 4. Méthode de conduite

Conduite itérative à cadence courte, pilotée par un tableau Trello à cinq colonnes (Backlog, Ready, In progress, In review, Done) avec une limite de travail en cours de quatre, décrite en Annexe T. Les décisions structurantes sont consignées au journal des décisions d'architecture (Annexe J). La qualité est portée par des portes bloquantes en intégration continue et un plan de tests daté (Annexe Z).

## 5. Budget

Estimation à trois niveaux détaillée en Annexe Y. Charge de 207 jours-homme, soit 103 500 € au taux journalier moyen de 500 €, séparant l'effort de conception et de déploiement des coûts récurrents d'exploitation, avec une provision pour aléas cotée au registre des risques.

## 6. Ressources

- **Internes** · profil DevOps assurant conception, développement, infrastructure et exploitation.
- **Externes** · fournisseurs d'hébergement certifiés (Hetzner, AWS, Cloudflare), dont la couverture contractuelle est prise en compte dans la cartographie de conformité (Annexe R).
- **Outillage** · dépôt Git unique, GitHub Actions, registre GHCR, Trello, tableaux de bord Grafana.

## 7. Contraintes

- Hébergement et données en Europe pour la souveraineté et le RGPD.
- Infrastructure entièrement reconstructible par le code, sans configuration manuelle.
- Accessibilité prise en compte dans le produit et dans la documentation, adaptée aux différents profils utilisateurs.
- Budget d'exploitation maîtrisé (alertes budgétaires AWS, right-sizing des ressources).

## 8. Risques majeurs et contournement

Registre complet et cotation EBIOS Risk Manager en Annexe O. Principaux risques et parades.

| Risque | Parade |
|---|---|
| Fuite de secrets ou d'identifiants | secrets hors dépôt, analyse de secrets bloquante, rotation |
| Perte de données | sauvegardes chiffrées toutes les 6 h, versioning S3, restauration éprouvée |
| Indisponibilité d'un nœud | orchestration Swarm, reprovisionnement par le code |
| Dérive de coût ou de consommation | alertes budgétaires, suivi énergétique, right-sizing |
| Vulnérabilité applicative | durcissement, analyse Trivy bloquante, SBOM par image |

## 9. Délais et jalons

Calendrier détaillé en Annexe N (Gantt) et Annexe M (PERT, chemin critique). Du 1er janvier au 30 juin 2026, 123 jours ouvrés, cinq jalons de contrôle.

| Jalon | Contenu | Critère de franchissement |
|---|---|---|
| M1 | Conception et cadrage | cartographie SI et ADR validés |
| M2 | Infrastructure IaC | cluster reconstructible par le code |
| M3 | Développement | fonctionnalités du MVP livrées |
| M4 | DevOps | pipelines, observabilité et sécurité opérationnels |
| M5 | Clôture | recette, documentation et dossier complets |

## 10. Exigences de qualité et normes

Conformité RGPD et alignement ISO/IEC 27001:2022 (Annexe R), analyse de risques EBIOS Risk Manager et ISO/IEC 27005 (Annexe O), pratiques de sécurité applicative OWASP (Annexe S), documentation technique complète et adaptée aux profils (`docs/wiki/`).
