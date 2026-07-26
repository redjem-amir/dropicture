// dropicture/apps/saas/backend/src/controllers/public.controller.ts
import { BadRequestException, Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, IsNull, Not, Repository } from 'typeorm';
import { MediaService } from '../services/media.service';
import { Account } from '../models/account.entity';
import { Media } from '../models/media.entity';
import { Follow } from '../models/follow.entity';

/**
 * Motif autorisé pour un nom d'utilisateur reçu dans un chemin public, de un à trente caractères
 * alphanumériques, point, tiret bas ou tiret. Il rejette les segments hostiles avant toute lecture
 * en base, ce qui évite de payer une requête pour un identifiant qui ne peut pas exister.
 */
const USERNAME = /^[a-zA-Z0-9._-]{1,30}$/;

/**
 * Bornes de pagination et de recherche de l'API publique. Elles plafonnent le travail qu'un appel
 * anonyme peut déclencher, cent vingt médias par page au maximum, vingt-quatre profils en vedette
 * avec trois aperçus chacun, dix résultats de recherche et trente caractères de terme, ce qui rend
 * le coût des requêtes agrégées et fenêtrées prévisible.
 */
export const PUBLIC_LIMITS = {
  PAGE_MAX: 120,
  PAGE_DEFAULT: 48,
  FEED_DEFAULT: 24,
  PROFILES_MAX: 24,
  PROFILES_DEFAULT: 6,
  PREVIEW_PER_PROFILE: 3,
  SEARCH_MAX: 10,
  SEARCH_DEFAULT: 6,
  SEARCH_TERM_MAX: 30,
} as const;

/**
 * Contrôleur de l'API publique. Expose sans authentification les statistiques de la plateforme, la
 * recherche de profils, les profils en vedette, le fil global des publications ainsi que le profil
 * détaillé d'un compte et ses médias, sous le préfixe /api/public.
 *
 * @remarks Toute lecture de médias filtre sur le rôle `content` et sur `publishedAt` non nul, ce qui
 * cantonne l'exposition aux seuls médias explicitement publiés, les avatars étant résolus à part
 * depuis `avatarMediaId` du compte. Chaque route porte sa propre limitation de débit, cent vingt
 * requêtes par minute pour les agrégats et deux cent quarante pour les lectures paginées. Les routes
 * à segment fixe sont déclarées avant `/:username` pour que le paramètre dynamique ne les capture
 * pas. Les valeurs venant du client sont bornées côté serveur et injectées en paramètres liés.
 */
@ApiTags('API publique')
@Controller('/api/public')
export class PublicController {
  /**
   * Injecte le service média qui construit les vues publiques et les dépôts TypeORM des comptes, des
   * médias et des abonnements.
   */
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
   * Compte les médias publiés de la plateforme et le nombre d'auteurs distincts qui les ont publiés.
   *
   * @remarks `GET /api/public/stats`. Route publique, aucun garde. Limitée à cent vingt requêtes par
   * minute. L'agrégat ne retient que les médias de rôle `content` dont `publishedAt` est renseigné,
   * donc ni les avatars ni les médias importés mais non publiés.
   * @returns Objet à deux champs, `media` le nombre total de médias publiés et `authors` le nombre de
   * comptes propriétaires distincts, les deux convertis en nombres et ramenés à zéro si l'agrégat ne
   * retourne aucune ligne.
   */
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @ApiOperation({ summary: 'Statistiques publiques de la plateforme' })
  @Get('/stats')
  async stats() {
    const row = await this.mediaRepository
      .createQueryBuilder('m')
      .select('COUNT(*)', 'media')
      .addSelect('COUNT(DISTINCT m.ownerId)', 'authors')
      .where("m.role = 'content'")
      .andWhere('m.publishedAt IS NOT NULL')
      .getRawOne<{ media: string; authors: string }>();
    return { media: Number(row?.media ?? 0), authors: Number(row?.authors ?? 0) };
  }

