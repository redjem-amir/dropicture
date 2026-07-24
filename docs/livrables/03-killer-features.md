# 03. Killer features

*Blocs RNCP · C3 (BC1), C11 (BC2), C10 (BC2), C15 (BC2)*

## Exigences attendues (⭐ Listing livrable)

- ⭐ **Description et faisabilité technique (0-10)** · C3 (BC1), C11 (BC2)
- ⭐ **Analyse SWOT pour chacune** · C3 (BC1), C10 (BC2)
- ⭐ **Effort estimé et dépendances** · C11 (BC2), C15 (BC2)

## Livrable

#### 4.  Trois killer features candidates

| Réf. | Fonctionnalité proposée | Description | Gaps couverts | Faisabilité technique (0 à 10) | Effort estimé | Dépendances |
| --- | --- | --- | --- | --- | --- | --- |
| KF1 | Privé par défaut, publication explicite et réversible par lot | Tout média déposé reste invisible tant que son propriétaire ne le publie pas. La publication est un état daté porté par la ligne, activable et révocable par lot de 200 éléments, avec qualification des échecs élément par élément. | G1, G2 | 9 | 12 j-h · 6 000 € | Modèle de données (Annexe E), API de bibliothèque (Annexe Q), séquence de publication (Annexe I.2) |
| KF2 | Profil public en page statique servie par CDN | Le profil public est exporté sans exécution serveur et diffusé depuis un CDN. Il reste consultable sans compte, indexable, et son coût de diffusion est décorrélé du nombre de visiteurs. | G3, G5 | 7 | 9 j-h · 4 500 € | Export statique Next.js, distribution CloudFront, contrainte d'adressage /u/?u=pseudo |
| KF3 | Clé d'API personnelle, rotative et révocable | Chaque membre dispose d'une clé propre pour accéder à sa bibliothèque par programme, avec génération, rotation et révocation immédiates, et unicité garantie par index partiel. | G4, G5 | 8 | 6 j-h · 3 000 € | Stratégie d'authentification (Annexe H), contrat d'interface (Annexe Q) |


#### 5.  Analyse SWOT de chaque killer feature


##### KF1  Privé par défaut, publication explicite et réversible par lot

| Forces | Faiblesses | Opportunités | Menaces |
| --- | --- | --- | --- |
| Répond à une inquiétude réelle et documentée sur la maîtrise de la visibilité. Se traduit par une règle simple, énonçable en une phrase. Coût d'implémentation faible, la visibilité étant un simple horodatage sur la ligne. | N'apporte aucune fonctionnalité visible tant que l'utilisateur n'a rien déposé. Difficile à démontrer en capture d'écran, l'absence de fuite ne se voit pas. | Aligne le produit sur le RGPD et sur la minimisation, ce qui sert aussi la conformité. Permet un discours produit clair face à des acteurs dont le modèle de visibilité est confus. | Un concurrent peut annoncer la même promesse sans la tenir techniquement. La promesse engage, une seule fuite la détruit. |


##### KF2  Profil public en page statique servie par CDN

| Forces | Faiblesses | Opportunités | Menaces |
| --- | --- | --- | --- |
| Coût de diffusion quasi nul et indépendant du trafic. Temps d'affichage très court. Aucune surface d'exécution exposée, donc surface d'attaque réduite. | Contraint l'adressage du profil à une forme /u/?u=pseudo, moins lisible qu'un chemin. Fraîcheur du contenu dépendante de l'invalidation du cache. | Ouvre l'indexation par les moteurs de recherche, donc une acquisition sans coût publicitaire. Démontre une compétence d'architecture rarement mise en œuvre à cette échelle. | Une évolution du cadre de l'export statique du framework peut casser la chaîne. Le compromis d'adressage peut être jugé sévèrement par un utilisateur non technique. |


##### KF3  Clé d'API personnelle, rotative et révocable

| Forces | Faiblesses | Opportunités | Menaces |
| --- | --- | --- | --- |
| Réversibilité démontrable, l'utilisateur peut sortir ses données par lui-même. Faible coût, l'ossature d'authentification existant déjà. | Concerne une minorité d'utilisateurs. Élargit la surface d'attaque en créant un second chemin d'authentification. | Répond au règlement européen sur les données et à l'exigence de portabilité. Ouvre un usage automatisé et des intégrations tierces. | Une clé fuitée donne un accès durable si la révocation n'est pas immédiate. Impose une limitation de débit dédiée. |
