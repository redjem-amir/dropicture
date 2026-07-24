# 07. Personas

*Blocs RNCP · C10 (BC2), C21 (BC3)*

## Exigences attendues (⭐ Listing livrable)

- ⭐ **Profil démographique et comportement tech** · C10 (BC2)
- ⭐ **Objectifs et frustrations** · C10 (BC2)
- ⭐ **Au moins 1 scénario d'usage détaillé par persona** · C10 (BC2), C21 (BC3)

## Livrable

Une exigence formulée hors contexte se prête à toutes les interprétations. Les quatre personas ci-dessous fixent ce contexte, chacun correspondant à l'un des acteurs du diagramme de cas d'utilisation (cf. Annexe G). Les user stories qui suivent traduisent chaque cas d'utilisation en comportement observable, avec ses critères d'acceptation, sa priorité MoSCoW et son estimation en points. Cette forme rend l'exigence testable, ce qui la relie directement au plan de tests (cf. Annexe Z).


#### 1.  Personas


##### P1  Léa Marchand, 29 ans, photographe amatrice   (acteur  Membre)

| Profil démographique | Comportement technologique | Objectifs | Frustrations |
| --- | --- | --- | --- |
| Chargée de communication en agence, vit à Lyon. Photographie en argentique le week-end et numérise ses planches. Environ 4 000 clichés accumulés sur trois disques différents. | Équipement mixte, ordinateur portable personnel et téléphone Android. Usage quotidien des réseaux sociaux, aucune compétence en administration système. Se déclare prudente sur ce qu'elle publie. | Rassembler ses clichés en un seul endroit. Choisir précisément ce qui est vu et par qui. Montrer une sélection à des tiers sans leur imposer de créer un compte. | A déjà publié par erreur un album entier au lieu d'une photo. Ne comprend pas quels partages restent actifs sur son service actuel. Redoute qu'une photo privée devienne publique sans action de sa part. |

Scénario d'usage.  Léa dépose une série de trente clichés après une sortie. Tout reste privé. Elle constitue un album, choisit une couverture, puis sélectionne six photos et les publie en une seule action. Elle envoie l'adresse de son profil public à un collectif. Deux jours plus tard, elle dépublie deux clichés qui ne lui plaisent plus, et vérifie qu'ils ont bien disparu du profil public.


##### P2  Thomas Bertin, 45 ans, directeur artistique   (acteur  Visiteur)

| Profil démographique | Comportement technologique | Objectifs | Frustrations |
| --- | --- | --- | --- |
| Directeur artistique dans une agence parisienne. Consulte des portfolios plusieurs fois par semaine pour repérer des profils. | Navigue au bureau sur un poste verrouillé, sans droit d'installation. Refuse par principe de créer un compte pour consulter un travail. Attentif au temps de chargement. | Voir un travail immédiatement, sans friction. Retrouver un profil par son nom. Partager une adresse à ses associés. | Les services de partage lui imposent une inscription ou une application. Les liens de partage expirent sans prévenir. Les galeries lourdes s'affichent mal sur un poste ancien. |

Scénario d'usage.  Thomas reçoit une adresse de profil. La page s'affiche sans inscription ni script lourd. Il parcourt la galerie publiée, consulte la biographie, puis transmet l'adresse telle quelle. Il revient une semaine plus tard, la page est à jour.


##### P3  Sofia Nadir, 34 ans, développeuse indépendante   (acteur  Client API)

| Profil démographique | Comportement technologique | Objectifs | Frustrations |
| --- | --- | --- | --- |
| Développeuse indépendante, réalise des sites vitrines pour des artistes. Cherche à automatiser l'alimentation des galeries de ses clients. | Très à l'aise techniquement. Lit une spécification OpenAPI avant toute intégration. Exige de pouvoir révoquer un accès en cas d'incident. | Accéder par programme à une bibliothèque avec l'accord de son propriétaire. Disposer d'un contrat d'interface stable et documenté. Révoquer un accès instantanément. | Les API grand public sont fermées ou soumises à validation commerciale. Les clés ne sont pas rotatives. La documentation est incomplète sur les cas d'erreur. |

Scénario d'usage.  Sofia obtient une clé d'API générée par sa cliente. Elle lit la spécification, appelle les points d'accès publics, construit une galerie synchronisée. Après la livraison, sa cliente fait tourner la clé, ce qui invalide l'accès immédiatement sans toucher au reste du compte.


##### P4  Karim Boussaïd, 38 ans, ingénieur d'exploitation   (acteur  Exploitant DevOps)

| Profil démographique | Comportement technologique | Objectifs | Frustrations |
| --- | --- | --- | --- |
| Ingénieur d'exploitation, seul sur l'astreinte de la plateforme. Intervient depuis un poste distant, parfois hors des heures de bureau. | Expert en infrastructure et en conteneurisation. Travaille en ligne de commande. Refuse toute action manuelle non reproductible. | Savoir en moins d'une minute si la plateforme est saine. Reconstruire un nœud perdu par le code. Restaurer une base sans improviser. | Les alertes trop nombreuses finissent ignorées. Les procédures de reprise ne sont vérifiées qu'au moment de l'incident. La documentation d'exploitation est souvent périmée. |

Scénario d'usage.  Karim reçoit une alerte de cible injoignable. Il ouvre le tableau de bord, identifie le nœud, relance le provisionnement par le code, puis vérifie le retour à la normale des métriques. Le mois suivant, il déclenche une restauration de test et mesure l'écart avec l'objectif de reprise annoncé.
