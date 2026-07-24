# 02. Benchmark concurrentiel

*Blocs RNCP · C1 (BC1), C10 (BC2), C11 (BC2)*

## Exigences attendues (⭐ Listing livrable)

- ⭐ **Tableau comparatif de 2+ solutions (Google Photos, iCloud, etc.)** · C1 (BC1), C10 (BC2)
- ⭐ **Grille de critères, fonctionnalités, technique, UX, prix** · C1 (BC1), C11 (BC2)

## Livrable

Le marché du stockage et du partage de photographies est occupé par des acteurs installés. Prétendre s'y insérer sans avoir mesuré ce qu'ils font déjà relèverait de la conviction et non de l'analyse. Ce dossier compare cinq solutions sur une grille unique, identifie les manques qu'elles laissent, en tire trois propositions de fonctionnalité différenciante, puis les arbitre par une matrice pondérée. La fonctionnalité retenue devient la promesse fondatrice du produit.


#### 1.  Grille de critères de comparaison

Quatre familles de critères, quinze points d'observation. Chaque solution est notée de 1 à 5 sur chaque famille, la note étant la moyenne des points observés.

| Famille | Points observés | Poids retenu | Justification du poids |
| --- | --- | --- | --- |
| Fonctionnalités | Téléversement, albums, publication sélective, réseau social, recherche, export de masse | 30 % | Le produit se juge d'abord sur ce qu'il permet de faire |
| Technique | Format de stockage, ouverture de l'API, réversibilité, souveraineté de l'hébergement, chiffrement | 30 % | La réversibilité et la souveraineté sont les deux critères d'architecture du projet |
| Expérience utilisateur | Clarté du modèle de visibilité, nombre d'actions pour publier, lisibilité du profil public | 25 % | Le modèle de visibilité est précisément ce que les acteurs installés rendent confus |
| Prix et modèle économique | Gratuité d'entrée, coût au gigaoctet, exploitation de la donnée à des fins publicitaires | 15 % | Critère différenciant, mais non décisif sur un produit de démonstration |


#### 2.  Tableau comparatif des solutions existantes

| Solution | Positionnement | Fonct. | Tech. | UX | Prix | Score pondéré | Limite principale relevée |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Google Photos | Sauvegarde automatique de masse, recherche par contenu | 5 | 2 | 3 | 3 | 3,25 | Visibilité gérée par lien de partage, sans notion de bibliothèque publique. Hébergement hors Union, réversibilité faible |
| Apple iCloud Photos | Intégration native à l'écosystème matériel | 4 | 2 | 4 | 3 | 3,25 | Fermé à un seul écosystème. Aucun profil public. Pas d'API ouverte |
| Amazon Photos | Stockage adossé à un abonnement commercial | 3 | 2 | 3 | 4 | 2,90 | Produit annexe d'un abonnement, feuille de route incertaine |
| Flickr | Communauté de photographes, profil public historique | 4 | 3 | 3 | 3 | 3,30 | Modèle de visibilité complexe, interface datée, avenir économique fragile |
| Immich (auto-hébergé) | Alternative libre à installer soi-même | 4 | 5 | 2 | 5 | 4,00 | Exige d'administrer un serveur, ce qui exclut le public visé |
| dropicture (cible) | Bibliothèque privée par défaut, publication explicite et réversible | 3 | 5 | 5 | 4 | 4,25 | Périmètre fonctionnel volontairement réduit, sans recherche par contenu ni application mobile |

La lecture du tableau n'est pas flatteuse pour le projet sur le plan fonctionnel, et c'est volontaire. Face à des acteurs qui indexent le contenu par apprentissage automatique, la surenchère de fonctionnalités est perdue d'avance. L'écart se joue ailleurs, sur le contrôle réel que l'utilisateur exerce sur la visibilité de ses médias, et sur la réversibilité technique du service.


#### 3.  Gaps de marché identifiés

| Réf. | Gap constaté | Chez qui | Conséquence pour l'utilisateur | Opportunité |
| --- | --- | --- | --- | --- |
| G1 | La visibilité est portée par un lien de partage, pas par un état du média | Google, Apple, Amazon | Un média partagé une fois reste accessible à qui détient le lien, même après oubli | Faire de la publication un état réversible, stocké et audité |
| G2 | Le passage du privé au public n'est ni groupé ni annulable simplement | Tous les acteurs grand public | L'utilisateur renonce à publier plutôt que de risquer une erreur | Publication et dépublication par lot, idempotentes |
| G3 | Aucune vitrine personnelle sans compte ni application | Google, Apple, Amazon | Montrer son travail impose au visiteur de créer un compte ou d'installer une application | Profil public en page statique, indexable, servie par un CDN |
| G4 | Pas d'accès programmatique personnel à sa propre bibliothèque | Google, Apple, Amazon | L'utilisateur ne peut ni automatiser ni migrer sans outil tiers | Clé d'API personnelle, révocable et rotative |
| G5 | Souveraineté et réversibilité non démontrables | Tous sauf Immich | Aucune garantie sur la localisation ni sur la sortie des données | Hébergement européen, infrastructure reconstructible par le code |
