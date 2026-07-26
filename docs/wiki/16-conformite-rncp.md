# 16 · Conformité RNCP40573

Matrice de couverture du référentiel par le mémoire, les annexes et le code. Elle croise chaque compétence C1 à C31 et chaque livrable attendu avec sa preuve dans le dépôt. Établie après lecture intégrale du mémoire et du référentiel.

## Blocs communs et option

- **BC1** Définir une stratégie de systèmes d'information, C1 à C9.
- **BC2** Piloter des projets informatiques, C10 à C20.
- **BC3** Concevoir et développer une application, C21 à C27.
- **BC4C** Concevoir et déployer des infrastructures DevOps automatisées, C28 à C31.

## Couverture par compétence

| Comp. | Objet | Preuve | Statut |
|---|---|---|---|
| C1 | Veille structurée | Annexe V, mémoire 11.1 | ✅ |
| C2 | Synthèse de veille | Annexe V, mémoire 11.1.3 | ✅ |
| C3 | Recommandations innovantes | Annexes V et W, mémoire 11.1.4 | ✅ |
| C4 | Cartographie du SI et analyse de risques | Annexes A et O, mémoire 11.3 | ✅ |
| C5 à C9 | Stratégie et architectures | Annexe J (ADR), mémoire 11.3 | ✅ |
| C10 | Analyse de problématique et étude d'opportunité | `etude-opportunite.md`, mémoire 10 | ✅ (ajouté) |
| C11 | Priorisation des fonctionnalités | Annexes F.1, W, X (MoSCoW) | ✅ |
| C12 | Cahier des charges technique, RGPD, PSH | Annexes X et R, mémoire 11.2 | ✅ |
| C13 | Spécification, UML, base de données | Annexes D, E, G, Q, X, Z | ✅ |
| C14 | Note de cadrage | `note-de-cadrage.md`, mémoire 13 | ✅ (ajouté) |
| C15 | Planification WBS, PERT, Gantt | Annexes L, M, N, Y | ✅ |
| C16 | Outils collaboratifs et management | Annexe T | ✅ |
| C17 | Matrice et mitigation des risques | Annexe O | ✅ |
| C18 | Communication et engagement | Annexe O bis | ✅ |
| C19 | Engagement des parties prenantes | Annexes L bis, O bis, T | ✅ |
| C20 | Capitalisation des compétences | Annexe T, mémoire 13.3.2 | ✅ |
| C21 | Architecture applicative et maquettes | Annexes B, D, E, F.1, U | ✅ |
| C22 | Processus métier UML, trois flux | Annexes G, I.1, I.2, I.3 | ✅ |
| C23 | Environnement informatique et éco-conception | mémoire 14.1.5, Annexes A.3, A.4, P | ✅ |
| C24 | Patterns logiciels et de conception | Annexe H | ✅ |
| C25 | Développement sécurisé, OWASP | Annexes S, Q, R, mémoire 12.3 | ✅ |
| C26 | Scénarios de tests | Annexes Z et S, mémoire 14.2 | ✅ |
| C27 | Suivi qualité, CI, monitoring | Annexes K, P | ✅ |
| C28 | Analyse d'infrastructure et stratégie DevOps | Annexes B, L, M, N, mémoire 17.1, wiki | ✅ |
| C29 | Pipelines CI/CD et GitOps | Annexes K, S, R, I.3, mémoire 17.2, wiki | ✅ |
| C30 | Orchestration des conteneurs | Annexe C, mémoire 17.3, wiki | ✅ |
| C31 | Monitoring et observabilité | Annexes P, U, mémoire 17.4, wiki | ✅ |

## Critères transverses de l'option DevOps

| Critère BC4C | Preuve | Statut |
|---|---|---|
| Pipelines CI/CD fonctionnels | 7 workflows, Annexe K, `docs/wiki/09-cicd.md` | ✅ |
| Containerisation, orchestration, scaling documentés | Annexe C, `docs/wiki/08` | ✅ |
| Monitoring complet avec dashboards et alerting | Annexe P, `docs/wiki/10`, receiver e-mail configuré | ✅ |
| Alerte sur consommation énergétique (green IT) | règles Prometheus, dashboard énergie | ✅ |
| IaC versionné sur Git | Terraform et Ansible, `docs/wiki/07` | ✅ |
| IA utilisée pour optimiser les ressources | workflow `ai-rightsizing.yml`, tableau de bord Annexe T | ✅ (ajouté) |
| Documentation wiki adaptée aux profils, accessibilité | `docs/wiki/` (navigation par profil) | ✅ |
| Plan d'amélioration continue | `docs/wiki/14` | ✅ |

## Livrables attendus par bloc

- **BC1** dossier stratégique, veille (V), cartographie et analyse de risques (A, O), recommandations, exposé, mémoire 11. ✅
- **BC2** cahier des charges fonctionnel et technique (X, Q), note de cadrage (ajoutée), planification (L, M, N, Y), matrice de risques (O), RACI (L bis), matrice d'engagement (O bis), tableau de bord assisté par IA (T). ✅
- **BC3** dossier de conception (B, D, E, F, G, H, I), stratégie de déploiement et de maintien (U), sécurité (S, R), tests (Z), monitoring (P). ✅
- **BC4C** projet DevOps complet et dossier REX, analyse d'infrastructure, stratégie DevOps, CI/CD, containerisation, monitoring, plan d'amélioration continue, documentation technique complète (le présent wiki). ✅

## Écarts corrigés lors de la revue de complétude

| Écart initial | Correctif |
|---|---|
| C14, note de cadrage absente | `docs/livrables/note-de-cadrage.md` créée |
| C10, étude d'opportunité non formalisée | `docs/livrables/etude-opportunite.md` créée |
| Annexe F.1 (maquettes) sans planche | maquettes SVG importables Figma et PNG, calquées sur le code réel |
| IA non branchée dans la chaîne | workflow `ai-rightsizing.yml` (analyse de right-sizing assistée par IA) |
| Receiver Alertmanager vide | deux canaux configurés, courriel en SMTP authentifié et webhook Slack, secrets hors dépôt |
| Code source peu commenté | backend documenté en JSDoc, 46 routes sur 46 et toutes les fonctions publiques des services, convention décrite en §14.1.6 du mémoire |

## Écarts résiduels mineurs

- **Annexe K** ne comporte qu'un schéma détaillé (Pipeline SaaS Deploy). Les six autres workflows sont documentés et schématisés dans `docs/wiki/09-cicd.md`, un second schéma d'annexe reste optionnel.
- Le mémoire numérote la partie option **17** en sautant 15 et 16, réservées aux options non retenues (cybersécurité, big data et IA). Cette numérotation suit le modèle de dossier du candidat et est donc conservée.
- Les dépendances et incohérences techniques du code sont suivies dans `docs/wiki/14-amelioration-continue.md`.

## Verdict

La couverture des blocs BC1, BC2, BC3 et de l'option BC4C est complète après correction des cinq écarts ci-dessus. Les points résiduels sont mineurs et documentés.