  /**
   * Recherche des profils publics par nom d'utilisateur, prénom ou nom, et retourne les meilleures
   * correspondances avec leur nombre de médias publiés.
   *
   * @remarks `GET /api/public/search`. Route publique, aucun garde. Limitée à deux cent quarante
   * requêtes par minute. Le terme est débarrassé de ses espaces de bord, mis en minuscules, privé d'un
   * arobase de tête et tronqué à trente caractères, puis les métacaractères `\`, `%` et `_` sont
   * échappés avant d'alimenter les clauses `LIKE ... ESCAPE '\'`, ce qui empêche un motif fourni par
   * le client de balayer toute la table. Le classement place d'abord l'égalité exacte sur le nom
   * d'utilisateur, puis la correspondance de préfixe, puis le nombre de médias publiés décroissant.
   * Les avatars des résultats sont chargés en une seule requête `IN`.
   * @param q - Terme de recherche brut passé en chaîne de requête, optionnel.
   * @param limit - Nombre de résultats demandé, borné entre un et dix, six par défaut.
   * @returns Objet à deux champs, `term` le terme normalisé et `profiles` la liste des
   * correspondances. Chaque correspondance porte `username`, `name` composé du prénom et du nom,
   * `bio`, `avatar` sous forme de vue média ou `null`, et `photos` le nombre de médias publiés. La
   * liste est vide quand le terme normalisé est vide ou qu'aucun compte ne correspond.
   */
  @Throttle({ default: { limit: 240, ttl: 60000 } })
  @ApiOperation({ summary: 'Rechercher des profils publics' })
  @Get('/search')
  async search(@Query('q') q?: string, @Query('limit') limit?: string) {
    const term = (q ?? '').trim().toLowerCase().replace(/^@/, '').slice(0, PUBLIC_LIMITS.SEARCH_TERM_MAX);
    if (!term) return { term: '', profiles: [] };
    const escaped = term.replace(/[\\%_]/g, (c) => `\\${c}`);
    const take = Math.min(PUBLIC_LIMITS.SEARCH_MAX, Math.max(1, Number(limit) || PUBLIC_LIMITS.SEARCH_DEFAULT));

    const rows = await this.accountRepository
      .createQueryBuilder('a')
      .leftJoin(Media, 'm', "m.ownerId = a.id AND m.role = 'content' AND m.publishedAt IS NOT NULL")
      .select('a.id', 'id')
      .addSelect('a.username', 'username')
      .addSelect('a.firstname', 'firstname')
      .addSelect('a.lastname', 'lastname')
      .addSelect('a.bio', 'bio')
      .addSelect('a.avatarMediaId', 'avatarMediaId')
      .addSelect('COUNT(m.id)', 'photos')
      .where(
        new Brackets((w) => {
          w.where("LOWER(a.username) LIKE :like ESCAPE '\\'").orWhere("LOWER(a.firstname) LIKE :like ESCAPE '\\'").orWhere("LOWER(a.lastname) LIKE :like ESCAPE '\\'");
        }),
      )
      .groupBy('a.id')
      .orderBy(
        `CASE
           WHEN LOWER(a.username) = :exact THEN 0
           WHEN LOWER(a.username) LIKE :prefix ESCAPE '\\' THEN 1
           ELSE 2
         END`,
        'ASC',
      )
      .addOrderBy('COUNT(m.id)', 'DESC')
      .addOrderBy('a.username', 'ASC')
      .setParameters({ like: `%${escaped}%`, prefix: `${escaped}%`, exact: term })
      .limit(take)
      .getRawMany<{
        id: string;
        username: string;
        firstname: string;
        lastname: string;
        bio: string | null;
        avatarMediaId: string | null;
        photos: string;
      }>();

    if (!rows.length) return { term, profiles: [] };

    const avatarIds = rows.map((r) => r.avatarMediaId).filter((v): v is string => !!v);
    const avatars = avatarIds.length ? await this.mediaRepository.find({ where: { id: In(avatarIds) } }) : [];
    const avatarById = new Map(avatars.map((m) => [m.id, m]));

    return {
      term,
      profiles: rows.map((r) => {
        const avatar = r.avatarMediaId ? avatarById.get(r.avatarMediaId) : undefined;
        return {
          username: r.username,
          name: `${r.firstname} ${r.lastname}`.trim(),
          bio: r.bio,
          avatar: avatar ? this.media.view(avatar) : null,
          photos: Number(r.photos),
        };
      }),
    };
  }

