# Annexes — dossier technique dropicture

Livrables graphiques et documentaires du mémoire **RNCP40573 — Expert en informatique et systèmes
d'information**, option DevOps (bloc BC4C). Tous les schémas sont des productions originales, générés à
partir du code effectivement présent dans ce dépôt.

Le mémoire appelle ces annexes par la mention « cf. Annexe X ». Le tableau ci-dessous donne la
correspondance entre la numérotation du dossier de livraison (01 → 25), la lettre d'annexe utilisée dans le
mémoire, et le fichier.

## Index

| N° | Annexe | Livrable | Fichier |
|---:|---|---|---|
| 1 | A | Cartographie du SI, 4 niveaux (métier · fonctionnel · applicatif · infrastructure) | [`01-cartographie-si.drawio`](01-cartographie-si.drawio) — 4 pages |
| 2 | B | Topologie de l'infrastructure et du déploiement | [`02-topologie-infrastructure.drawio`](02-topologie-infrastructure.drawio) — 2 pages |
| 3 | C | Conteneurisation, services et segmentation réseau (Docker Swarm) | [`03-swarm-conteneurisation-reseaux.drawio`](03-swarm-conteneurisation-reseaux.drawio) — 2 pages |
| 4 | D | Modèle Conceptuel de Données (Merise) | [`04-mcd.drawio`](04-mcd.drawio) + [`04-05-modele-donnees-looping.sql`](04-05-modele-donnees-looping.sql) |
| 5 | E | Modèle Logique de Données (relationnel) | [`05-mld.drawio`](05-mld.drawio) + [`04-05-modele-donnees-looping.sql`](04-05-modele-donnees-looping.sql) |
| 6 | G | Diagramme de cas d'utilisation | [`06-cas-utilisation.drawio`](06-cas-utilisation.drawio) |
| 7 | H | Diagramme de classes (backend NestJS) | [`07-diagramme-classes-backend.drawio`](07-diagramme-classes-backend.drawio) |
| 8 | I.1 | Séquence — téléversement d'un média | [`08-sequence-televersement.drawio`](08-sequence-televersement.drawio) |
| 9 | I.2 | Séquence — publication, partage et retrait | [`09-sequence-publication.drawio`](09-sequence-publication.drawio) |
| 10 | I.3 | Séquence — session sécurisée (connexion, rotation, rejeu) | [`10-sequence-session-securisee.drawio`](10-sequence-session-securisee.drawio) |
| 11 | J | Journal des décisions d'architecture (24 ADR) | [`11-adr-journal-decisions-architecture.docx`](11-adr-journal-decisions-architecture.docx) |
| 12 | K | Pipeline CI/CD | [`12-pipeline-cicd.drawio`](12-pipeline-cicd.drawio) |
| 13 | L | Work Breakdown Structure (WBS) | [`13-wbs.drawio`](13-wbs.drawio) |
| 14 | M | Diagramme PERT et chemin critique | [`14-pert-chemin-critique.drawio`](14-pert-chemin-critique.drawio) |
| 15 | N | Planning (diagramme de Gantt) | [`15-planning-gantt.gan`](15-planning-gantt.gan) |
| 16 | O | Matrice des risques (probabilité / impact) | [`16-matrice-risques.xlsx`](16-matrice-risques.xlsx) — 3 feuilles |
| 17 | P | Architecture de la supervision et de l'observabilité | [`17-observabilite-supervision.drawio`](17-observabilite-supervision.drawio) |
| 18 | Q | Contrat d'interface (OpenAPI / Swagger) | [`18-openapi.yaml`](18-openapi.yaml) + [`18-openapi-redoc.pdf`](18-openapi-redoc.pdf) — 81 pages |
| 19 | R | Cartographie ISO/IEC 27001:2022 et RGPD | [`19-cartographie-iso27001-rgpd.docx`](19-cartographie-iso27001-rgpd.docx) |
| 20 | S | Chaîne DevSecOps | [`20-chaine-devsecops.drawio`](20-chaine-devsecops.drawio) |
| 21 | U | Plan de reprise d'activité (PRA) | [`21-plan-reprise-activite.drawio`](21-plan-reprise-activite.drawio) |
| 22 | F.1 | Maquettes des interfaces (wireframes basse fidélité) | [`22-maquettes-interfaces.pdf`](22-maquettes-interfaces.pdf) — 7 pages |
| 23 | F.2 / F.3 | Flux de données et registre des données personnelles | [`23-flux-de-donnees.drawio`](23-flux-de-donnees.drawio) — 2 pages |
| 24 | L bis | Matrice RACI | [`24-matrice-raci.docx`](24-matrice-raci.docx) |
| 25 | O bis | Matrice d'engagement des parties prenantes | [`25-engagement-parties-prenantes.xlsx`](25-engagement-parties-prenantes.xlsx) — 3 feuilles |

## Ouvrir les fichiers

| Extension | Outil | Remarque |
|---|---|---|
| `.drawio` | [draw.io](https://app.diagrams.net) (web ou application), extension VS Code | XML non compressé, lisible et versionnable. Les fichiers à plusieurs pages ouvrent leurs onglets automatiquement. |
| `.gan` | [GanttProject](https://www.ganttproject.biz) 3.x | Calendrier français, semaine de cinq jours ouvrés. |
| `.sql` | [Looping](https://www.looping-mcd.fr) 4.1+, menu « Rétroconception » | Reconstruit le MCD, puis génère le MLD et permet l'enregistrement en `.loo`. |
| `.yaml` | Swagger Editor, Redocly, VS Code | Spécification OpenAPI 3.0.3, 39 chemins et 47 opérations. |
| `.docx` / `.xlsx` | Word, Excel, LibreOffice | Tableaux à en-têtes figés et filtres pour les classeurs. |

## Cohérence entre annexes

Les annexes de pilotage se recoupent volontairement, et les chiffres sont alignés :

- la **WBS** (13) découpe le projet en 8 lots pour **69 jours-homme** et **34 500 €** au TJM de 500 € ;
- le **PERT** (14) traduit ces lots en durées et calcule un chemin critique **A → C → D → F → H de
  40 jours ouvrés**, avec des marges de 2, 8 et 11 jours sur les trois lots hors chemin critique ;
- le **Gantt** (15) transcrit exactement ce séquencement à partir d'un démarrage au **3 février 2025**,
  avec cinq jalons M1 à M5 ;
- la **matrice des risques** (16) hiérarchise 8 risques ; les deux plus critiques (R1 perte du nœud de
  périphérie, R5 perte de données) correspondent aux deux actions prioritaires du plan d'amélioration
  continue ;
- la **RACI** (24) attribue à chacun des 8 lots un décideur redevable unique.

L'écart entre les 69 jours-homme de charge et les 40 jours ouvrés de durée est assumé et documenté dans
l'annexe 14 : il tient à l'intervention de deux développeurs en parallèle sur les lots applicatifs.

## Génération

Les diagrammes sont produits à partir du code du dépôt (contrôleurs, entités, migration, Terraform,
Ansible, workflows). La palette suit [Open Color](https://yeun.github.io/open-color/) et la typographie
Helvetica, conformément à la charte des schémas du dossier. Le rendu PDF de la spécification OpenAPI est
produit par Redoc, sans appel réseau à l'ouverture.
