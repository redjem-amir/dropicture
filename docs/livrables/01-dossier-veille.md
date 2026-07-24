# 01. Dossier de veille technologique

*Blocs RNCP · C1 (BC1), C2 (BC1), C3 (BC1)*

## Exigences attendues (⭐ Listing livrable)

- ⭐ **Maximum de sources analysées (articles, docs techniques, benchmarks)** · C1 (BC1)
- ⭐ **Synthèse des technologies pertinentes (frontend, backend, cloud, killer feature)** · C2 (BC1)
- ⭐ **Recommandations justifiées** · C3 (BC1)

## Livrable

Une veille n'a de valeur que si elle est traçable. Ce dossier expose le dispositif réellement tenu pendant le projet, la façon dont chaque source a été qualifiée, les textes réglementaires qui ont pesé sur des décisions d'architecture, et les recommandations qui en découlent. Les conclusions structurantes sont consignées au journal des décisions d'architecture (cf. Annexe J), de sorte qu'une décision de veille reste réexaminable plus tard, y compris par quelqu'un d'autre.


#### 1.  Dispositif de veille et sources mobilisées

Les sources sont volontairement hétérogènes. L'objectif est de recouper l'information plutôt que de la voir répétée. La colonne de fiabilité applique la grille d'évaluation exposée en section 2, notée de 1 à 5.

| Réf. | Source | Nature | Rythme | Ce qui y est cherché | Fiab. |
| --- | --- | --- | --- | --- | --- |
| S1 | Documentations et notes de version officielles (nestjs.com, nextjs.org, bun.sh, postgresql.org, docs.docker.com, developer.hashicorp.com, prometheus.io, grafana.com) | Primaire | À chaque montée de version | Ruptures de compatibilité, cadence de publication, état de maintenance | 5 |
| S2 | Dépôts GitHub des projets retenus, releases, issues, security advisories | Primaire | Hebdomadaire | Vitalité du projet, délai de correction des failles, nombre de mainteneurs actifs | 5 |
| S3 | GitHub Advisory Database, CVE et NVD | Primaire | Continu, via les alertes du pipeline | Vulnérabilités des dépendances effectivement embarquées | 5 |
| S4 | ANSSI, CNIL, OWASP | Normatif | Mensuel | Recommandations de durcissement, obligations RGPD, vulnérabilités applicatives | 5 |
| S5 | ISO/IEC 27001 version 2022, ISO/IEC 25010, ISO/IEC 27005, RGESN, WCAG 2.2 et RGAA 4 | Normatif | À chaque revue de conformité | Exigences de sécurité, de qualité, de sobriété et d'accessibilité | 5 |
| S6 | ThoughtWorks Technology Radar, CNCF Landscape | Prospective | Trimestriel à semestriel | Maturité réelle d'une technologie, tendances à écarter | 4 |
| S7 | State of DevOps Report (DORA), Stack Overflow Developer Survey | Étude | Annuel | Données d'adoption, corrélations entre pratiques et performance | 4 |
| S8 | Blogs d'ingénierie et changelogs des hébergeurs (Hetzner, Cloudflare, AWS) | Fournisseur | Mensuel | Évolutions tarifaires, nouveaux services, incidents déclarés | 3 |
| S9 | Hacker News, Reddit r/devops, Lobsters | Communautaire | Quotidien, en survol | Signaux faibles, retours d'exploitation, incidents de licence | 2 |

Trois modes de collecte coexistent. Les flux RSS et les abonnements aux notes de version alimentent un tri hebdomadaire. Les alertes automatiques de sécurité (Dependabot, GitHub Advisory) remontent directement dans le dépôt et dans le pipeline, où l'analyse Trivy rafraîchit sa base de vulnérabilités à chaque exécution. Les études annuelles et les radars technologiques font l'objet d'une lecture planifiée, hors urgence, parce qu'ils servent l'arbitrage et non la réaction.


#### 2.  Grille d'évaluation des sources

Une source n'est pas retenue parce qu'elle est disponible, mais parce qu'elle est qualifiable. Cinq critères la notent, la note de fiabilité reportée en section 1 étant la moyenne arrondie.

