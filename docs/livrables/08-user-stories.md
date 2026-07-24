# 08. User stories

*Blocs RNCP · C13 (BC2), C11 (BC2)*

## Exigences attendues (⭐ Listing livrable)

- ⭐ **Format Given/When/Then avec critères d'acceptation** · C13 (BC2)
- ⭐ **Toutes les features MVP et la killer feature** · C11 (BC2), C13 (BC2)
- ⭐ **Priorisation MoSCoW (Must/Should/Could/Won't)** · C11 (BC2), C13 (BC2)

## Livrable

#### 2.  User stories, critères d'acceptation, priorité et estimation

Le format Given When Then décrit un comportement observable et non une intention. La colonne MoSCoW donne la priorité (Must, Should, Could, Won't). Les points suivent une suite de Fibonacci et mesurent la complexité, non la durée. La colonne de traçabilité relie chaque story au cas d'utilisation correspondant et au point d'accès de l'API.

| Réf. | Persona | En tant que membre, je veux | Critère d'acceptation (Given When Then) | MoSCoW | Pts | Traçabilité |
| --- | --- | --- | --- | --- | --- | --- |
| US-01 | P1 | S'inscrire avec un pseudonyme disponible | Étant donné un visiteur non authentifié sur la page d'inscription, quand il soumet un pseudonyme déjà pris, alors le formulaire signale l'indisponibilité avant l'envoi et l'inscription est refusée. | Must | 3 | UC-01 · POST /api/auth/signup |
| US-02 | P1 | Se connecter et rester connecté | Étant donné un membre disposant d'identifiants valides, quand il se connecte, alors un cookie de session opaque httpOnly est posé et la session reste valide 30 minutes glissantes, 8 heures au maximum. | Must | 5 | UC-02 · POST /api/auth/signin |
| US-03 | P1 | Être protégé contre l'énumération de comptes | Étant donné une adresse inconnue, quand une tentative de connexion est faite, alors la réponse et le temps de réponse sont identiques à ceux d'un mot de passe erroné. | Must | 3 | UC-02 · POST /api/auth/signin |
| US-04 | P1 | Téléverser un média sans saturer la mémoire du serveur | Étant donné un membre authentifié, quand il téléverse un fichier de 90 Mo, alors le corps est traité en flux vers le stockage objet et le média est créé avec une visibilité privée. | Must | 8 | UC-05 · POST /api/library/uploads |
| US-05 | P1 | Voir un envoi trop volumineux refusé proprement | Étant donné une limite de 8 Mo pour une image, quand un fichier de 12 Mo est envoyé, alors le flux est rompu, l'objet partiellement écrit est supprimé et le code FILE_TOO_LARGE est retourné. | Must | 5 | UC-05 · POST /api/library/uploads |
| US-06 | P1 | Retrouver sa bibliothèque dans l'ordre chronologique | Étant donné un membre possédant 4 000 médias, quand il ouvre sa bibliothèque, alors les éléments sont paginés par curseur et triés par date de prise de vue décroissante. | Must | 5 | UC-06 · GET /api/library |
| US-07 | P1 | Constituer un album et en définir la couverture | Étant donné un album existant, quand un média y est placé puis désigné comme couverture, alors la position est enregistrée et la couverture s'affiche sur la vignette de l'album. | Should | 5 | UC-07 à UC-09 · POST /api/library/albums |
| US-08 | P1 | Publier plusieurs médias en une seule action | Étant donné une sélection de six médias privés, quand la publication est demandée, alors chaque média bascule à l'état publié, la réponse liste les succès et qualifie chaque échec par un code. | Must | 8 | UC-11 · PATCH /api/library/publish |
| US-09 | P1 | Annuler une publication sans perdre le média | Étant donné deux médias publiés, quand la dépublication est demandée, alors ils disparaissent du profil public et restent présents dans la bibliothèque privée. | Must | 5 | UC-12 · PATCH /api/library/unpublish |
| US-10 | P1 | Supprimer définitivement un média | Étant donné un média publié, quand sa suppression est confirmée, alors la ligne est supprimée, l'objet est effacé du stockage et le cache du CDN est invalidé. | Must | 5 | UC-13 · DELETE /api/library/media |
| US-11 | P1 | Ne jamais publier un avatar par mégarde | Étant donné un média portant le rôle avatar, quand sa publication est demandée, alors elle est refusée avec le code AVATAR_NOT_ALLOWED. | Must | 2 | UC-11 · PATCH /api/library/publish |
| US-12 | P1 | Modifier sa biographie et son avatar | Étant donné un membre authentifié, quand il modifie sa biographie de 160 caractères au plus et remplace son avatar, alors le profil public reflète le changement à la publication suivante. | Should | 3 | UC-15 et UC-16 · PATCH /api/profile |
| US-13 | P1 | Changer son mot de passe et invalider les autres sessions | Étant donné un membre connecté sur deux navigateurs, quand il change son mot de passe, alors la version de jeton est incrémentée et toutes les sessions existantes sont invalidées. | Must | 5 | UC-21 · PATCH /api/settings/password |
| US-14 | P1 | Supprimer son compte et toutes ses données | Étant donné un membre possédant médias, albums et abonnements, quand il confirme la suppression de son compte, alors la suppression en cascade efface les lignes liées et les objets du stockage. | Must | 8 | UC-23 · DELETE /api/settings/account |
| US-15 | P2 | Consulter un profil public sans compte | Étant donné un visiteur non authentifié, quand il ouvre l'adresse d'un profil, alors la galerie publiée s'affiche sans inscription ni exécution serveur. | Must | 8 | UC-19 · GET /api/public/{username} |
| US-16 | P2 | Ne voir que ce qui a été explicitement publié | Étant donné un membre possédant des médias privés et publiés, quand un visiteur consulte son profil, alors seuls les médias portant une date de publication apparaissent. | Must | 3 | UC-19 · GET /api/public/{username}/media |
| US-17 | P2 | Rechercher un profil par son pseudonyme | Étant donné un pseudonyme partiel, quand la recherche est lancée, alors les profils correspondants sont proposés sans révéler d'adresse de courriel. | Could | 3 | UC-21 · GET /api/public/search |
| US-18 | P2 | Afficher rapidement une galerie chargée | Étant donné une galerie de cent médias publiés, quand la page est ouverte, alors les fichiers sont servis par le CDN avec un cache immuable d'un an. | Could | 5 | UC-20 · CDN cdn.dropicture.com |
| US-19 | P3 | Obtenir et faire tourner une clé d'API personnelle | Étant donné un membre authentifié, quand il demande une rotation de clé, alors l'ancienne clé cesse immédiatement d'être acceptée et la nouvelle est unique en base. | Should | 5 | UC-22 · POST /api/settings/api-key/rotate |
| US-20 | P3 | Disposer d'un contrat d'interface documenté | Étant donné la spécification OpenAPI publiée, quand un intégrateur consulte un point d'accès, alors la requête, la réponse et les cas d'erreur sont décrits avec un exemple. | Should | 3 | Annexe Q · GET /api/docs |
| US-21 | P3 | Être limité en débit plutôt que bloqué sans explication | Étant donné plus de dix tentatives de connexion en une minute depuis une adresse, quand une nouvelle requête arrive, alors elle est refusée avec un code explicite et une durée d'attente. | Could | 3 | UC-02 · limitation de débit |
| US-22 | P4 | Être alerté avant que l'incident ne soit visible | Étant donné une cible de supervision injoignable depuis cinq minutes, quand la règle est évaluée, alors une alerte critique est émise et routée vers l'exploitation. | Must | 5 | Annexe P · règle CibleInjoignable |
| US-23 | P4 | Reconstruire un nœud perdu par le code | Étant donné la perte d'un nœud applicatif, quand le provisionnement est relancé, alors la machine est recréée et réintégrée au cluster sans action manuelle et sans perte de donnée. | Must | 8 | Annexe U · scénario S1 |
| US-24 | P4 | Restaurer la base à un point de reprise connu | Étant donné une sauvegarde datant de moins de six heures, quand la restauration est déclenchée, alors la base est restaurée de façon transactionnelle et l'écart au point de reprise est mesuré. | Must | 8 | Annexe U · scénario S2 |
| US-25 | P1 | Retrouver ses médias par reconnaissance de contenu | Étant donné une bibliothèque de plusieurs milliers de médias, quand une recherche par contenu est lancée, alors les médias correspondants sont proposés. | Won't | 21 | Hors périmètre, reporté au plan d'amélioration |
| US-26 | P1 | Déposer depuis une application mobile native | Étant donné un téléphone, quand une application native est installée, alors le dépôt se fait en arrière-plan. | Won't | 21 | Hors périmètre, reporté au plan d'amélioration |


#### 3.  Matrice de priorisation MoSCoW

La répartition ci-dessous est calculée directement sur le tableau de la section 2. Elle mesure l'engagement réellement pris, et non la priorité déclarée.

| Priorité | Signification retenue | Nb de stories | Points | Part des points livrables | Traitement en cas de tension sur le délai |
| --- | --- | --- | --- | --- | --- |
| Must | Sans elle, le produit ne tient pas sa promesse fondatrice | 17 | 94 | 78 % | Non négociable. Toute tension sur le délai se reporte sur les marges du PERT |
| Should | Attendue, mais le produit reste utilisable sans elle | 4 | 16 | 13 % | Reportée à l'itération suivante, avec information des parties prenantes |
| Could | Confort, livrée si la capacité le permet | 3 | 11 | 9 % | Abandonnée sans arbitrage si la capacité manque |
| Won't | Hors périmètre assumé pour cette version | 2 | 42 | hors périmètre | Consignée au plan d'amélioration continue, non planifiée |
| Total livrable | Must, Should et Could | 24 | 121 | 100 % | Capacité observée d'environ 10 points par itération de deux semaines |

Le fait marquant de cette répartition n'est pas flatteur et mérite d'être énoncé. La part des Must atteint 78 % des points livrables, ce qui traduit un périmètre déjà réduit à son noyau avant même la priorisation. En clair, la matrice MoSCoW laisse ici peu de marge d'arbitrage, et le seul amortisseur réel en cas de retard reste les marges calculées au PERT (cf. Annexe M), six jours sur l'infrastructure, vingt-cinq sur le frontend, trente-quatre sur la sécurité. C'est une limite assumée du découpage, pas un oubli de méthode.

Chaque priorité est justifiée par un critère unique, l'atteinte ou non de la promesse fondatrice du produit, à savoir le contrôle explicite de la visibilité (cf. Annexe W, KF1). Les deux stories classées Won't ne sont pas des oublis, ce sont des renoncements documentés. La recherche par contenu supposerait un traitement d'images à grande échelle, hors du périmètre de charge et hors du modèle de sobriété retenu. Les 42 points ainsi écartés représentent à eux seuls 26 % de l'effort qui aurait été nécessaire pour couvrir l'ensemble des demandes recensées.


#### 4.  Croisement valeur et effort

Le second axe de priorisation croise la valeur perçue par le persona et l'effort estimé. Il sert à ordonner les stories à l'intérieur d'une même priorité MoSCoW.

|  | Effort faible (2 à 3 pts) | Effort moyen (5 pts) | Effort élevé (8 pts et plus) |
| --- | --- | --- | --- |
| Valeur forte | US-03, US-11, US-16 | US-02, US-09, US-10, US-13, US-22 | US-04, US-08, US-14, US-15, US-23, US-24 |
| Valeur moyenne | US-01, US-12, US-17, US-20, US-21 | US-06, US-07, US-18, US-19 |  |
| Valeur faible |  |  | US-25, US-26 (hors périmètre) |

Les stories situées en valeur forte et effort faible sont traitées en premier dans chaque itération, parce qu'elles produisent un effet visible à faible coût. Les stories en valeur forte et effort élevé sont découpées avant d'entrer en itération, aucune n'excédant huit points une fois découpée.

*Sources, mémoire §11.2.1 (fonctionnalités requises), §11.2.2 (collecte et analyse des besoins), §13.5.2 (méthodologie de projet) · Annexe G (cas d'utilisation) · Annexe Q (contrat d'interface) · Annexe W (killer features) · Annexe Z (plan de tests).*
