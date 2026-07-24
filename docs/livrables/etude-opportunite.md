# Étude d'opportunité · projet dropicture

*Blocs RNCP · C10 (BC2)*

Étude d'opportunité formalisant la problématique, les défis, les enjeux, les besoins et la décision d'engagement du projet dropicture. Elle guide la planification et complète la note de cadrage.

## 1. Problématique

Un utilisateur qui souhaite montrer une sélection de ses photographies sans exposer toute sa bibliothèque se heurte aux services existants. La visibilité y est portée par un lien de partage plutôt que par un état du média, le passage du privé au public n'est ni groupé ni simplement annulable, aucune vitrine publique n'est accessible sans compte ni application, et l'utilisateur ne dispose d'aucun accès programmatique à sa propre bibliothèque. La question centrale est donc de rendre à l'utilisateur un contrôle réel, explicite et réversible sur la visibilité de ses médias.

## 2. Défis actuels

- **Confusion du modèle de visibilité** chez tous les acteurs grand public, avec un risque de sur-exposition involontaire.
- **Absence de réversibilité démontrable**, ni sur la localisation des données, ni sur la sortie du service.
- **Dépendance à un écosystème fermé** ou à un abonnement commercial dont la feuille de route est incertaine.
- **Barrière à l'entrée** pour montrer son travail, un compte ou une application étant imposés au visiteur.

## 3. Enjeux de la transformation

| Enjeu | Description |
|---|---|
| Confiance | faire de la publication un acte explicite, audité et réversible |
| Souveraineté | héberger en Europe, rendre l'infrastructure reconstructible par le code |
| Ouverture | offrir une vitrine publique sans compte et une clé d'API personnelle |
| Soutenabilité | maîtriser le coût et la consommation énergétique dès la conception |
| Certification | démontrer une infrastructure DevOps automatisée (bloc BC4C) |

## 4. Besoins spécifiques

- Bibliothèque privée par défaut, publication et retrait par lot, idempotents et réversibles.
- Profil public servi en page statique, indexable, sans compte ni application.
- Accès programmatique par une clé d'API personnelle, révocable et rotative.
- Automatisation intégrale de l'infrastructure et de la livraison.
- Observabilité et sécurité vérifiables, conformité RGPD.

Les besoins fonctionnels sont détaillés en personas et user stories (Annexe X), priorisés en MoSCoW.

## 5. Parties prenantes impactées

Le sponsor et pilote du projet, les utilisateurs finaux (membres et visiteurs), le référent sécurité, et les fournisseurs d'hébergement. Leur positionnement et le plan d'engagement sont décrits en Annexe O bis, la répartition des responsabilités en Annexe L bis.

## 6. Analyse externe et interne

**Lecture PESTEL synthétique**
- Réglementaire, RGPD, IA Act et Cloud Act pèsent en faveur de la souveraineté européenne et de la minimisation des données.
- Environnemental, la pression sur l'empreinte du numérique justifie le suivi énergétique et le right-sizing.
- Technologique, la maturité des conteneurs, de l'IaC et des CDN rend l'automatisation accessible à une équipe réduite.

**Lecture SWOT synthétique** (détail par fonctionnalité en Annexe W)
- Forces, modèle de visibilité clair, réversibilité, souveraineté, coût d'exploitation maîtrisé.
- Faiblesses, périmètre fonctionnel volontairement réduit, pas de recherche par contenu ni d'application mobile.
- Opportunités, manques laissés par les acteurs installés, mesure énergétique différenciante.
- Menaces, acteurs dominants aux moyens considérables, dépendance à des fournisseurs tiers.

## 7. Alternatives envisagées

| Option | Description | Décision |
|---|---|---|
| Acheter ou assembler un service existant | s'appuyer sur une solution du marché | écartée, ne répond ni à la réversibilité ni à la démonstration DevOps attendue |
| Auto-héberger une alternative libre (type Immich) | installer et administrer un service tiers | écartée, exclut le public visé et ne démontre pas la conception |
| Concevoir et déployer un produit dédié | construire dropicture avec une infrastructure automatisée | retenue |

## 8. Bénéfices attendus

- Un produit différenciant sur le contrôle de la visibilité et la réversibilité.
- Une infrastructure reproductible, observée et sécurisée, à coût d'exploitation maîtrisé.
- Un dossier de certification couvrant les quatre blocs, dont l'option DevOps.

## 9. Décision

Le projet est engagé sur l'option « concevoir et déployer un produit dédié ». Cette décision est cohérente avec la matrice de décision pondérée qui retient la fonctionnalité fondatrice (publication privée explicite et réversible) et reclasse les autres propositions en fonctionnalités de la feuille de route (Annexe W). La suite est cadrée par la note de cadrage (`note-de-cadrage.md`) et planifiée en Annexes M et N.