| Critère | Question posée | Note 1 | Note 3 | Note 5 |
| --- | --- | --- | --- | --- |
| Autorité | Qui publie, et avec quelle responsabilité engagée | Auteur anonyme | Praticien identifié | Éditeur du logiciel, autorité publique ou organisme de normalisation |
| Vérifiabilité | L'affirmation est-elle recoupable ailleurs | Aucune référence | Références partielles | Sources primaires citées et vérifiables |
| Fraîcheur | L'information est-elle datée et maintenue | Non datée | Datée, non révisée | Datée et révisée à chaque version |
| Neutralité | Un intérêt commercial oriente-t-il le propos | Contenu promotionnel | Éditorial d'éditeur | Aucun intérêt commercial direct |
| Conformité | La source s'appuie-t-elle sur un référentiel opposable (ISO, RGPD, accessibilité) | Aucun référentiel | Référentiel cité sans version | Référentiel cité, versionné et applicable |

La règle de tri est simple. Une tendance n'est retenue que si deux sources indépendantes au moins la confirment et si sa maturité la place hors de la phase spéculative. Les sources notées 2 servent uniquement à détecter un signal faible, jamais à fonder une décision.


#### 3.  Veille réglementaire et grandes orientations

La veille réglementaire ne relève pas de la culture générale. Chaque texte suivi ci-dessous a produit une décision technique vérifiable dans le dépôt. La couverture détaillée des mesures figure en cartographie de conformité (cf. Annexe R).

