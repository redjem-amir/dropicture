# 10 · Observabilité

Pile complète auto-hébergée sur le nœud proxy, plus des agents globaux sur chaque nœud. Collecte, stockage, restitution et alerting, avec un volet éco-conception. L'architecture d'ensemble est en Annexe P.

## Composants

| Rôle | Outil | Placement |
|---|---|---|
| Métriques | Prometheus | proxy |
| Alerting | Alertmanager | proxy |
| Journaux | Loki | proxy |
| Restitution | Grafana | proxy |
| Collecte de journaux | Alloy | global |
| Métriques hôte | node-exporter | global |
| Métriques conteneurs | cAdvisor | global |

## Métriques

`prometheus.yml` scrute Prometheus lui-même, Alertmanager, Traefik (`proxy:8082`), node-exporter (`:9100`) et cAdvisor (`:8080`), les cibles étant générées par boucle sur les adresses privées Terraform. Trois tableaux de bord Grafana sont provisionnés dans le dossier `dropicture` · vue d'ensemble, journaux, énergie.

## Journaux

Alloy collecte les journaux des conteneurs par le socket Docker et les envoie à Loki en réétiquetant service, stack, conteneur et nœud. Loki tourne en binaire unique, stockage sur système de fichiers, rétention 30 jours. Le backend produit par ailleurs un journal d'accès HTTP structuré en JSON (méthode, route, statut, débit, durée, identifiant utilisateur).

## Alerting

Les règles `prometheus-rules.yml` couvrent la disponibilité et la performance.

- Cible ou nœud injoignable.
- CPU au-dessus de 90 %, mémoire disponible sous 10 %, disque en tendance de saturation.
- Taux de 5xx au-dessus de 5 %, latence p95 au-dessus d'une seconde.
- Boucle de redémarrage d'un conteneur.

Alertmanager route par `alertname` et `severity` et inhibe les avertissements couverts par une alerte critique.

Un receiver e-mail est configuré (envoi SMTP, mot de passe fourni par le secret Docker `dropicture_alertmanager_smtp_password`, jamais dans le dépôt). Pour l'activer en production, créer ce secret et le monter sur le service Alertmanager. Le sujet des messages porte le statut et le nom de l'alerte.

## Éco-conception mesurée (green IT)

Le référentiel demande une alerte sur la consommation énergétique. Des règles d'enregistrement estiment, par nœud, la puissance en watts, l'énergie en kWh par jour et le carbone en grammes par heure, à partir de l'utilisation processeur. Une alerte se déclenche au-delà d'un seuil de puissance (de l'ordre de 200 W). Le tableau de bord `dropicture-energy.json` restitue ces estimations.

Ces estimations sont volontairement présentées comme telles. Elles servent à détecter une dérive et à arbitrer le right-sizing, pas à produire un bilan carbone certifié.

Pages liées · [Stratégie DevOps](06-strategie-devops.md) · [Conteneurisation Swarm](08-conteneurisation-swarm.md).
