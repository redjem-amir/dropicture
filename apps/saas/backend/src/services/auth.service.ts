// dropicture/apps/saas/backend/src/services/auth.service.ts
/**
 * Socle d'authentification par session opaque. Regroupe les paramètres de sécurité partagés
 * (nom du cookie, durées de vie, options Argon2id, options de cookie) et le service qui crée,
 * résout, fait tourner et révoque les sessions.
 *
 * @remarks Aucun jeton signé n'est émis. Le client ne détient qu'un cookie httpOnly de la forme
 * `identifiantDeSession.nonce`, la totalité de l'état vit dans Redis sous la clé `session:<sid>`
 * et la validité globale d'un compte est pilotée par la colonne `tokenVersion` en base.
 */
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { CookieOptions } from 'express';
import { Account } from '../models/account.entity';
import { RedisService } from './redis.service';

/**
 * Nom unique du cookie d'authentification. Un seul cookie transporte l'identifiant de session et
 * le nonce, ce qui évite un second cookie de rafraîchissement à protéger et à faire expirer.
 */
export const AUTH_COOKIES = { SESSION: 'session' } as const;

/**
 * Durée de la fenêtre d'accès, cinq minutes. Le client doit repasser par la rotation à cette
 * cadence, ce qui borne à cinq minutes l'exploitation d'un cookie capturé avant détection.
 */
export const ACCESS_TOKEN_TTL_SECONDS = 5 * 60;
/**
 * Inactivité tolérée, trente minutes. Cette valeur sert de TTL glissant sur la clé Redis, donc
 * l'expiration par inactivité est portée par Redis lui-même sans tâche de purge applicative.
 */
export const IDLE_TIMEOUT_SECONDS = 30 * 60;
/**
 * Plafond absolu de vie d'une session, huit heures, soit une journée de travail. Une session
 * utilisée en continu finit obligatoirement par tomber, ce qui impose une réauthentification.
 */
export const ABSOLUTE_TIMEOUT_SECONDS = 8 * 60 * 60;
/**
 * Sursis de trente secondes accordé à l'ancien nonce après une rotation. Absorbe les requêtes
 * parallèles et les rejeux dus au réseau, sans quoi une simple concurrence déclencherait la
 * révocation totale du compte réservée au vol de cookie.
 */
export const REFRESH_GRACE_WINDOW_SECONDS = 30;

/** Écriture glissante de `lastUsedAt` au maximum toutes les trente secondes, pour ne pas réécrire la session à chaque requête. */
const SESSION_SLIDING_WRITE_THROTTLE_SECONDS = 30;
/** Durée de vie du verrou de rotation, cinq secondes, afin qu'un processus interrompu ne bloque pas durablement la session. */
const ROTATE_LOCK_TTL_SECONDS = 5;
/** Nombre de sondages effectués par un appelant qui n'a pas obtenu le verrou de rotation. */
const ROTATE_LOCK_WAIT_ATTEMPTS = 6;
/** Pause entre deux sondages du verrou, soit au plus cent cinquante millisecondes d'attente cumulée avant abandon. */
const ROTATE_LOCK_WAIT_INTERVAL_MS = 25;
/** Fréquence maximale de mise à jour de `lastSeenAt`, cinq minutes, pour limiter les écritures en base sur un usage intensif. */
const LAST_SEEN_THROTTLE_MS = 5 * 60 * 1000;

/** Bascule d'environnement, seule à conditionner l'attribut `secure` du cookie de session. */
const isProd = process.env.NODE_ENV === 'production';

/**
 * Paramètres de dérivation des empreintes de mot de passe, partagés par l'inscription, la connexion
 * et le changement de mot de passe pour que la vérification retrouve toujours le même coût.
 *
 * @remarks `algorithm: 2` désigne Argon2id dans `@node-rs/argon2`, la variante résistante à la fois
 * aux attaques par canal auxiliaire et aux compromis temps mémoire. Le triplet dix neuf mégaoctets
 * de mémoire, deux passes et un fil de calcul reprend le profil recommandé par l'OWASP, calibré pour
 * rester tenable sur un seul cœur applicatif. L'empreinte fait trente deux octets.
 */
export const ARGON2_OPTIONS = {
  algorithm: 2,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
};

/**
 * Vingt quatre octets tirés au hasard, soit cent quatre vingt douze bits d'entropie. L'encodage
 * base64url produit trente deux caractères, ce qui reste sous la longueur de la colonne `apiKey`.
 */
const API_KEY_BYTES = 24;