  /**
   * Liste les profils publiant le plus récemment, avec leurs compteurs et un aperçu de leurs derniers
   * médias publiés.
   *
   * @remarks `GET /api/public/profiles`. Route publique, aucun garde. Limitée à cent vingt requêtes
   * par minute. Le classement retient la date de publication la plus récente par propriétaire, et
   * l'ordre initial est réappliqué après la lecture des comptes. Les aperçus proviennent d'une unique
   * requête fenêtrée `ROW_NUMBER` bornée à trois médias par profil et les compteurs d'abonnés d'une
   * agrégation lancée en parallèle, ce qui évite une requête par profil. Les identifiants de
   * propriétaires sont passés en paramètre lié `ANY($1)`.
   * @param limit - Nombre de profils demandé, borné entre un et vingt-quatre, six par défaut.
   * @returns Objet à un champ `profiles`. Chaque entrée porte `username`, `name` composé du prénom et
   * du nom, `bio`, `avatar` en vue média ou `null`, `counts.photos` le nombre de médias publiés,
   * `counts.followers` le nombre d'abonnés, `lastPublishedAt` au format ISO ou `null`, et `preview` la
   * liste des vues média des derniers publiés. La liste est vide quand aucun média n'est publié.
   */
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @ApiOperation({ summary: 'Profils en vedette (avec aperçus)' })
  @Get('/profiles')
  async profiles(@Query('limit') limit?: string) {
    const take = Math.min(PUBLIC_LIMITS.PROFILES_MAX, Math.max(1, Number(limit) || PUBLIC_LIMITS.PROFILES_DEFAULT));
    const ranked = await this.mediaRepository
      .createQueryBuilder('m')
      .select('m.ownerId', 'id')
      .addSelect('COUNT(*)', 'total')
      .addSelect('MAX(m.publishedAt)', 'last')
      .where("m.role = 'content'")
      .andWhere('m.publishedAt IS NOT NULL')
      .groupBy('m.ownerId')
      .orderBy('MAX(m.publishedAt)', 'DESC')
      .limit(take)
      .getRawMany<{ id: string; total: string; last: Date }>();
    if (!ranked.length) return { profiles: [] };

    const ids = ranked.map((r) => r.id);
    const accounts = await this.accountRepository.find({ where: { id: In(ids) } });
    const [followerRows, previewRows] = await Promise.all([
      this.followRepository
        .createQueryBuilder('f')
        .select('f.followingId', 'id')
        .addSelect('COUNT(*)', 'total')
        .where('f.followingId IN (:...ids)', { ids })
        .groupBy('f.followingId')
        .getRawMany<{ id: string; total: string }>(),
      this.mediaRepository.manager.query<{ id: string; ownerId: string }[]>(
        `SELECT id, "ownerId" FROM (
             SELECT m.id, m."ownerId",
                    ROW_NUMBER() OVER (PARTITION BY m."ownerId" ORDER BY m."publishedAt" DESC, m.id DESC) AS rn
               FROM media m
              WHERE m.role = 'content'
                AND m."publishedAt" IS NOT NULL
                AND m."ownerId" = ANY($1)
           ) ranked
          WHERE rn <= $2`,
        [ids, PUBLIC_LIMITS.PREVIEW_PER_PROFILE],
      ),
    ]);

    const mediaIds = [...previewRows.map((r) => r.id), ...accounts.map((a) => a.avatarMediaId).filter((v): v is string => !!v)];
    const media = mediaIds.length ? await this.mediaRepository.find({ where: { id: In(mediaIds) } }) : [];
    const mediaById = new Map(media.map((m) => [m.id, m]));

    const previews = new Map<string, ReturnType<MediaService['view']>[]>();
    for (const row of previewRows) {
      const m = mediaById.get(row.id);
      if (!m) continue;
      const list = previews.get(row.ownerId) ?? [];
      list.push(this.media.view(m));
      previews.set(row.ownerId, list);
    }

    const totalById = new Map(ranked.map((r) => [r.id, Number(r.total)]));
    const lastById = new Map(ranked.map((r) => [r.id, r.last]));
    const followerById = new Map(followerRows.map((r) => [r.id, Number(r.total)]));
    const order = new Map(ids.map((id, i) => [id, i]));

    return {
      profiles: accounts
        .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
        .map((a) => {
          const avatar = a.avatarMediaId ? mediaById.get(a.avatarMediaId) : undefined;
          const last = lastById.get(a.id);
          return {
            username: a.username,
            name: `${a.firstname} ${a.lastname}`.trim(),
            bio: a.bio,
            avatar: avatar ? this.media.view(avatar) : null,
            counts: { photos: totalById.get(a.id) ?? 0, followers: followerById.get(a.id) ?? 0 },
            lastPublishedAt: last ? new Date(last).toISOString() : null,
            preview: previews.get(a.id) ?? [],
          };
        }),
    };
  }