| Texte | Portée pour le projet | Échéance suivie | Décision prise | Trace |
| --- | --- | --- | --- | --- |
| RGPD (UE 2016/679) | Traitement de données personnelles de membres, médias, journaux d'accès | En vigueur, revue à chaque évolution du modèle de données | Minimisation des champs collectés, effacement en cascade au niveau de la base, chiffrement au repos et en transit, hébergement dans l'Union | Annexe R, Annexe E, ADR-018 |
| Cloud Act (États-Unis, 2018) | Accès extraterritorial possible aux données détenues par un fournisseur de droit américain | Veille continue sur la jurisprudence | Calcul placé chez un hébergeur européen (Hetzner, Falkenstein), services AWS confinés à la région eu-west-3 (Paris), exposition limitée au stockage et à la diffusion | Annexe B, ADR-009 |
| Directive NIS 2 (UE 2022/2555) | Exigences de gestion des risques et de notification d'incident | Transposition nationale suivie | Registre de risques coté EBIOS Risk Manager, plan de reprise documenté et testé, journalisation centralisée | Annexe O, Annexe U, Annexe P |
| IA Act (UE 2024/1689) | Outils d'IA employés dans la chaîne d'ingénierie | Application progressive depuis 2024 | Usage cantonné à l'assistance sous revue humaine, ce qui maintient la chaîne hors des catégories à haut risque du texte, mention explicite dans la documentation | Annexe T, §11.1.2 du mémoire |
| RGESN (référentiel général d'écoconception de services numériques) | Sobriété du service et mesurabilité de son empreinte | Revue à chaque jalon | Dimensionnement au plus juste des conteneurs, index partiels, modèle d'estimation énergétique instrumenté et alerté | Annexe P, Annexe L lot 6.5 |
| WCAG 2.2 et RGAA 4 | Accessibilité des surfaces exposées aux personnes en situation de handicap | Revue à chaque livraison d'interface | Structure sémantique explicite, hiérarchie de titres, contrastes contrôlés, navigation au clavier | Annexe F.1, Annexe R |
| EU Data Act (UE 2023/2854) | Portabilité et réversibilité vis-à-vis du fournisseur de cloud | Applicable depuis septembre 2025 | Aucune ressource créée hors du code, infrastructure reconstructible chez un autre fournisseur, export des médias par l'API | Annexe K, Annexe Q |


#### 4.  Synthèse des tendances, retenues et écartées

La synthèse ci-dessous ne conserve que les tendances ayant eu un effet mesurable sur une décision. Une veille qui ne consignerait que ce qu'elle valide perdrait sa valeur d'audit, les rejets sont donc consignés au même titre.

| Domaine | Tendance observée | Sources | Décision | Motif |
| --- | --- | --- | --- | --- |
| Moteur d'exécution | Runtimes unifiés (Bun, Deno) contre Node.js | S1, S2, S6, S7 | Bun retenu, Node.js conservé comme repli | Gain de cycle constaté à chaque exécution du pipeline, risque borné par la réversibilité |
| Orchestration | Domination de Kubernetes et de ses distributions allégées | S6, S7, S9 | Docker Swarm retenu | Le standard n'est pas proportionné à quelques nœuds opérés par une équipe réduite |
| Licences de l'outillage | Passage de Terraform sous licence BSL en 2023, fork OpenTofu, changement de licence de Redis en 2024, fork Valkey | S2, S6, S9 | Aucun changement immédiat, deux points de vigilance ouverts avec scénario de repli | Aucun effet opérationnel constaté, mais le risque de licence est devenu déterminant |
| Sécurité de la chaîne | Généralisation du SBOM et de l'analyse en porte bloquante | S3, S4 | Trivy en trois passes et SBOM CycloneDX par image | Une vulnérabilité connue coûte moins cher à traiter avant la mise en production |
| Observabilité | Convergence vers OpenTelemetry | S1, S6 | Écartée à ce stade, pile Prometheus et Loki conservée | Le coût d'instrumentation dépasse le bénéfice à cette échelle, réévaluation prévue |
| Informatique verte | Estimation logicielle de la consommation électrique | S5, S8 | Modèle d'estimation retenu, mesure matérielle repoussée | Sans instrument de mesure, aucun pilotage possible, la mesure réelle exige du matériel dédié |
| Assistance par IA | Assistants de code et d'exploitation | S6, S7, S9 | Retenue en assistance, sous revue humaine systématique | Gain de vitesse réel sur les tâches répétitives, aucune délégation de décision |


#### 5.  Recommandations innovantes issues de la veille

Trois axes sont recommandés aux parties prenantes. Chacun est chiffré, rattaché à une réglementation applicable et assorti de son risque, faute de quoi une recommandation reste une intention.

| Réf. | Recommandation | Nature | Apport attendu | Charge et coût | Cadre réglementaire | Risque assumé |
| --- | --- | --- | --- | --- | --- | --- |
| V1 | Généraliser l'assistance par IA à la génération de tests et à la rédaction des runbooks, sous revue humaine obligatoire | Intelligence artificielle | Couverture de test élargie sans allongement du cycle, documentation d'exploitation tenue à jour | 5 j-h · 2 500 € | IA Act, usage à risque limité, revue humaine tracée | Dépendance à un fournisseur externe, dérive de qualité si la revue est allégée |
| V2 | Mettre le nœud de périphérie et la pile d'observabilité en haute disponibilité | Cloud et résilience | Suppression du point de défaillance unique identifié comme risque R1 du registre | 8 j-h · 4 000 € · + 24 € par mois | NIS 2, continuité d'activité | Coût récurrent en hausse de 34 %, complexité d'exploitation accrue |
| V3 | Passer de l'estimation énergétique à une mesure réelle sur matériel dédié, et publier l'empreinte | Informatique verte | Pilotage de la sobriété sur une donnée mesurée et non modélisée, éligibilité aux critères RGESN | 10 j-h · 5 000 € · matériel à qualifier | RGESN, directive CSRD à terme | Sortie de l'hébergement mutualisé, remise en cause du modèle de coût |


#### 6.  Restitution et partage des connaissances

Une veille non restituée ne produit aucun effet. Le dispositif de diffusion ci-dessous distingue les publics et les rythmes, en interne comme en externe.

| Destinataire | Format de restitution | Rythme | Objectif visé |
| --- | --- | --- | --- |
| Sponsor du projet | Note de synthèse en une page, adossée aux tableaux de bord | À chaque jalon (M1 à M5) | Éclairer les arbitrages de périmètre et de budget |
| Équipe technique | Revue de veille en ouverture d'itération, décisions consignées en ADR | Toutes les deux semaines | Partager le raisonnement, pas seulement la conclusion |
| Référent sécurité et protection des données | Revue de conformité adossée à la cartographie ISO/IEC 27001 et RGPD | Mensuel | Détecter un écart réglementaire avant qu'il ne devienne une dette |
| Utilisateurs bêta | Notes de version en langage non technique | À chaque livraison | Rendre visible ce qui change pour eux, recueillir un retour exploitable |
| Parties prenantes externes et jury | Dossier de veille (la présente annexe) et §11.1 du mémoire | En fin de projet | Rendre la démarche vérifiable et reproductible |

La capitalisation repose sur trois supports versionnés avec le code, le journal des décisions d'architecture (cf. Annexe J), les runbooks d'exploitation et la documentation du dépôt. Ce choix évite qu'une connaissance ne reste attachée à une personne, ce qui constitue le point de vigilance principal d'une équipe de cette taille (cf. Annexe O bis, partie prenante PP2).

*Sources, mémoire §11.1.2 (méthodologie), §11.1.3 (résultats), §11.1.4 (recommandations) · Annexe J (journal des décisions d'architecture) · Annexe R (cartographie ISO/IEC 27001 et RGPD) · Annexe W (benchmark concurrentiel et matrice de décision).*
