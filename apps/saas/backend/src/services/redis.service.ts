// dropicture/apps/saas/backend/src/services/redis.service.ts
/**
 * Accès Redis du backend SaaS. Centralise les options de connexion et expose un client unique,
 * injectable, sur lequel s'appuie le stockage des sessions.
 *
 * @remarks La connexion est ouverte dès l'instanciation du service et refermée à la destruction du
 * module, ce qui évite les connexions orphelines à chaque redéploiement. Aucun secret n'est inscrit
 * dans le code, l'hôte provient de l'environnement et son absence est bloquante en production.
 */
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

/** Bascule d'environnement. Elle seule décide si une variable de connexion manquante fait échouer le démarrage. */
const isProd = process.env.NODE_ENV === 'production';

/**
 * Lit une variable d'environnement en exigeant sa présence en production et en tolérant une valeur
 * de repli ailleurs, pour qu'un poste de développement démarre sans configuration préalable.
 *
 * @param name - Nom de la variable d'environnement à lire.
 * @param fallback - Valeur retenue hors production quand la variable est absente ou vide.
 * @returns Valeur de la variable, ou la valeur de repli hors production.
 * @throws Error si la variable est absente ou vide alors que `NODE_ENV` vaut `production`, de sorte
 * qu'un défaut de configuration se manifeste au chargement du module et non à la première commande.
 */
function env(name: string, fallback: string): string {
  const value = process.env[name];
  if (value) return value;
  if (isProd) throw new Error(`${name} is required in production`);
  return fallback;
}

/**
 * Options de connexion du client de cache, sorties de la classe pour être partagées entre la
 * création du client et les traces de connexion.
 *
 * @remarks La base `0` est celle par défaut, aucun cloisonnement logique n'est utilisé. Le délai de
 * connexion de dix secondes empêche un démarrage de rester suspendu sur un serveur injoignable. La
 * stratégie de reprise espace les tentatives de cent millisecondes par essai et plafonne l'attente à
 * trois secondes, ce qui évite d'inonder un Redis en redémarrage tout en reconnectant vite. La
 * limite de trois tentatives par commande fait échouer rapidement une requête plutôt que d'empiler
 * des commandes en attente et de propager la latence à l'API.
 */
export const REDIS_CACHE_OPTIONS = {
  db: 0,
  connectTimeout: 10_000,
  retryStrategy: (times: number) => Math.min(times * 100, 3_000),
  host: env('REDIS_CACHE_HOST_DROPICTURE_SAAS', '127.0.0.1'),
  port: 6379,
  maxRetriesPerRequest: 3,
};

/**
 * Service d'infrastructure porteur du client Redis du backend. Fournit la connexion `cache`
 * consommée par la gestion des sessions et la libère à l'arrêt du module.
 *
 * @remarks La connexion est nommée `saas-backend:cache`, ce nom remonte dans `CLIENT LIST` côté
 * serveur et permet d'imputer une connexion à ce processus lors d'un incident. Les évènements de
 * connexion, de reconnexion et d'erreur sont tracés sans être relancés, une panne Redis n'arrête donc
 * pas le processus, ioredis rétablit la connexion seul selon la stratégie de reprise configurée.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  /** Journal dédié, préfixé du nom de la classe, pour distinguer les traces Redis du reste de l'application. */
  private readonly logger = new Logger(RedisService.name);

  /** Client Redis partagé par tous les consommateurs du service, ouvert une seule fois par processus. */
  readonly cache = new Redis({
    ...REDIS_CACHE_OPTIONS,
    connectionName: 'saas-backend:cache',
  });

  /** Abonne le client aux évènements de cycle de vie afin de tracer connexion, reconnexion et erreurs. */
  constructor() {
    this.cache.on('connect', () => this.logger.log(`Redis cache connected (${REDIS_CACHE_OPTIONS.host}:${REDIS_CACHE_OPTIONS.port})`));
    this.cache.on('reconnecting', (delay: number) => this.logger.warn(`Redis cache reconnecting in ${delay}ms`));
    this.cache.on('error', (err: Error) => this.logger.error(`Redis cache error: ${err.message}`));
  }

  /**
   * Ferme la connexion Redis lors de l'arrêt du module Nest.
   *
   * @returns Promesse résolue une fois la connexion close, quelle que soit la voie empruntée.
   * @remarks Un `QUIT` est tenté en premier pour laisser le serveur achever les commandes en cours,
   * puis une déconnexion immédiate prend le relais si cet arrêt propre échoue. L'arrêt du processus
   * ne peut donc pas rester bloqué sur une connexion déjà rompue.
   */
  async onModuleDestroy(): Promise<void> {
    try {
      await this.cache.quit();
    } catch {
      this.cache.disconnect();
    }
  }
}
