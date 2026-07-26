// dropicture/apps/saas/backend/src/controllers/discover.controller.ts
import { BadRequestException, Controller, Delete, Get, HttpCode, HttpStatus, NotFoundException, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, IsNull, Not, Repository } from 'typeorm';
import type { Request } from 'express';
import { MediaService } from '../services/media.service';
import type { AuthenticatedUser } from '../services/auth.service';
import { Account } from '../models/account.entity';
import { Media } from '../models/media.entity';
import { Follow } from '../models/follow.entity';

/**
 * Bornes de pagination du fil. `PAGE_MAX` plafonne la taille de page demandée par le client pour
 * empêcher l'aspiration du fil en une requête et garder le coût de la jointure auteurs constant,
 * `PAGE_DEFAULT` sert de taille de page quand le paramètre est absent ou non numérique.
 */
export const FEED_LIMITS = { PAGE_MAX: 80, PAGE_DEFAULT: 40 } as const;

/**
 * Contrôleur du domaine découverte. Expose le fil d'actualité paginé, les compteurs sociaux du
 * compte authentifié et la gestion des abonnements sous le préfixe /api/discover.
 *
 * @remarks Le garde `access-token` est appliqué au niveau de la classe, aucune route n'est publique
 * et l'identifiant de compte utilisé pour tous les filtrages provient de `req.user` et jamais du
 * corps ou de la requête. Chaque route porte sa propre limitation de débit, deux cent quarante
 * requêtes par minute sur le fil, cent vingt sur les statistiques et soixante sur les écritures
 * d'abonnement. La pagination est de type keyset sur le couple `publishedAt` et `id`, ce qui
 * s'appuie sur l'index partiel du média publié plutôt que sur un décalage coûteux.
 */
@ApiTags('Découverte')
@ApiCookieAuth('session')
@Controller('/api/discover')
@UseGuards(AuthGuard('access-token'))
export class DiscoverController {
  /** Injecte le service média pour la projection des vues et les dépôts comptes, médias et abonnements. */
  constructor(
    private readonly media: MediaService,
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    @InjectRepository(Media)
    private readonly mediaRepository: Repository<Media>,
    @InjectRepository(Follow)
    private readonly followRepository: Repository<Follow>,
  ) {}