  /**
   * Pagine le fil global des médias publiés, du plus récent au plus ancien, en rattachant l'auteur à
   * chaque média.
   *
   * @remarks `GET /api/public/feed`. Route publique, aucun garde. Limitée à deux cent quarante
   * requêtes par minute. La pagination repose sur un curseur opaque encodé en base64url qui porte la
   * date de publication et l'identifiant du dernier élément servi, comparés en clé composée, ce qui
   * garde un parcours stable et sans doublon même si des médias sont publiés pendant la navigation.
   * Une ligne de plus que la page demandée est lue pour détecter la page suivante sans compter la
   * table, et les auteurs sont résolus en une seule requête `IN` sur les propriétaires dédupliqués.
   * @param cursor - Curseur opaque base64url de la forme date ISO puis barre verticale puis
   * identifiant, optionnel.
   * @param limit - Taille de page demandée, bornée entre un et cent vingt, vingt-quatre par défaut.
   * @returns Objet à deux champs, `items` et `nextCursor`. Chaque élément étale la vue média (`id`,
   * `kind`, `width`, `height`, `durationMs`, `url`) puis ajoute `publishedAt` au format ISO ou `null`
   * et `author` porteur de `username` et `name`, ou `null` si le compte n'est plus résolvable.
   * `nextCursor` vaut `null` sur la dernière page.
   * @throws BadRequestException `BAD_CURSOR` avec le statut 400 si le curseur décodé ne fournit pas
   * une date valide et un identifiant non vide.
   */
  @Throttle({ default: { limit: 240, ttl: 60000 } })
  @ApiOperation({ summary: 'Galerie publique (fil global)' })
  @Get('/feed')
  async feed(@Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    const take = Math.min(PUBLIC_LIMITS.PAGE_MAX, Math.max(1, Number(limit) || PUBLIC_LIMITS.FEED_DEFAULT));
    const qb = this.mediaRepository
      .createQueryBuilder('m')
      .where("m.role = 'content'")
      .andWhere('m.publishedAt IS NOT NULL')
      .orderBy('m.publishedAt', 'DESC')
      .addOrderBy('m.id', 'DESC')
      .limit(take + 1);

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

    const accounts = await this.accountRepository.find({
      where: { id: In(Array.from(new Set(items.map((m) => m.ownerId)))) },
    });
    const authorById = new Map(accounts.map((a) => [a.id, { username: a.username, name: `${a.firstname} ${a.lastname}`.trim() }]));

    const last = items[items.length - 1];
    const nextCursor = hasMore && last?.publishedAt ? Buffer.from(`${last.publishedAt.toISOString()}|${last.id}`).toString('base64url') : null;

    return {
      items: items.map((m) => ({
        ...this.media.view(m),
        publishedAt: m.publishedAt?.toISOString() ?? null,
        author: authorById.get(m.ownerId) ?? null,
      })),
      nextCursor,
    };
  }

  /**
   * Retourne la fiche publique d'un compte désigné par son nom d'utilisateur, avec ses compteurs de
   * médias et d'abonnés.
   *
   * @remarks `GET /api/public/:username`. Route publique, aucun garde. Limitée à cent vingt requêtes
   * par minute. Le nom d'utilisateur est confronté au motif autorisé avant toute lecture, et un format
   * invalide renvoie la même erreur qu'un compte inexistant afin de ne rien révéler sur les
   * identifiants acceptés. Le comptage des médias, celui des abonnés et la recherche de la première
   * publication sont lancés en parallèle. L'avatar n'est chargé que si son `ownerId` correspond au
   * compte demandé, ce qui interdit d'exposer le média d'un autre compte via un `avatarMediaId`
   * incohérent.
   * @param username - Nom d'utilisateur extrait du chemin.
   * @returns Objet portant `username`, `name` composé du prénom et du nom, `bio`, `avatar` en vue
   * média ou `null`, `counts.photos` le nombre de médias publiés, `counts.followers` le nombre
   * d'abonnés, et `firstPublishedAt` au format ISO ou `null`.
   * @throws NotFoundException `ACCOUNT_NOT_FOUND` avec le statut 404 si le nom d'utilisateur ne
   * respecte pas le motif autorisé ou si aucun compte ne le porte.
   */
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @ApiOperation({ summary: "Profil public d'un utilisateur" })
  @Get('/:username')
  async profile(@Param('username') username: string) {
    if (!USERNAME.test(username)) throw new NotFoundException({ code: 'ACCOUNT_NOT_FOUND' });
    const account = await this.accountRepository.findOne({ where: { username } });
    if (!account) throw new NotFoundException({ code: 'ACCOUNT_NOT_FOUND' });

    const [photos, followers, first] = await Promise.all([
      this.mediaRepository.count({
        where: { ownerId: account.id, role: 'content', publishedAt: Not(IsNull()) },
      }),
      this.followRepository.count({ where: { followingId: account.id } }),
      this.mediaRepository
        .createQueryBuilder('m')
        .select('MIN(m.publishedAt)', 'first')
        .where('m.ownerId = :id', { id: account.id })
        .andWhere("m.role = 'content'")
        .andWhere('m.publishedAt IS NOT NULL')
        .getRawOne<{ first: Date | null }>(),
    ]);
    const avatar = account.avatarMediaId ? await this.mediaRepository.findOne({ where: { id: account.avatarMediaId, ownerId: account.id } }) : null;
    return {
      username: account.username,
      name: `${account.firstname} ${account.lastname}`.trim(),
      bio: account.bio,
      avatar: avatar ? this.media.view(avatar) : null,
      counts: { photos, followers },
      firstPublishedAt: first?.first ? new Date(first.first).toISOString() : null,
    };
  }