/**
 * Tire une clé d'API aléatoire destinée aux appels serveur à serveur.
 *
 * @returns Chaîne de trente deux caractères en base64url, sûre dans une URL comme dans un en-tête.
 * @remarks S'appuie sur le générateur cryptographique de Node, pas sur `Math.random`. La clé n'est
 * pas dérivée du compte, elle ne divulgue donc rien sur son porteur et reste révocable par simple
 * remplacement en base.
 */
export function generateApiKey(): string {
  return `${randomBytes(API_KEY_BYTES).toString('base64url')}`;
}

/**
 * Options appliquées à chaque dépôt et à chaque suppression du cookie de session.
 *
 * @remarks `httpOnly` retire le cookie de la portée de JavaScript, ce qui neutralise le vol par
 * injection de script. `secure` suit l'environnement afin que le développement local en HTTP reste
 * praticable tout en imposant HTTPS en production. `sameSite` en mode `lax` bloque l'envoi du cookie
 * sur les requêtes intersites déclenchées en fond, ce qui couvre la falsification de requête, tout
 * en préservant l'arrivée depuis un lien externe. Le chemin racine rend le cookie visible de toute
 * l'API, condition pour que la déconnexion l'efface avec les mêmes attributs.
 */
export const SESSION_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax',
  path: '/',
};

/** Identité minimale injectée dans la requête après résolution de session, réduite à l'identifiant du compte. */
export interface AuthenticatedUser {
  sub: string;
}

/** Empreinte du client observée lors de la création ou de la rotation d'une session, conservée à titre de traçabilité. */
export interface SessionContext {
  userAgent?: string;
  ip?: string;
}

/**
 * Contenu sérialisé de la clé Redis `session:<sid>`, seule source de vérité d'une session.
 *
 * @remarks `nonce` est la part secrète confiée au client et remplacée à chaque rotation, sa
 * comparaison sert de détecteur de rejeu. `tokenVersion` est la copie figée de la valeur du compte
 * au moment de la connexion, toute divergence invalide la session. `absoluteExpiresAt` est un
 * plafond qu'aucun renouvellement ne repousse, tandis que `lastUsedAt` alimente le TTL glissant et
 * `accessExpiresAt` la fenêtre d'accès courte. `userAgent` est tronqué à deux cents caractères pour
 * borner la taille de l'enregistrement.
 */
export interface SessionRecord {
  nonce: string;
  accountId: string;
  tokenVersion: number;
  startedAt: number;
  lastUsedAt: number;
  absoluteExpiresAt: number;
  accessExpiresAt: number;
  userAgent?: string;
  ip?: string;
}

/** Session prête à être posée en cookie, avec la valeur `sid.nonce` et l'âge maximal à déclarer au navigateur. */
export interface IssuedSession {
  cookie: string;
  maxAgeSeconds: number;
}

/** Résultat d'une résolution réussie, identité du porteur et deux bornes temporelles exposables au client. */
export interface ResolvedSession {
  user: AuthenticatedUser;
  accessExpiresAt: number;
  absoluteExpiresAt: number;
}

/** Calcule le TTL Redis d'une session, borné par l'inactivité tolérée, par l'échéance absolue et par une seconde au minimum. */
function sessionTtl(absoluteExpiresAt: number, now: number): number {
  return Math.max(1, Math.min(IDLE_TIMEOUT_SECONDS, absoluteExpiresAt - now));
}