  /**
   * Retourne une page du fil d'actualité des médias publiés, triée du plus récent au plus ancien.
   *
   * @remarks `GET /api/discover/feed`. Route protégée par le garde `access-token` hérité du
   * contrôleur. Limitée à deux cent quarante requêtes par minute. Seuls les médias de rôle
   * `content` dont `publishedAt` est renseigné entrent dans le fil, ce qui exclut les avatars et
   * les médias restés privés. La taille de page est ramenée dans l'intervalle un à
   * `FEED_LIMITS.PAGE_MAX`, un élément supplémentaire est demandé pour savoir s'il reste une page
   * sans compter la table. Le curseur est opaque côté client, il encode en base64url l'horodatage
   * ISO 8601 et l'identifiant du dernier élément servi, et un curseur illisible est rejeté au lieu
   * d'être ignoré silencieusement. Les auteurs, leurs avatars et l'état d'abonnement sont chargés
   * en trois requêtes groupées sur les seuls propriétaires de la page, ce qui évite le motif N+1.
   * @param req - Requête Express portant `req.user` injecté par la stratégie d'accès, dont `sub`
   * fournit l'identifiant du compte appelant.
   * @param scope - Portée du fil. La valeur `following` restreint aux médias du compte appelant et
   * de ses abonnements, toute autre valeur ou l'absence de valeur sert le fil public global.
   * @param cursor - Curseur de pagination base64url obtenu du champ `nextCursor` de l'appel
   * précédent, absent pour la première page.
   * @param limit - Taille de page souhaitée sous forme de chaîne, plafonnée à quatre-vingts et
   * ramenée à quarante si elle est absente, nulle ou non numérique.
   * @returns Objet `items` et `nextCursor`. Chaque élément de `items` reprend la vue média,
   * identifiant, nature, largeur, hauteur, durée et adresse de diffusion, complétée par
   * `publishedAt` en ISO 8601 ou nul, `mine` qui indique si le média appartient au compte appelant,
   * et `author` composé du pseudonyme, du nom complet, de la vue de l'avatar ou nul, de `following`
   * et de `self`, ou nul si le compte auteur est introuvable. `nextCursor` porte le curseur de la
   * page suivante ou nul quand la page servie est la dernière.
   * @throws BadRequestException `BAD_CURSOR` avec le statut 400 si le curseur décodé ne contient pas
   * un horodatage valide et un identifiant.
   */
  @Throttle({ default: { limit: 240, ttl: 60000 } })
  @ApiOperation({ summary: "Fil d'actualité (tout public ou abonnements)" })
  @Get('/feed')
  async feed(@Req() req: Request, @Query('scope') scope?: string, @Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    const { sub } = req.user as AuthenticatedUser;
    const take = Math.min(FEED_LIMITS.PAGE_MAX, Math.max(1, Number(limit) || FEED_LIMITS.PAGE_DEFAULT));
    const qb = this.mediaRepository
      .createQueryBuilder('m')
      .where("m.role = 'content'")
      .andWhere('m.publishedAt IS NOT NULL')
      .orderBy('m.publishedAt', 'DESC')
      .addOrderBy('m.id', 'DESC')
      .limit(take + 1);
    if (scope === 'following') {
      const following = await this.followRepository.find({
        where: { followerId: sub },
        select: { followingId: true },
      });
      qb.andWhere('m.ownerId IN (:...ids)', { ids: [sub, ...following.map((f) => f.followingId)] });
    }
    if (cursor) {
      const [iso, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
      const ts = new Date(iso);
      if (Number.isNaN(ts.getTime()) || !id) throw new BadRequestException({ code: 'BAD_CURSOR' });
      qb.andWhere(
        new Brackets((w) => {
          w.where('m.publishedAt < :ts', { ts }).orWhere(
            new Brackets((x) => {
              x.where('m.publishedAt = :ts', { ts }).andWhere('m.id < :id', { id });
            }),
          );
        }),
      );
    }
    const rows = await qb.getMany();
    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;
    if (!items.length) return { items: [], nextCursor: null };
    const ownerIds = Array.from(new Set(items.map((m) => m.ownerId)));
    const accounts = await this.accountRepository.find({ where: { id: In(ownerIds) } });
    const avatarIds = accounts.map((a) => a.avatarMediaId).filter((v): v is string => !!v);
    const avatars = avatarIds.length ? await this.mediaRepository.find({ where: { id: In(avatarIds) } }) : [];
    const avatarById = new Map(avatars.map((m) => [m.id, m]));
    const followed = await this.followRepository.find({
      where: { followerId: sub, followingId: In(ownerIds) },
      select: { followingId: true },
    });
    const followedIds = new Set(followed.map((f) => f.followingId));
    const authorById = new Map(
      accounts.map((a) => {
        const avatar = a.avatarMediaId ? avatarById.get(a.avatarMediaId) : undefined;
        return [
          a.id,
          {
            username: a.username,
            name: `${a.firstname} ${a.lastname}`.trim(),
            avatar: avatar ? this.media.view(avatar) : null,
            following: followedIds.has(a.id),
            self: a.id === sub,
          },
        ] as const;
      }),
    );
    const last = items[items.length - 1];
    const nextCursor = hasMore && last?.publishedAt ? Buffer.from(`${last.publishedAt.toISOString()}|${last.id}`).toString('base64url') : null;
    return {
      items: items.map((m) => ({
        ...this.media.view(m),
        publishedAt: m.publishedAt?.toISOString() ?? null,
        mine: m.ownerId === sub,
        author: authorById.get(m.ownerId) ?? null,
      })),
      nextCursor,
    };
  }

  /**
   * Retourne les compteurs sociaux du compte authentifié et la volumétrie de la communauté.
   *
   * @remarks `GET /api/discover/me`. Route protégée par le garde `access-token` hérité du
   * contrôleur. Limitée à cent vingt requêtes par minute. Les quatre agrégats sont exécutés en
   * parallèle, trois comptages indexés et une agrégation brute qui dénombre les auteurs distincts
   * et les médias du fil public. Les compteurs personnels sont dérivés du seul `sub` de la session,
   * aucun identifiant de compte n'est accepté en paramètre.
   * @param req - Requête Express portant `req.user` injecté par la stratégie d'accès, dont `sub`
   * fournit l'identifiant du compte appelant.
   * @returns `publishedMedia` pour le nombre de médias de rôle `content` publiés par le compte,
   * `following` pour le nombre d'abonnements, `followers` pour le nombre d'abonnés, et `community`
   * composé de `authors` et `media` qui donnent le nombre d'auteurs distincts et le nombre total de
   * médias publiés sur la plateforme, ramenés à zéro si l'agrégation ne retourne rien.
   */
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @ApiOperation({ summary: 'Mes statistiques sociales (abonnés, abonnements)' })
  @Get('/me')
  async me(@Req() req: Request) {
    const { sub } = req.user as AuthenticatedUser;
    const [publishedMedia, following, followers, reach] = await Promise.all([
      this.mediaRepository.count({
        where: { ownerId: sub, role: 'content', publishedAt: Not(IsNull()) },
      }),
      this.followRepository.count({ where: { followerId: sub } }),
      this.followRepository.count({ where: { followingId: sub } }),
      this.mediaRepository
        .createQueryBuilder('m')
        .select('COUNT(DISTINCT m.ownerId)', 'authors')
        .addSelect('COUNT(*)', 'media')
        .where("m.role = 'content'")
        .andWhere('m.publishedAt IS NOT NULL')
        .getRawOne<{ authors: string; media: string }>(),
    ]);
    return {
      publishedMedia,
      following,
      followers,
      community: {
        authors: Number(reach?.authors ?? 0),
        media: Number(reach?.media ?? 0),
      },
    };
  }

  /**
   * Abonne le compte authentifié au compte désigné par son pseudonyme.
   *
   * @remarks `POST /api/discover/follows/:username`. Route protégée par le garde `access-token`
   * hérité du contrôleur, répond 200 au lieu du 201 par défaut. Limitée à soixante requêtes par
   * minute. L'insertion est idempotente grâce à `orIgnore`, un abonnement déjà présent ne provoque
   * ni erreur de clé primaire ni doublon, et l'auto abonnement est refusé côté application en plus
   * de la contrainte de vérification portée par la table.
   * @param req - Requête Express portant `req.user` injecté par la stratégie d'accès, dont `sub`
   * fournit l'identifiant de l'abonné.
   * @param username - Pseudonyme du compte à suivre, résolu en identifiant avant l'écriture.
   * @returns Pseudonyme ciblé, `following` à vrai et `followers` recalculé après l'insertion.
   * @throws NotFoundException `ACCOUNT_NOT_FOUND` avec le statut 404 si aucun compte ne porte ce
   * pseudonyme.
   * @throws BadRequestException `CANNOT_FOLLOW_SELF` avec le statut 400 si le compte ciblé est celui
   * de la session.
   */
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Suivre un utilisateur' })
  @Post('/follows/:username')
  @HttpCode(HttpStatus.OK)
  async follow(@Req() req: Request, @Param('username') username: string) {
    const { sub } = req.user as AuthenticatedUser;
    const target = await this.accountRepository.findOne({ where: { username } });
    if (!target) throw new NotFoundException({ code: 'ACCOUNT_NOT_FOUND' });
    if (target.id === sub) throw new BadRequestException({ code: 'CANNOT_FOLLOW_SELF' });
    await this.followRepository.createQueryBuilder().insert().into(Follow).values({ followerId: sub, followingId: target.id }).orIgnore().execute();
    const followers = await this.followRepository.count({ where: { followingId: target.id } });
    return { username, following: true, followers };
  }

  /**
   * Résilie l'abonnement du compte authentifié au compte désigné par son pseudonyme.
   *
   * @remarks `DELETE /api/discover/follows/:username`. Route protégée par le garde `access-token`
   * hérité du contrôleur, répond 200 au lieu du 204 par défaut. Limitée à soixante requêtes par
   * minute. La suppression porte sur la clé primaire composée abonné et abonnement, elle est donc
   * idempotente et ne peut pas détruire l'abonnement d'un autre compte puisque `followerId` provient
   * de la session.
   * @param req - Requête Express portant `req.user` injecté par la stratégie d'accès, dont `sub`
   * fournit l'identifiant de l'abonné.
   * @param username - Pseudonyme du compte à ne plus suivre, résolu en identifiant avant la
   * suppression.
   * @returns Pseudonyme ciblé, `following` à faux et `followers` recalculé après la suppression.
   * @throws NotFoundException `ACCOUNT_NOT_FOUND` avec le statut 404 si aucun compte ne porte ce
   * pseudonyme.
   */
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Ne plus suivre un utilisateur' })
  @Delete('/follows/:username')
  @HttpCode(HttpStatus.OK)
  async unfollow(@Req() req: Request, @Param('username') username: string) {
    const { sub } = req.user as AuthenticatedUser;
    const target = await this.accountRepository.findOne({ where: { username } });
    if (!target) throw new NotFoundException({ code: 'ACCOUNT_NOT_FOUND' });
    await this.followRepository.delete({ followerId: sub, followingId: target.id });
    const followers = await this.followRepository.count({ where: { followingId: target.id } });
    return { username, following: false, followers };
  }
}
