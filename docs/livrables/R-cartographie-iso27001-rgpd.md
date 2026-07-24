# R. Cartographie ISO/IEC 27001 2022 et RGPD

*Livrable transverse de conformité, hors des 13 livrables du Listing, conservé car il documente la couverture réelle des mesures de sécurité et ses écarts.*

## Livrable

### Annexe R Cartographie ISO/IEC 27001:2022 et RGPD


##### dropicture · correspondance entre les mesures de sécurité effectivement mises en œuvre et les référentiels applicables

*RNCP40573  Expert en informatique et systèmes d'information, option DevOps · Amir Redjem · appelée en §11.3.4, §12.1.2, §12.4.1 et §13 du mémoire*

Cette cartographie rapproche les mesures réellement déployées dans le dépôt dropicture des mesures de l'annexe A de la norme ISO/IEC 27001 dans sa version 2022, puis des articles du règlement général sur la protection des données. Elle ne prétend pas à une certification, elle documente une couverture, et surtout ses écarts. Une cartographie qui ne montrerait que ce qui est couvert n'aurait aucune valeur d'audit.

Trois statuts sont employés. « Couvert » signifie qu'une mesure technique effective, vérifiable dans le dépôt, répond au contrôle. « Partiellement couvert » signale un dispositif en place mais incomplet, dont l'écart est décrit et rattaché au plan d'amélioration continue. « Délégué » désigne un contrôle qui relève contractuellement d'un fournisseur d'hébergement certifié. « Hors périmètre » marque un contrôle sans traduction technique dans ce projet.


#### A.5, Contrôles organisationnels