  /**
   * Pagine les médias publiés d'un compte donné, du plus récent au plus ancien.
   *
   * @remarks `GET /api/public/:username/media`. Route publique, aucun garde. Limitée à deux cent
   * quarante requêtes par minute. Le nom d'utilisateur est validé contre le motif autorisé avant la
   * résolution du compte, et la requête est ensuite contrainte au propriétaire résolu, au rôle
   * `content` et à `publishedAt` non nul. Le curseur opaque base64url est comparé en clé composée
   * comme sur le fil global, et une ligne de plus que la page demandée est lue pour savoir s'il reste
   * une page suivante.
   * @param username - Nom d'utilisateur extrait du chemin.
   * @param cursor - Curseur opaque base64url de la forme date ISO puis barre verticale puis
   * identifiant, optionnel.
   * @param limit - Taille de page demandée, bornée entre un et cent vingt, quarante-huit par défaut.
   * @returns Objet à deux champs, `items` et `nextCursor`. Chaque élément étale la vue média (`id`,
   * `kind`, `width`, `height`, `durationMs`, `url`) puis ajoute `publishedAt` au format ISO ou `null`.
   * `nextCursor` vaut `null` sur la dernière page.
   * @throws NotFoundException `ACCOUNT_NOT_FOUND` avec le statut 404 si le nom d'utilisateur ne
   * respecte pas le motif autorisé ou si aucun compte ne le porte.
   * @throws BadRequestException `BAD_CURSOR` avec le statut 400 si le curseur décodé ne fournit pas
   * une date valide et un identifiant non vide.
   */
  @Throttle({ default: { limit: 240, ttl: 60000 } })
  @ApiOperation({ summary: "Médias publiés d'un utilisateur (pagination curseur)" })
  @Get('/:username/media')
  async media_(@Param('username') username: string, @Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    if (!USERNAME.test(username)) throw new NotFoundException({ code: 'ACCOUNT_NOT_FOUND' });
    const account = await this.accountRepository.findOne({ where: { username } });
    if (!account) throw new NotFoundException({ code: 'ACCOUNT_NOT_FOUND' });

    const take = Math.min(PUBLIC_LIMITS.PAGE_MAX, Math.max(1, Number(limit) || PUBLIC_LIMITS.PAGE_DEFAULT));
    const qb = this.mediaRepository
      .createQueryBuilder('m')
      .where('m.ownerId = :id', { id: account.id })
      .andWhere("m.role = 'content'")
      .andWhere('m.publishedAt IS NOT NULL')
      .orderBy('m.publishedAt', 'DESC')
      .addOrderBy('m.id', 'DESC')
      .limit(take + 1);

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
    const last = items[items.length - 1];
    const nextCursor = hasMore && last?.publishedAt ? Buffer.from(`${last.publishedAt.toISOString()}|${last.id}`).toString('base64url') : null;

    return {
      items: items.map((m) => ({
        ...this.media.view(m),
        publishedAt: m.publishedAt?.toISOString() ?? null,
      })),
      nextCursor,
    };
  }
}