/**
 * Service de gestion du cycle de vie des sessions. Couvre l'émission du cookie, sa résolution à
 * chaque requête protégée, sa rotation périodique, la déconnexion d'une session et la révocation
 * de toutes les sessions d'un compte.
 *
 * @remarks Trois garde fous structurent la sécurité. Le nonce change à chaque rotation et son
 * ancienne valeur n'est acceptée que pendant la fenêtre de sursis, un nonce inconnu au delà de ce
 * sursis est traité comme un vol et provoque la révocation de tout le compte. La rotation est
 * protégée par un verrou Redis afin que deux requêtes concurrentes ne produisent pas deux sessions
 * divergentes. Enfin la comparaison de `tokenVersion` entre l'enregistrement Redis et la base
 * permet d'invalider immédiatement toutes les sessions sans avoir à les énumérer.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    private readonly redis: RedisService,
  ) {}

  /**
   * Ouvre une session pour un compte déjà authentifié et retourne la valeur à poser en cookie.
   *
   * @remarks Tire un identifiant de session de trente deux octets et un nonce de seize octets avec
   * le générateur cryptographique de Node, puis écrit l'enregistrement en une seule commande SETEX
   * sous `session:<sid>`. Le TTL initial vaut l'inactivité tolérée, jamais plus que le temps
   * restant avant l'échéance absolue. L'agent utilisateur est tronqué à deux cents caractères pour
   * empêcher qu'un en-tête surdimensionné gonfle l'enregistrement. La `tokenVersion` du compte est
   * recopiée à cet instant, elle servira de référence à toutes les vérifications ultérieures.
   * @param account - Compte dont l'identité et la `tokenVersion` sont figées dans la session.
   * @param ctx - Agent utilisateur et adresse IP observés, conservés à titre de traçabilité, vide par défaut.
   * @returns Objet portant `cookie` à la forme `sid.nonce` et `maxAgeSeconds`, l'âge maximal à déclarer au navigateur.
   */
  async createSession(account: Account, ctx: SessionContext = {}): Promise<IssuedSession> {
    const now = Math.floor(Date.now() / 1000);
    const sid = randomBytes(32).toString('base64url');
    const nonce = randomBytes(16).toString('base64url');
    const absoluteExpiresAt = now + ABSOLUTE_TIMEOUT_SECONDS;
    const ttl = sessionTtl(absoluteExpiresAt, now);
    const record: SessionRecord = {
      nonce,
      accountId: account.id,
      tokenVersion: account.tokenVersion,
      startedAt: now,
      lastUsedAt: now,
      absoluteExpiresAt,
      accessExpiresAt: now + ACCESS_TOKEN_TTL_SECONDS,
      userAgent: ctx.userAgent?.slice(0, 200),
      ip: ctx.ip,
    };
    await this.redis.cache.setex(`session:${sid}`, ttl, JSON.stringify(record));
    return { cookie: `${sid}.${nonce}`, maxAgeSeconds: ttl };
  }

  /**
   * Valide la valeur d'un cookie de session et retourne l'identité du porteur.
   *
   * @remarks Découpe le cookie sur le premier point, ce qui autorise un nonce contenant lui même ce
   * caractère. Rejette sans exception un cookie mal formé, une clé Redis absente ou un contenu
   * illisible, ce dernier cas déclenchant en plus la suppression de la clé. Un nonce qui ne
   * correspond pas est d'abord recherché dans la fenêtre de sursis `session:rotated:<sid>:<nonce>`,
   * son absence est journalisée comme vol probable puis entraîne la suppression de la session et la
   * révocation de toutes les sessions du compte. La lecture en base ne ramène que `tokenVersion` et
   * la comparaison n'est appliquée que si le compte est retrouvé. La prolongation glissante réécrit
   * la session au plus une fois toutes les trente secondes, en ignorant l'échec éventuel de cette
   * écriture puisqu'elle n'est pas nécessaire à la réponse.
   * @param cookie - Valeur brute du cookie de session, attendue à la forme `sid.nonce`.
   * @returns Identité sous la forme `user.sub` égale à l'identifiant du compte, échéance de la fenêtre
   * d'accès et échéance absolue, ou `null` si la session est invalide, expirée ou révoquée.
   */
  async resolveSession(cookie: string): Promise<ResolvedSession | null> {
    const dot = cookie.indexOf('.');
    if (dot <= 0 || dot === cookie.length - 1) return null;
    const sid = cookie.slice(0, dot);
    const nonce = cookie.slice(dot + 1);
    const now = Math.floor(Date.now() / 1000);
    const raw = await this.redis.cache.get(`session:${sid}`);
    if (!raw) return null;
    let record: SessionRecord;
    try {
      record = JSON.parse(raw) as SessionRecord;
    } catch {
      await this.redis.cache.del(`session:${sid}`).catch(() => undefined);
      return null;
    }
    if (record.nonce !== nonce) {
      const grace = await this.redis.cache.get(`session:rotated:${sid}:${nonce}`);
      if (!grace) {
        this.logger.warn(`Session nonce mismatch (possible theft) sid=${sid} account=${record.accountId}`);
        await this.redis.cache.del(`session:${sid}`);
        await this.revokeAllTokens(record.accountId);
        return null;
      }
    }
    if (now >= record.absoluteExpiresAt) {
      await this.redis.cache.del(`session:${sid}`);
      return null;
    }
    const account = await this.accountRepository.findOne({
      where: { id: record.accountId },
      select: { tokenVersion: true },
    });
    if (account && account.tokenVersion !== record.tokenVersion) {
      await this.redis.cache.del(`session:${sid}`);
      return null;
    }
    if (now - record.lastUsedAt > SESSION_SLIDING_WRITE_THROTTLE_SECONDS) {
      record.lastUsedAt = now;
      await this.redis.cache.setex(`session:${sid}`, sessionTtl(record.absoluteExpiresAt, now), JSON.stringify(record)).catch(() => undefined);
    }
    return {
      user: { sub: record.accountId },
      accessExpiresAt: record.accessExpiresAt,
      absoluteExpiresAt: record.absoluteExpiresAt,
    };
  }

  /**
   * Fait tourner le nonce d'une session valide et retourne le nouveau cookie à poser.
   *
   * @remarks Prend d'abord un verrou `lock:rotate:<sid>` en SET NX EX de cinq secondes, si bien
   * qu'une seule requête fait tourner la session à un instant donné. L'appelant qui n'obtient pas le
   * verrou sonde jusqu'à six fois toutes les vingt cinq millisecondes la clé de sursis pour récupérer
   * le cookie produit par le gagnant, ce qui rend deux rafraîchissements simultanés idempotents. Si
   * l'enregistrement n'est plus lisible pendant cette attente, l'âge maximal retourné retombe sur
   * l'inactivité tolérée. Le nonce sortant reste échangeable trente secondes, écriture de la session
   * et pose du sursis étant regroupées dans un pipeline. Un nonce déjà consommé hors de ce sursis est
   * journalisé comme rejeu et provoque la suppression de la session ainsi que la révocation de toutes
   * celles du compte. L'échéance absolue n'est jamais repoussée. La date de dernière activité en base
   * n'est réécrite que si elle est absente ou vieille de plus de cinq minutes, sans attendre le
   * résultat de la requête. Le verrou est toujours relâché, y compris sur sortie en exception.
   * @param cookie - Valeur brute du cookie de session courant, attendue à la forme `sid.nonce`.
   * @param ctx - Agent utilisateur et adresse IP à rafraîchir dans la session, seules les valeurs fournies écrasent les précédentes.
   * @returns Objet portant le nouveau `cookie` à la forme `sid.nouveauNonce` et `maxAgeSeconds` recalculé.
   * @throws UnauthorizedException `Invalid session` avec le statut 401 si le cookie ne contient pas de séparateur exploitable.
   * @throws UnauthorizedException `Rotation in progress` avec le statut 401 si le verrou reste pris après les six sondages.
   * @throws UnauthorizedException `Session expired (idle)` avec le statut 401 si la clé Redis a expiré par inactivité.
   * @throws UnauthorizedException `Corrupt session` avec le statut 401 si l'enregistrement n'est pas désérialisable, la clé étant alors supprimée.
   * @throws UnauthorizedException `Refresh token reuse detected` avec le statut 401 si le nonce présenté est hors sursis, ce qui révoque tout le compte.
   * @throws UnauthorizedException `Session absolute expired` avec le statut 401 si le plafond de huit heures est atteint.
   * @throws UnauthorizedException `Account not found` avec le statut 401 si le compte a disparu pendant la session.
   * @throws UnauthorizedException `Token revoked` avec le statut 401 si la `tokenVersion` en base diverge de celle figée dans la session.
   */
  async rotateSession(cookie: string, ctx: SessionContext = {}): Promise<IssuedSession> {
    const dot = cookie.indexOf('.');
    if (dot <= 0 || dot === cookie.length - 1) throw new UnauthorizedException('Invalid session');
    const sid = cookie.slice(0, dot);
    const nonce = cookie.slice(dot + 1);
    const now = Math.floor(Date.now() / 1000);
    const lock = await this.redis.cache.set(`lock:rotate:${sid}`, '1', 'EX', ROTATE_LOCK_TTL_SECONDS, 'NX');
    if (lock !== 'OK') {
      for (let i = 0; i < ROTATE_LOCK_WAIT_ATTEMPTS; i++) {
        await new Promise((r) => setTimeout(r, ROTATE_LOCK_WAIT_INTERVAL_MS));
        const rotated = await this.redis.cache.get(`session:rotated:${sid}:${nonce}`);
        if (!rotated) continue;

        let absoluteExpiresAt = now + IDLE_TIMEOUT_SECONDS;
        const raw = await this.redis.cache.get(`session:${sid}`);
        if (raw) {
          try {
            absoluteExpiresAt = (JSON.parse(raw) as SessionRecord).absoluteExpiresAt;
          } catch {
            /* on garde la valeur par défaut */
          }
        }
        return {
          cookie: rotated,
          maxAgeSeconds: sessionTtl(absoluteExpiresAt, now),
        };
      }
      throw new UnauthorizedException('Rotation in progress');
    }
    try {
      const raw = await this.redis.cache.get(`session:${sid}`);
      if (!raw) throw new UnauthorizedException('Session expired (idle)');
      let record: SessionRecord;
      try {
        record = JSON.parse(raw) as SessionRecord;
      } catch {
        await this.redis.cache.del(`session:${sid}`);
        throw new UnauthorizedException('Corrupt session');
      }
      if (record.nonce !== nonce) {
        const rotated = await this.redis.cache.get(`session:rotated:${sid}:${nonce}`);
        if (rotated) {
          return {
            cookie: rotated,
            maxAgeSeconds: sessionTtl(record.absoluteExpiresAt, now),
          };
        }
        this.logger.warn(`Refresh reuse detected sid=${sid} account=${record.accountId}`);
        await this.redis.cache.del(`session:${sid}`);
        await this.revokeAllTokens(record.accountId);
        throw new UnauthorizedException('Refresh token reuse detected');
      }
      if (now >= record.absoluteExpiresAt) {
        await this.redis.cache.del(`session:${sid}`);
        throw new UnauthorizedException('Session absolute expired');
      }
      const account = await this.accountRepository.findOne({
        where: { id: record.accountId },
      });
      if (!account) throw new UnauthorizedException('Account not found');
      if (account.tokenVersion !== record.tokenVersion) {
        await this.redis.cache.del(`session:${sid}`);
        throw new UnauthorizedException('Token revoked');
      }
      const oldNonce = record.nonce;
      record.nonce = randomBytes(16).toString('base64url');
      record.lastUsedAt = now;
      record.accessExpiresAt = now + ACCESS_TOKEN_TTL_SECONDS;
      if (ctx.userAgent) record.userAgent = ctx.userAgent.slice(0, 200);
      if (ctx.ip) record.ip = ctx.ip;
      const newCookie = `${sid}.${record.nonce}`;
      const ttl = sessionTtl(record.absoluteExpiresAt, now);
      await this.redis.cache.pipeline().setex(`session:${sid}`, ttl, JSON.stringify(record)).setex(`session:rotated:${sid}:${oldNonce}`, REFRESH_GRACE_WINDOW_SECONDS, newCookie).exec();
      if (!account.lastSeenAt || Date.now() - account.lastSeenAt.getTime() > LAST_SEEN_THROTTLE_MS) {
        this.accountRepository.update({ id: account.id }, { lastSeenAt: new Date() }).catch(() => undefined);
      }
      return { cookie: newCookie, maxAgeSeconds: ttl };
    } finally {
      await this.redis.cache.del(`lock:rotate:${sid}`).catch(() => undefined);
    }
  }

  /**
   * Ferme la session portée par un cookie, opération de déconnexion unitaire.
   *
   * @remarks Ne supprime que la clé `session:<sid>`, la fenêtre de sursis éventuellement en cours
   * n'est pas purgée mais devient inexploitable puisque la session référencée n'existe plus. Le nonce
   * n'est pas vérifié, la suppression porte sur le seul identifiant de session. Un cookie sans
   * séparateur ou commençant par un point est ignoré en silence, ce qui rend l'appel sans effet.
   * @param cookie - Valeur brute du cookie de session à invalider.
   * @returns Rien, l'absence de session correspondante n'est pas signalée.
   */
  async revokeSessionCookie(cookie: string): Promise<void> {
    const dot = cookie.indexOf('.');
    if (dot <= 0) return;
    await this.redis.cache.del(`session:${cookie.slice(0, dot)}`);
  }

  /**
   * Invalide d'un coup toutes les sessions d'un compte, sur tous ses appareils.
   *
   * @remarks Incrémente la colonne `tokenVersion` du compte, ce qui suffit à périmer chaque
   * enregistrement Redis existant puisque la résolution comme la rotation comparent cette valeur à
   * celle figée à la connexion. Les clés Redis ne sont pas énumérées, le coût reste donc constant
   * quel que soit le nombre de sessions ouvertes. Sert de coupe circuit après un changement de mot de
   * passe, une détection de rejeu du nonce ou une demande de déconnexion globale.
   * @param accountId - Identifiant du compte dont l'ensemble des sessions doit être périmé.
   * @returns Rien, l'incrément est appliqué même si aucune session n'est active.
   */
  async revokeAllTokens(accountId: string): Promise<void> {
    await this.accountRepository.increment({ id: accountId }, 'tokenVersion', 1);
  }
}