| Réf. | Contrôle | Statut | Mise en œuvre dans dropicture |
| --- | --- | --- | --- |
| 5.1 | Politiques de sécurité de l'information | Couvert | Politique portée par le dossier technique, le journal des décisions d'architecture (Annexe J) et le README du dépôt. Toute règle est traduite en code ou en configuration versionnée. |
| 5.7 | Renseignement sur les menaces | Couvert | Veille technologique et réglementaire structurée (mémoire §11.1). Base de vulnérabilités Trivy rafraîchie à chaque exécution du pipeline,  résultats SARIF publiés dans GitHub Code Scanning. |
| 5.8 | Sécurité de l'information dans la gestion de projet | Couvert | Exigences de sécurité inscrites au cahier des charges et au lot WBS 7. Portes bloquantes dans la chaîne de livraison (Annexe S). Registre des risques revu périodiquement (Annexe O). |
| 5.9 / 5.10 | Inventaire des actifs et usage acceptable | Couvert | L'état Terraform constitue l'inventaire faisant autorité,  nœuds, réseaux, pare-feu, buckets, distribution, paramètres. Aucune ressource n'est créée hors du code. |
| 5.14 | Transfert d'informations | Couvert | TLS strict de bout en bout (Cloudflare « full strict », certificat Origin CA sur l'origine), HSTS deux ans avec preload, politique de bucket refusant explicitement tout transport non chiffré. |
| 5.15 | Contrôle d'accès | Couvert | Session opaque obligatoire sur toutes les routes protégées,  chaque opération est bornée par une clause d'appartenance, accès programmatique par clé d'API personnelle, rotative et révocable. |
| 5.16 / 5.17 / 5.18 | Gestion des identités, des informations d'authentification et des droits | Couvert | Identité unique par compte (pseudonyme et e-mail uniques). Mot de passe haché en Argon2id, exclu des lectures par défaut. Révocation globale par versionnement de jeton. Clé d'API régénérable et révocable en un appel. |
| 5.19 / 5.20 / 5.21 | Relations fournisseurs et chaîne d'approvisionnement TIC | Couvert | Trois fournisseurs identifiés, chacun sur un périmètre explicite (Annexe B). Versions d'images épinglées, nomenclature logicielle CycloneDX produite pour chaque artefact publié. |
| 5.23 | Sécurité de l'information pour l'usage de services en nuage | Couvert | Régions européennes imposées (Hetzner fsn1, AWS eu-west-3). Accès aux services AWS par identifiants dédiés au périmètre applicatif. Configuration du CDN lue dans le magasin de paramètres, jamais codée en dur. |
| 5.24 → 5.28 | Gestion des incidents de sécurité | Partiellement couvert | Détection par dix règles d'alerte et par les journaux structurés,  réponse outillée (retour arrière automatique, révocation globale de sessions, détection de rejeu). Écart assumé,  les canaux de notification d'Alertmanager ne sont pas encore raccordés (plan d'amélioration, 1 j-h). |
| 5.29 / 5.30 | Continuité et préparation des TIC à la continuité | Partiellement couvert | Plan de reprise outillé et rejouable (Annexe U), reconstruction intégrale par le code, restauration transactionnelle. Écart assumé, l'exercice de reprise périodique en conditions réelles n'est pas encore formalisé (plan d'amélioration, 3 j-h). |
| 5.31 | Exigences légales, réglementaires et contractuelles | Couvert | RGPD, directive NIS 2, règlement européen sur l'intelligence artificielle et Cloud Act suivis en veille réglementaire. Le Cloud Act a directement motivé le choix d'un hébergeur européen pour le calcul (Annexe J, ADR-007). |
| 5.33 | Protection des enregistrements | Couvert | Sauvegardes versionnées et verrouillées par Object Lock en mode GOVERNANCE, un enregistrement ne peut être ni altéré ni supprimé avant l'échéance de rétention. |
| 5.34 | Vie privée et protection des données à caractère personnel | Couvert | Minimisation (cinq tables, aucune donnée collectée « au cas où »), privé par défaut, suppression en cascade servant le droit à l'effacement. Détail en Annexe F.3. |
| 5.36 | Conformité aux politiques et normes de sécurité | Couvert | Analyse statique de la configuration d'infrastructure (Terraform, Ansible, Dockerfile) en porte bloquante. Revue de code systématique. Exceptions centralisées et datées. |
| 5.37 | Procédures d'exploitation documentées | Couvert | Les playbooks Ansible et les workflows constituent la procédure exécutable,  les runbooks documentent le diagnostic et la remédiation des situations non automatisées. |


#### A.6, Contrôles liés aux personnes

| Réf. | Contrôle | Statut | Mise en œuvre dans dropicture |
| --- | --- | --- | --- |
| 6.3 | Sensibilisation, formation et éducation | Couvert | Revue de code systématique, programmation en binôme sur les points délicats, rédaction de décisions d'architecture documentées, les savoir-faire circulent au lieu de se concentrer. |
| 6.6 | Accords de confidentialité | Hors périmètre | Contrôle de nature contractuelle, sans traduction technique dans le projet. Serait porté par le cadre juridique de l'organisation exploitante. |
| 6.8 | Signalement des événements de sécurité | Couvert | Journal d'accès structuré interrogeable dans Loki, alertes qualifiées portées par Alertmanager, détection automatique de rejeu de session avec journalisation d'alerte dédiée. |


#### A.7, Contrôles physiques

| Réf. | Contrôle | Statut | Mise en œuvre dans dropicture |
| --- | --- | --- | --- |
| 7.1 → 7.14 | Périmètres, contrôles d'accès physiques, sécurité des équipements, câblage, maintenance et mise au rebut | Délégué | Intégralement délégué aux fournisseurs d'hébergement, dont les centres de données sont certifiés ISO/IEC 27001 (Hetzner, Falkenstein, AWS, région eu-west-3). Le projet ne détient aucun matériel physique. La responsabilité est contractuelle et documentée, non technique. |


#### A.8, Contrôles technologiques

| Réf. | Contrôle | Statut | Mise en œuvre dans dropicture |
| --- | --- | --- | --- |
| 8.2 | Droits d'accès privilégiés | Couvert | Accès SSH par clé uniquement (authentification par mot de passe et interactive désactivées, trois tentatives au plus). L'API Docker n'est jamais exposée, elle est médiée par un mandataire en lecture seule sur un réseau interne dédié. |
| 8.3 | Restriction d'accès à l'information | Couvert | Clause d'appartenance sur chaque opération portant sur un média ou un album. Empreinte du mot de passe et clé d'API exclues des lectures par défaut au niveau du modèle. |
| 8.5 | Authentification sécurisée | Couvert | Argon2id, session opaque adossée à Redis, expiration glissante et absolue, rotation par nonce sous verrou, fenêtre de grâce, détection de rejeu et révocation globale (Annexe I.3). |
| 8.6 | Dimensionnement | Couvert | Réservations et limites déclarées service par service (right-sizing). Alertes de saturation processeur, mémoire et disque, dont une alerte prédictive à 24 heures. |
| 8.7 | Protection contre les programmes malveillants | Couvert | Images de base minimales (Alpine), exécution sous utilisateur non privilégié, analyse Trivy des dépendances et des images en portes bloquantes. |
| 8.8 | Gestion des vulnérabilités techniques | Couvert | Trois analyses bloquantes (dépendances et secrets, configuration d'infrastructure, image publiée), seuils CRITICAL et HIGH. Rapports SARIF historisés dans GitHub Code Scanning. Exceptions datées dans un fichier dédié. |
| 8.9 | Gestion des configurations | Couvert | Toute configuration est décrite en code et versionnée. Les fichiers d'observabilité sont publiés en configurations Swarm nommées par empreinte, une modification crée un nouvel objet et déclenche mécaniquement la mise à jour du service. |
| 8.10 | Suppression des informations | Couvert | Suppression du compte, effacement des objets du stockage par lots, suppression en base propagée en cascade, puis invalidation du cache de diffusion. |
| 8.11 | Masquage des données | Couvert | Les journaux d'accès ne contiennent qu'un identifiant technique de compte (UUID), jamais d'identité en clair. Les secrets applicatifs ne sont jamais journalisés. |
| 8.12 | Prévention de la fuite de données | Couvert | Privé par défaut. Bucket des médias intégralement privé (blocage d'accès public complet), lecture restreinte au seul préfixe public via un contrôle d'accès d'origine. Origines autorisées en liste blanche (CORS). |
| 8.13 | Sauvegarde des informations | Couvert | Sauvegarde toutes les six heures, vérifiée par empreinte SHA-256 et par contrôle de la taille de l'objet déposé, versionnée, verrouillée et soumise à un cycle de vie (Annexe U). |
| 8.15 | Journalisation | Couvert | Journal d'accès HTTP structuré en JSON (méthode, route, statut, adresse IP, identifiant de compte, quota, durée), centralisé dans Loki avec une rétention de trente jours. |
| 8.16 | Activités de surveillance | Couvert | Prometheus scrute cinq familles de cibles toutes les quinze secondes,  dix règles d'alerte couvrent disponibilité, saturation, taux d'erreur, latence et consommation électrique estimée (Annexe P). |
| 8.17 | Synchronisation des horloges | Partiellement couvert | Assurée par le service de synchronisation par défaut du système d'exploitation des nœuds. Écart assumé, la source de temps n'est pas explicitement pilotée par le code de configuration. |
| 8.18 | Utilisation de programmes utilitaires à privilèges | Couvert | Le mandataire de socket n'autorise qu'un ensemble restreint de points de lecture. Aucune opération d'écriture sur l'API Docker n'est exposée à un conteneur joignable depuis Internet. |
| 8.19 | Installation de logiciels sur les systèmes en exploitation | Couvert | Les images sont immuables et étiquetées par empreinte de commit. Aucune installation manuelle n'est pratiquée sur les nœuds,  toute évolution passe par le pipeline. |
| 8.20 / 8.21 | Sécurité des réseaux et des services réseau | Couvert | Pare-feu de projet n'ouvrant 80 et 443 qu'aux plages d'adresses de Cloudflare, lues dynamiquement. Plan de contrôle de l'orchestrateur confiné au réseau privé. Terminaison TLS et routage par Traefik, sondes de santé par service. |
| 8.22 | Cloisonnement des réseaux | Couvert | Cinq réseaux overlay aux rôles distincts, dont deux marqués « internes » (aucune route par défaut vers l'extérieur), la base de données n'est joignable que depuis le réseau applicatif (Annexe C). |
| 8.23 | Filtrage web | Couvert | Pare-feu applicatif Cloudflare en périphérie et pare-feu applicatif AWS devant la diffusion des médias (limitation de débit par adresse, liste de réputation, jeu de règles communes). |
| 8.24 | Utilisation de la cryptographie | Couvert | Argon2id pour les mots de passe, AES-256 au repos sur tous les buckets, TLS 1.2 minimum en transit, certificat d'origine RSA 2048 émis par Cloudflare, secrets Swarm chiffrés au repos. |
| 8.25 → 8.28 | Cycle de développement sécurisé, exigences applicatives, principes d'ingénierie et codage sécurisé | Couvert | Contrôles déplacés au plus tôt (pre-commit, tests, analyses). Validation des entrées en liste blanche avec rejet de toute propriété non déclarée. Recommandations OWASP appliquées,  en-têtes de sécurité, corps plafonné, limitation de débit, requêtes paramétrées par l'ORM. |
| 8.29 | Tests de sécurité en développement et en recette | Couvert | 218 tests automatisés, dont une suite dédiée à la limitation de débit et des cas couvrant explicitement la rotation de session, la détection de rejeu et le contrôle d'appartenance. |
| 8.31 | Séparation des environnements | Partiellement couvert | Développement local isolé (base et cache conteneurisés, identifiants générés localement) et production entièrement pilotée par le code. Écart assumé,  il n'existe pas d'environnement de préproduction distinct, choix cohérent avec la maîtrise des coûts mais tracé comme limite. |
| 8.32 | Gestion des changements | Couvert | Toute modification passe par le dépôt, revue, tests, plan Terraform inspecté avant application, déploiement progressif surveillé avec retour arrière automatique. |
| 8.33 | Informations de test | Couvert | La suite de tests est autonome,  Redis remplacé par une implémentation en mémoire, persistance par des dépôts factices, service de médias doublé. Aucune donnée réelle n'est utilisée. |


#### Règlement général sur la protection des données (UE) 2016/679

| Article | Obligation | Mise en œuvre dans dropicture |
| --- | --- | --- |
| Art. 5 | Principes relatifs au traitement | Minimisation,  cinq tables couvrent l'ensemble du domaine,  ni géolocalisation, ni EXIF complet, ni traceur. Limitation des durées, sessions 8 h, journaux 30 jours, sauvegardes 35 / 365 jours. Exactitude, l'utilisateur rectifie lui-même son identité, son e-mail et son pseudonyme. |
| Art. 6 | Licéité du traitement | Exécution du contrat pour l'identité, l'e-mail, les médias et les abonnements. Consentement pour la biographie et la photo de profil, publiées volontairement. Intérêt légitime pour l'adresse IP, l'agent utilisateur et les journaux d'exploitation. |
| Art. 12 → 14 | Transparence et information | Pages publiques dédiées sur le site vitrine, mentions légales, politique de confidentialité, conditions d'utilisation et information sur les cookies. |
| Art. 15 | Droit d'accès | Les points d'entrée de profil et de paramètres restituent l'intégralité des données du compte, y compris la date de création, l'usage du stockage et la clé d'API. |
| Art. 16 | Droit de rectification | Modification de l'identité, du pseudonyme, de l'adresse e-mail, de la biographie et de la photo de profil, en libre-service. |
| Art. 17 | Droit à l'effacement | Suppression du compte après vérification du mot de passe, effacement des objets du stockage, puis suppression en base propagée en cascade aux médias, albums, placements et abonnements. La sémantique de cascade est portée par la base, pas seulement par le code (Annexe J, ADR-024). |
| Art. 18 / 21 | Droit à la limitation et droit d'opposition | La dépublication ramène instantanément un contenu au domaine privé, sans perte ni duplication. L'opération est réversible et bornée à son propriétaire. |
| Art. 20 | Droit à la portabilité | Restitution des liens de téléchargement d'un lot de médias, et extraction programmatique par clé d'API dans un format ouvert. |
| Art. 25 | Protection des données dès la conception et par défaut | Le privé est l'état par défaut, la publication est une action explicite. L'empreinte du mot de passe et la clé d'API sont exclues des lectures par défaut au niveau même du modèle. |
| Art. 28 | Sous-traitants | Trois sous-traitants techniques identifiés (Hetzner, Cloudflare, Amazon Web Services), chacun sur un périmètre explicite et documenté (Annexe B). |
| Art. 30 | Registre des activités de traitement | Registre simplifié tenu en Annexe F.3, catégories de données, finalités, bases légales, localisation, durées de conservation et mesures de sécurité. |
| Art. 32 | Sécurité du traitement | Chiffrement au repos (AES-256) et en transit (TLS ≥ 1.2, HSTS), pseudonymisation dans les journaux, capacité de rétablissement démontrée (Annexe U), procédure de test des mesures à formaliser. |
| Art. 33 / 34 | Notification des violations | Détection outillée,  alerte sur le taux d'erreurs, journalisation dédiée en cas de rejeu de session, révocation globale immédiate. Écart assumé, la procédure de notification à l'autorité et aux personnes concernées relève de l'organisation exploitante et n'est pas outillée ici. |
| Art. 44 → 49 | Transferts hors Union européenne | Aucun transfert. Le calcul est hébergé en Allemagne (Hetzner), le stockage et la diffusion sont confinés à la région française eu-west-3. Cloudflare n'assure que la périphérie réseau, sans conservation de contenu. Ce périmètre découle directement de l'analyse du Cloud Act. |


#### Écarts assumés et plan de traitement

| Écart | Traitement prévu | Charge | Priorité |
| --- | --- | --- | --- |
| A.5.24 → 5.28  canaux de notification d'alerte non raccordés | Raccorder Alertmanager à un canal de notification (courriel ou messagerie) et vérifier le bout-en-bout par une alerte de test. | 1 j-h · 500 € | Moyenne |
| A.5.29 / 5.30 et art. 32  exercice de reprise non formalisé | Programmer un exercice de restauration de bout en bout périodique et suivre un objectif de point de reprise documenté, afin de transformer une capacité démontrée en garantie éprouvée. | 3 j-h · 1 500 € | Moyenne |
| A.8.17  source de temps non pilotée par le code | Déclarer explicitement la configuration de synchronisation horaire dans le playbook de provisionnement. | 0,5 j-h · 250 € | Basse |
| A.8.31  absence d'environnement de préproduction | Choix assumé au regard de la maîtrise des coûts. L'infrastructure étant décrite en code, un environnement éphémère peut être instancié à la demande pour une recette ponctuelle. | à cadrer | Basse |
| Vigilance transverse  secrets répartis sur trois fournisseurs | Centraliser la gestion des secrets, en conservant le principe du moindre privilège par périmètre. | à cadrer | Basse |

*Sources, infra/saas/terraform/main.tf · infra/saas/ansible/{playbook,deploy,backup,restore}.yml · infra/saas/ansible/templates/docker-compose.yml.j2 · apps/saas/backend/src/{main.ts,services,guards,middleware,models} ·.github/workflows/*.yml ·.trivyignore  référentiels, ISO/IEC 27001:2022 annexe A · Règlement (UE) 2016/679 · ISO/IEC 27005 · EBIOS Risk Manager (ANSSI).*
