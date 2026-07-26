// dropicture/apps/saas/backend/src/controllers/library.controller.ts
import { BadRequestException, Body, Controller, Delete, Get, Headers, HttpCode, HttpStatus, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, IsNull, Not, Repository } from 'typeorm';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import type { Request } from 'express';
import { MediaService, extOf, type MediaView } from '../services/media.service';
import type { AuthenticatedUser } from '../services/auth.service';
import { Media } from '../models/media.entity';
import { Album } from '../models/album.entity';
import { Placement } from '../models/placement.entity';

/**
 * Bornes de la bibliothèque privée. Les valeurs sont volontairement basses pour qu'un appel client ne
 * puisse pas déclencher une clause `IN (...)` démesurée ni une lecture non bornée, et pour rester
 * cohérent avec les contraintes de colonnes de la base.
 */
export const LIBRARY_LIMITS = {
  /** Longueur maximale d'un titre d'album, alignée sur la colonne `varchar(60)` de la table `albums`. */
  ALBUM_TITLE_MAX: 60,
  /** Nombre maximal d'identifiants par opération de lot, garde-fou contre les requêtes de masse et les payloads volumineux. */
  BULK_MAX: 200,
  /** Plafond dur de la taille de page, une valeur `limit` supérieure est ramenée à ce maximum. */
  PAGE_MAX: 120,
  /** Taille de page appliquée quand le client ne fournit pas de `limit` exploitable. */
  PAGE_DEFAULT: 60,
} as const;

/**
 * Corps attendu par les opérations de lot, une liste d'identifiants de médias.
 *
 * @remarks Les messages de contrainte portent directement les codes métier `NO_MEDIA` et
 * `TOO_MANY_ITEMS`. Le validateur global rejette la requête en 400 avant d'atteindre le contrôleur,
 * et le typage UUID version 4 empêche toute valeur non conforme d'atteindre les requêtes SQL.
 */
class BulkIdsDto {
  @IsArray()
  @ArrayNotEmpty({ message: 'NO_MEDIA' })
  @ArrayMaxSize(LIBRARY_LIMITS.BULK_MAX, { message: 'TOO_MANY_ITEMS' })
  @IsUUID('4', { each: true })
  ids!: string[];
}

/**
 * Corps attendu par la création et le renommage d'album, un titre et une sélection facultative de médias.
 *
 * @remarks Le titre est nettoyé de ses espaces de bord avant validation, ce qui évite les doublons
 * visuellement identiques face à l'index unique propriétaire plus titre. Les codes de contrainte sont
 * `TITLE_REQUIRED`, `TITLE_TOO_LONG` et `TOO_MANY_ITEMS`.
 */
class AlbumTitleDto {
  @IsString()
  @MinLength(1, { message: 'TITLE_REQUIRED' })
  @MaxLength(LIBRARY_LIMITS.ALBUM_TITLE_MAX, { message: 'TITLE_TOO_LONG' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  title!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(LIBRARY_LIMITS.BULK_MAX, { message: 'TOO_MANY_ITEMS' })
  @IsUUID('4', { each: true })
  mediaIds?: string[];
}

/**
 * Représentation d'un média telle que la renvoie la bibliothèque privée, la vue publique enrichie du
 * poids en octets, de la date de prise de vue effective et de l'état de publication.
 *
 * @remarks Le poids reste une chaîne de caractères car la colonne est un entier 64 bits, une conversion
 * en nombre JavaScript perdrait de la précision.
 */
type LibraryItem = MediaView & { bytes: string; takenAt: string; published: boolean };

/**
 * Contrôleur du domaine bibliothèque. Expose le téléversement en flux, l'inventaire paginé des médias
 * privés, les statistiques d'occupation, les bascules de publication, la suppression définitive et la
 * gestion des albums sous le préfixe /api/library.
 *
 * @remarks Le garde `access-token` protège toutes les routes du contrôleur, aucune n'est publique.
 * L'isolation des données repose sur l'identifiant de compte porté par la session, chaque requête SQL
 * filtre sur `ownerId` et sur le rôle `content`, ce qui interdit d'atteindre le média d'un autre compte
 * ou un avatar en devinant un identifiant. Chaque route porte une limitation de débit propre, plus
 * stricte sur les écritures coûteuses, trente par minute sur la suppression, le téléchargement et la
 * création d'album. Les identifiants d'URL passent par un contrôle de format UUID version 4 et les
 * corps de requête par le validateur global en liste blanche.
 */
@ApiTags('Bibliothèque')
@ApiCookieAuth('session')
@Controller('/api/library')
@UseGuards(AuthGuard('access-token'))
export class LibraryController {
  /** Injecte le service média et les dépôts médias, albums et placements utilisés par les routes. */
  constructor(
    private readonly media: MediaService,
    @InjectRepository(Media)
    private readonly mediaRepository: Repository<Media>,
    @InjectRepository(Album)
    private readonly albumRepository: Repository<Album>,
    @InjectRepository(Placement)
    private readonly placementRepository: Repository<Placement>,
  ) {}

  /**
   * Téléverse un média du compte authentifié et l'ajoute au besoin à un album.
   *
   * @remarks `POST /api/library/uploads`. Route protégée par le garde `access-token`, le propriétaire est
   * lu dans `req.user` et jamais accepté depuis le client. Limitée à soixante requêtes par minute. Le
   * corps de la requête n'est pas mis en mémoire tampon, la requête Express est passée telle quelle au
   * service média qui la relaie vers le stockage objet par parties, avec un contrôle du volume cumulé qui
   * interrompt le transfert au dépassement. Les métadonnées d'image ne sont retenues que si elles sont des
   * entiers strictement positifs, et une date de prise de vue illisible ou située dans le futur est
   * ramenée à une absence de valeur. Le rattachement à un album n'a lieu que si l'album appartient au
   * compte, l'insertion du placement ignore les conflits pour rester idempotente et la position calculée
   * place le média en fin de liste.
   * @param req - Requête Express portant `req.user` injecté par la stratégie d'accès, et servant aussi de
   * flux binaire pour le contenu téléversé.
   * @param contentType - En-tête `content-type`, le type MIME est isolé avant le point virgule de paramètres.
   * @param contentLength - En-tête `content-length`, utilisé pour un refus anticipé au delà du poids autorisé.
   * @param width - Largeur en pixels déclarée par le client, ignorée si ce n'est pas un entier positif.
   * @param height - Hauteur en pixels déclarée par le client, ignorée si ce n'est pas un entier positif.
   * @param durationMs - Durée en millisecondes pour une vidéo, ignorée si ce n'est pas un entier positif.
   * @param takenAt - Date de prise de vue au format ISO, ignorée si invalide ou postérieure à maintenant.
   * @param albumId - Album de destination facultatif, ignoré silencieusement s'il n'appartient pas au compte.
   * @returns Identifiant, nature du média, largeur, hauteur, durée, URL de diffusion, poids en octets sous
   * forme de chaîne, date de prise de vue effective et indicateur de publication.
   * @throws BadRequestException `UNSUPPORTED_MEDIA_TYPE` avec le statut 400 si l'en-tête de type est absent,
   * ou si le type MIME n'est pas accepté par le service média.
   * @throws BadRequestException `FILE_TOO_LARGE` avec le statut 400 si le poids annoncé ou réellement reçu
   * dépasse le plafond du type de média.
   * @throws BadRequestException `FILE_REQUIRED` avec le statut 400 si le flux reçu est vide, l'objet
   * partiellement écrit est alors supprimé du stockage.
   * @throws BadRequestException `UPLOAD_FAILED` avec le statut 400 si le transfert vers le stockage échoue.
   */
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Téléverser un média (photo/vidéo) en streaming' })
  @Post('/uploads')
  async upload(
    @Req() req: Request,
    @Headers('content-type') contentType?: string,
    @Headers('content-length') contentLength?: string,
    @Query('w') width?: string,
    @Query('h') height?: string,
    @Query('d') durationMs?: string,
    @Query('takenAt') takenAt?: string,
    @Query('album') albumId?: string,
  ): Promise<LibraryItem> {
    const { sub } = req.user as AuthenticatedUser;
    if (!contentType) throw new BadRequestException({ code: 'UNSUPPORTED_MEDIA_TYPE' });
    const widthValue = Number(width);
    const heightValue = Number(height);
    const durationValue = Number(durationMs);
    let capturedAt: Date | null = null;
    if (takenAt) {
      const date = new Date(takenAt);
      capturedAt = Number.isNaN(date.getTime()) || date.getTime() > Date.now() ? null : date;
    }
    const media = await this.media.upload({
      ownerId: sub,
      role: 'content',
      stream: req,
      mimeType: contentType.split(';')[0].trim(),
      contentLength: Number(contentLength) || undefined,
      width: Number.isInteger(widthValue) && widthValue > 0 ? widthValue : null,
      height: Number.isInteger(heightValue) && heightValue > 0 ? heightValue : null,
      durationMs: Number.isInteger(durationValue) && durationValue > 0 ? durationValue : null,
      capturedAt,
    });

    if (albumId) {
      const album = await this.albumRepository.findOne({ where: { id: albumId, ownerId: sub } });
      if (album) {
        const last = await this.placementRepository
          .createQueryBuilder('p')
          .select('COALESCE(MAX(p.position), -1)', 'max')
          .where('p.albumId = :albumId', { albumId: album.id })
          .getRawOne<{ max: string }>();
        await this.placementRepository
          .createQueryBuilder()
          .insert()
          .into(Placement)
          .values([{ albumId: album.id, mediaId: media.id, position: Number(last?.max ?? -1) + 1 }])
          .orIgnore()
          .execute();
      }
    }

    return {
      ...this.media.view(media),
      bytes: media.bytes,
      takenAt: (media.capturedAt ?? media.createdAt).toISOString(),
      published: media.publishedAt !== null,
    };
  }

  /**
   * Retourne les compteurs et l'occupation de la bibliothèque du compte authentifié.
   *
   * @remarks `GET /api/library/summary`. Route protégée par le garde `access-token`, tous les agrégats sont
   * filtrés sur le propriétaire de la session et sur le rôle `content`, les avatars sont donc exclus.
   * Limitée à cent vingt requêtes par minute. Les totaux sont calculés côté base par agrégation, aucune
   * ligne de média n'est chargée en mémoire. La somme des octets est convertie en entier 64 bits dans la
   * requête puis renvoyée sous forme de chaîne pour préserver la précision. La répartition mensuelle et le
   * volume ne portent que sur les médias non publiés, alors que la date la plus ancienne couvre tout le
   * contenu du compte.
   * @param req - Requête Express portant `req.user` injecté par la stratégie d'accès.
   * @returns Un objet `counts` avec le nombre de médias privés et publiés, `bytes` le volume privé cumulé en
   * chaîne de caractères, `months` la liste des mois au format `YYYY-MM` avec leur total du plus récent au
   * plus ancien, `firstAt` la date ISO du média le plus ancien ou une valeur nulle, et `limits` les plafonds
   * de téléversement et les types acceptés exposés par le service média.
   */
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @ApiOperation({ summary: 'Statistiques de la bibliothèque privée' })
  @Get('/summary')
  async summary(@Req() req: Request) {
    const { sub } = req.user as AuthenticatedUser;
    const totals = await this.mediaRepository
      .createQueryBuilder('m')
      .select('COUNT(*)', 'total')
      .addSelect('COALESCE(SUM(CAST(m.bytes AS BIGINT)), 0)', 'bytes')
      .where('m.ownerId = :sub', { sub })
      .andWhere("m.role = 'content'")
      .andWhere('m.publishedAt IS NULL')
      .getRawOne<{ total: string; bytes: string }>();
    const published = await this.mediaRepository.count({
      where: { ownerId: sub, role: 'content', publishedAt: Not(IsNull()) },
    });
    const months = await this.mediaRepository
      .createQueryBuilder('m')
      .select("TO_CHAR(DATE_TRUNC('month', COALESCE(m.capturedAt, m.createdAt)), 'YYYY-MM')", 'month')
      .addSelect('COUNT(*)', 'total')
      .where('m.ownerId = :sub', { sub })
      .andWhere("m.role = 'content'")
      .andWhere('m.publishedAt IS NULL')
      .groupBy('month')
      .orderBy('month', 'DESC')
      .getRawMany<{ month: string; total: string }>();
    const oldest = await this.mediaRepository
      .createQueryBuilder('m')
      .select('MIN(COALESCE(m.capturedAt, m.createdAt))', 'first')
      .where('m.ownerId = :sub', { sub })
      .andWhere("m.role = 'content'")
      .getRawOne<{ first: Date | null }>();
    return {
      counts: { private: Number(totals?.total ?? 0), published },
      bytes: String(totals?.bytes ?? 0),
      months: months.map((m) => ({ month: m.month, total: Number(m.total) })),
      firstAt: oldest?.first ? new Date(oldest.first).toISOString() : null,
      limits: this.media.limits(),
    };
  }

  /**
   * Liste les médias du compte authentifié, page par page, du plus récent au plus ancien.
   *
   * @remarks `GET /api/library/`. Route protégée par le garde `access-token`, la requête est filtrée sur le
   * propriétaire de la session et sur le rôle `content`. Limitée à deux cent quarante requêtes par minute.
   * La taille de page est contrainte entre un et cent vingt, avec soixante par défaut. La pagination est un
   * curseur composite encodé en base64url qui reprend la date de prise de vue effective et l'identifiant du
   * dernier élément rendu, ce qui évite le décalage par `OFFSET` sur les grandes bibliothèques et reste
   * stable si des médias sont ajoutés entre deux pages. Une ligne supplémentaire est demandée à la base pour
   * savoir s'il existe une page suivante sans requête de comptage. Sans filtre d'album, seuls les médias non
   * publiés sont rendus, alors qu'une consultation d'album rend aussi les médias publiés qu'il contient.
   * @param req - Requête Express portant `req.user` injecté par la stratégie d'accès.
   * @param albumId - Album à consulter, la propriété de l'album est vérifiée avant la jointure sur les placements.
   * @param cursor - Curseur opaque renvoyé par l'appel précédent, décodé en date et identifiant.
   * @param limit - Taille de page souhaitée, ramenée dans les bornes autorisées.
   * @returns Un objet `items` contenant pour chaque média l'identifiant, la nature, les dimensions, la durée,
   * l'URL de diffusion, le poids en octets, la date de prise de vue effective et l'indicateur de publication,
   * ainsi que `nextCursor`, curseur de la page suivante ou valeur nulle sur la dernière page.
   * @throws NotFoundException `ALBUM_NOT_FOUND` avec le statut 404 si l'album demandé n'existe pas ou
   * n'appartient pas au compte, ce qui évite de révéler l'existence de l'album d'un autre compte.
   * @throws BadRequestException `BAD_CURSOR` avec le statut 400 si le curseur décodé ne contient pas une date
   * exploitable et un identifiant.
   */
  @Throttle({ default: { limit: 240, ttl: 60000 } })
  @ApiOperation({ summary: 'Lister les médias privés (pagination par curseur)' })
  @Get('/')
  async list(@Req() req: Request, @Query('album') albumId?: string, @Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    const { sub } = req.user as AuthenticatedUser;
    const take = Math.min(LIBRARY_LIMITS.PAGE_MAX, Math.max(1, Number(limit) || LIBRARY_LIMITS.PAGE_DEFAULT));
    const qb = this.mediaRepository
      .createQueryBuilder('m')
      .where('m.ownerId = :sub', { sub })
      .andWhere("m.role = 'content'")
      .orderBy('COALESCE(m.capturedAt, m.createdAt)', 'DESC')
      .addOrderBy('m.id', 'DESC')
      .limit(take + 1);
    if (albumId) {
      const album = await this.albumRepository.findOne({
        where: { id: albumId, ownerId: sub },
        select: { id: true },
      });
      if (!album) throw new NotFoundException({ code: 'ALBUM_NOT_FOUND' });
      qb.innerJoin(Placement, 'p', 'p.mediaId = m.id AND p.albumId = :albumId', { albumId });
    } else {
      qb.andWhere('m.publishedAt IS NULL');
    }
    if (cursor) {
      const [iso, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
      const ts = new Date(iso);
      if (Number.isNaN(ts.getTime()) || !id) throw new BadRequestException({ code: 'BAD_CURSOR' });
      qb.andWhere(
        new Brackets((w) => {
          w.where('COALESCE(m.capturedAt, m.createdAt) < :ts', { ts }).orWhere(
            new Brackets((x) => {
              x.where('COALESCE(m.capturedAt, m.createdAt) = :ts', { ts }).andWhere('m.id < :id', { id });
            }),
          );
        }),
      );
    }
    const rows = await qb.getMany();
    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;
    const last = items[items.length - 1];
    let nextCursor: string | null = null;
    if (hasMore && last) {
      const at = last.capturedAt ?? last.createdAt;
      nextCursor = Buffer.from(`${at.toISOString()}|${last.id}`).toString('base64url');
    }
    return {
      items: items.map((m): LibraryItem => ({
        ...this.media.view(m),
        bytes: m.bytes,
        takenAt: (m.capturedAt ?? m.createdAt).toISOString(),
        published: m.publishedAt !== null,
      })),
      nextCursor,
    };
  }

  /**
   * Résout un lot d'identifiants en URL de téléchargement et en noms de fichiers.
   *
   * @remarks `POST /api/library/download`. Route protégée par le garde `access-token` et répondant en 200
   * malgré le verbe POST, le corps étant nécessaire pour transporter la liste d'identifiants. Limitée à
   * trente requêtes par minute. La lecture filtre sur le propriétaire de la session et sur le rôle
   * `content`, un identifiant appartenant à un autre compte ou désignant un avatar est écarté sans erreur,
   * la réponse ne contient donc que des médias effectivement détenus. Le nom de fichier est reconstruit à
   * partir de l'identifiant et de l'extension déduite du type MIME, jamais du nom fourni à l'origine par le
   * client, ce qui neutralise toute tentative de traversée de chemin.
   * @param req - Requête Express portant `req.user` injecté par la stratégie d'accès.
   * @param dto - Corps validé portant les identifiants demandés, entre un et deux cents UUID version 4.
   * @returns Un objet `items` listant pour chaque média retrouvé son identifiant, un nom de fichier
   * reconstruit et son URL de diffusion.
   * @throws NotFoundException `MEDIA_NOT_FOUND` avec le statut 404 si aucun identifiant du lot ne correspond
   * à un média du compte.
   */
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: "URLs de téléchargement d'un lot de médias" })
  @Post('/download')
  @HttpCode(HttpStatus.OK)
  async download(@Req() req: Request, @Body() dto: BulkIdsDto) {
    const { sub } = req.user as AuthenticatedUser;
    const rows = await this.mediaRepository.find({
      where: { id: In(dto.ids), ownerId: sub, role: 'content' },
    });
    if (!rows.length) throw new NotFoundException({ code: 'MEDIA_NOT_FOUND' });
    return {
      items: rows.map((m) => ({
        id: m.id,
        filename: `${m.id}.${extOf(m.mimeType)}`,
        url: this.media.view(m).url,
      })),
    };
  }

  /**
   * Publie un lot de médias, les rendant visibles sur le profil public du compte.
   *
   * @remarks `PATCH /api/library/publish`. Route protégée par le garde `access-token` et limitée à soixante
   * requêtes par minute. La bascule est déléguée au service média qui applique une mise à jour unique
   * filtrée sur le propriétaire et conserve la date de publication déjà présente, l'opération est donc
   * idempotente et un identifiant étranger au compte ne peut pas être publié. Le traitement est partiel par
   * conception, aucune exception n'est levée pour un identifiant en échec, un second passage relit les
   * identifiants non confirmés en ne sélectionnant que les colonnes utiles au diagnostic afin de leur
   * attribuer un code d'échec précis.
   * @param req - Requête Express portant `req.user` injecté par la stratégie d'accès.
   * @param dto - Corps validé portant les identifiants à publier, entre un et deux cents UUID version 4.
   * @returns Un objet `done` avec les identifiants effectivement mis à jour, et `failed` avec pour chaque
   * identifiant restant son code d'échec, `MEDIA_NOT_FOUND` s'il n'appartient pas au compte,
   * `AVATAR_NOT_ALLOWED` s'il désigne un avatar, `ALREADY_PUBLIC` s'il portait déjà une date de publication,
   * et `PUBLISH_FAILED` dans les autres cas.
   */
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Publier des médias (les rendre publics)' })
  @Patch('/publish')
  @HttpCode(HttpStatus.OK)
  async publish(@Req() req: Request, @Body() dto: BulkIdsDto) {
    const { sub } = req.user as AuthenticatedUser;
    const done = await this.media.publish(sub, dto.ids);

    const doneSet = new Set(done);
    const pending = dto.ids.filter((id) => !doneSet.has(id));
    let failed: { id: string; code: string }[] = [];
    if (pending.length) {
      const rows = await this.mediaRepository.find({
        where: { id: In(pending), ownerId: sub },
        select: { id: true, role: true, publishedAt: true },
      });
      const byId = new Map(rows.map((r) => [r.id, r]));
      failed = pending.map((id) => {
        const m = byId.get(id);
        if (!m) return { id, code: 'MEDIA_NOT_FOUND' };
        if (m.role === 'avatar') return { id, code: 'AVATAR_NOT_ALLOWED' };
        if (m.publishedAt) return { id, code: 'ALREADY_PUBLIC' };
        return { id, code: 'PUBLISH_FAILED' };
      });
    }
    return { done, failed };
  }

  /**
   * Dépublie un lot de médias, les faisant repasser en privé.
   *
   * @remarks `PATCH /api/library/unpublish`. Route protégée par le garde `access-token` et limitée à soixante
   * requêtes par minute. La mise à jour déléguée au service média efface la date de publication, reste
   * filtrée sur le propriétaire et exclut explicitement le rôle `avatar`, l'avatar restant nécessairement
   * accessible au public. Le traitement est partiel, les identifiants non confirmés sont relus pour recevoir
   * un code d'échec plutôt que de faire échouer tout le lot.
   * @param req - Requête Express portant `req.user` injecté par la stratégie d'accès.
   * @param dto - Corps validé portant les identifiants à dépublier, entre un et deux cents UUID version 4.
   * @returns Un objet `done` avec les identifiants effectivement mis à jour, et `failed` avec pour chaque
   * identifiant restant son code d'échec, `MEDIA_NOT_FOUND` s'il n'appartient pas au compte,
   * `AVATAR_NOT_ALLOWED` s'il désigne un avatar, `ALREADY_PRIVATE` s'il était déjà privé, et
   * `UNPUBLISH_FAILED` dans les autres cas.
   */
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Dépublier des médias (retour en privé)' })
  @Patch('/unpublish')
  @HttpCode(HttpStatus.OK)
  async unpublish(@Req() req: Request, @Body() dto: BulkIdsDto) {
    const { sub } = req.user as AuthenticatedUser;
    const done = await this.media.unpublish(sub, dto.ids);

    const doneSet = new Set(done);
    const pending = dto.ids.filter((id) => !doneSet.has(id));
    let failed: { id: string; code: string }[] = [];
    if (pending.length) {
      const rows = await this.mediaRepository.find({
        where: { id: In(pending), ownerId: sub },
        select: { id: true, role: true, publishedAt: true },
      });
      const byId = new Map(rows.map((r) => [r.id, r]));
      failed = pending.map((id) => {
        const m = byId.get(id);
        if (!m) return { id, code: 'MEDIA_NOT_FOUND' };
        if (m.role === 'avatar') return { id, code: 'AVATAR_NOT_ALLOWED' };
        if (!m.publishedAt) return { id, code: 'ALREADY_PRIVATE' };
        return { id, code: 'UNPUBLISH_FAILED' };
      });
    }
    return { done, failed };
  }

  /**
   * Supprime définitivement un lot de médias du stockage objet et de la base.
   *
   * @remarks `DELETE /api/library/media`. Route protégée par le garde `access-token` et limitée à trente
   * requêtes par minute, la plus stricte du contrôleur puisque l'opération est irréversible et sollicite le
   * stockage et le réseau de diffusion. Le service média ne retient que les lignes appartenant au compte,
   * supprime les objets par lots bornés, retire ensuite les enregistrements puis demande une invalidation du
   * cache de diffusion pour que les URL supprimées ne soient plus servies. Les placements référençant ces
   * médias disparaissent par cascade et une couverture d'album pointant sur un média supprimé est remise à
   * une valeur nulle par la contrainte de clé étrangère. Le traitement est partiel, aucune exception n'est
   * levée pour un identifiant en échec.
   * @param req - Requête Express portant `req.user` injecté par la stratégie d'accès.
   * @param dto - Corps validé portant les identifiants à supprimer, entre un et deux cents UUID version 4.
   * @returns Un objet `done` avec les identifiants réellement supprimés, et `failed` avec pour chaque
   * identifiant restant son code d'échec, `MEDIA_NOT_FOUND` s'il n'appartient pas au compte,
   * `AVATAR_NOT_ALLOWED` s'il désigne un avatar, et `DELETE_FAILED` dans les autres cas.
   */
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Supprimer des médias (stockage + base)' })
  @Delete('/media')
  @HttpCode(HttpStatus.OK)
  async destroy(@Req() req: Request, @Body() dto: BulkIdsDto) {
    const { sub } = req.user as AuthenticatedUser;
    const done = await this.media.destroy(sub, dto.ids);

    const doneSet = new Set(done);
    const pending = dto.ids.filter((id) => !doneSet.has(id));
    let failed: { id: string; code: string }[] = [];
    if (pending.length) {
      const rows = await this.mediaRepository.find({
        where: { id: In(pending), ownerId: sub },
        select: { id: true, role: true, publishedAt: true },
      });
      const byId = new Map(rows.map((r) => [r.id, r]));
      failed = pending.map((id) => {
        const m = byId.get(id);
        if (!m) return { id, code: 'MEDIA_NOT_FOUND' };
        if (m.role === 'avatar') return { id, code: 'AVATAR_NOT_ALLOWED' };
        return { id, code: 'DELETE_FAILED' };
      });
    }
    return { done, failed };
  }

  /**
   * Liste les albums du compte authentifié avec leurs compteurs et leur couverture.
   *
   * @remarks `GET /api/library/albums`. Route protégée par le garde `access-token`, la sélection des albums
   * est filtrée sur le propriétaire de la session et les identifiants d'albums utilisés ensuite proviennent
   * exclusivement de cette première lecture. Limitée à cent vingt requêtes par minute. Les compteurs sont
   * obtenus par une seule requête groupée qui compte les placements et, par agrégat filtré, les médias
   * publiés, ce qui évite une requête par album. La résolution des couvertures suit la même logique, la
   * couverture explicite est prise telle quelle et les albums qui n'en ont pas reçoivent le premier média par
   * position grâce à une requête `DISTINCT ON` paramétrée, sans concaténation de valeurs dans le SQL, puis un
   * seul chargement de médias couvre l'ensemble des vignettes. Le tri se fait sur la date de mise à jour
   * décroissante et la réponse court circuite immédiatement quand le compte n'a aucun album.
   * @param req - Requête Express portant `req.user` injecté par la stratégie d'accès.
   * @returns Un objet `albums` listant pour chaque album son identifiant, son titre, le nombre total de
   * médias, le nombre de médias publiés, la vue de la couverture ou une valeur nulle, et la date ISO de
   * dernière mise à jour.
   */
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @ApiOperation({ summary: 'Lister les albums (avec couverture et compteurs)' })
  @Get('/albums')
  async albums(@Req() req: Request) {
    const { sub } = req.user as AuthenticatedUser;
    const albums = await this.albumRepository.find({
      where: { ownerId: sub },
      order: { updatedAt: 'DESC' },
    });
    if (!albums.length) return { albums: [] };
    const ids = albums.map((a) => a.id);

    const counts = await this.placementRepository
      .createQueryBuilder('p')
      .innerJoin(Media, 'm', 'm.id = p.mediaId')
      .select('p.albumId', 'id')
      .addSelect('COUNT(*)', 'total')
      .addSelect('COUNT(*) FILTER (WHERE m.publishedAt IS NOT NULL)', 'published')
      .where('p.albumId IN (:...ids)', { ids })
      .groupBy('p.albumId')
      .getRawMany<{ id: string; total: string; published: string }>();
    const totalById = new Map(counts.map((c) => [c.id, Number(c.total)]));
    const publishedById = new Map(counts.map((c) => [c.id, Number(c.published)]));

    const explicit = albums.map((a) => a.coverMediaId).filter((v): v is string => !!v);
    const missing = albums.filter((a) => !a.coverMediaId).map((a) => a.id);
    const firsts: { albumId: string; mediaId: string }[] = missing.length
      ? await this.placementRepository.manager.query(
          `SELECT DISTINCT ON (p."albumId") p."albumId", p."mediaId"
             FROM placements p
            WHERE p."albumId" = ANY($1)
            ORDER BY p."albumId", p.position ASC`,
          [missing],
        )
      : [];
    const coverIds = [...explicit, ...firsts.map((f) => f.mediaId)];
    const coverMedia = coverIds.length ? await this.mediaRepository.find({ where: { id: In(coverIds) } }) : [];
    const coverById = new Map(coverMedia.map((m) => [m.id, m]));
    const firstByAlbum = new Map(firsts.map((f) => [f.albumId, f.mediaId]));

    return {
      albums: albums.map((a) => {
        const mediaId = a.coverMediaId ?? firstByAlbum.get(a.id);
        const cover = mediaId ? coverById.get(mediaId) : undefined;
        return {
          id: a.id,
          title: a.title,
          total: totalById.get(a.id) ?? 0,
          published: publishedById.get(a.id) ?? 0,
          cover: cover ? this.media.view(cover) : null,
          updatedAt: a.updatedAt.toISOString(),
        };
      }),
    };
  }

  /**
   * Crée un album pour le compte authentifié et y range éventuellement une première sélection de médias.
   *
   * @remarks `POST /api/library/albums`. Route protégée par le garde `access-token` et limitée à trente
   * requêtes par minute. L'unicité du titre est vérifiée dans le périmètre du compte avant l'écriture, en
   * complément de l'index unique propriétaire plus titre qui reste le garde-fou en base. Les identifiants de
   * médias fournis sont confrontés au dépôt avec un filtre sur le propriétaire et le rôle `content`, seuls
   * les médias réellement détenus sont rangés. Les positions sont attribuées à la suite du maximum existant
   * et l'insertion ignore les conflits de clé primaire composite, ce qui rend l'ajout rejouable sans doublon.
   * @param req - Requête Express portant `req.user` injecté par la stratégie d'accès.
   * @param dto - Corps validé portant le titre nettoyé et, facultativement, jusqu'à deux cents identifiants de médias.
   * @returns Identifiant de l'album créé, titre retenu, nombre de médias réellement ajoutés, compteur de
   * publiés à zéro, couverture nulle et date ISO de mise à jour.
   * @throws BadRequestException `ALBUM_TITLE_TAKEN` avec le statut 400 si le compte possède déjà un album
   * portant ce titre.
   */
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Créer un album (optionnellement avec des médias)' })
  @Post('/albums')
  async createAlbum(@Req() req: Request, @Body() dto: AlbumTitleDto) {
    const { sub } = req.user as AuthenticatedUser;
    const clash = await this.albumRepository.findOne({
      where: { ownerId: sub, title: dto.title },
      select: { id: true },
    });
    if (clash) throw new BadRequestException({ code: 'ALBUM_TITLE_TAKEN' });
    const album = await this.albumRepository.save(this.albumRepository.create({ ownerId: sub, title: dto.title }));

    let added = 0;
    if (dto.mediaIds?.length) {
      const rows = await this.mediaRepository.find({
        where: { id: In(dto.mediaIds), ownerId: sub, role: 'content' },
        select: { id: true },
      });
      const found = new Set(rows.map((r) => r.id));
      const owned = dto.mediaIds.filter((id) => found.has(id));

      if (owned.length) {
        const already = await this.placementRepository.count({
          where: { albumId: album.id, mediaId: In(owned) },
        });
        const last = await this.placementRepository
          .createQueryBuilder('p')
          .select('COALESCE(MAX(p.position), -1)', 'max')
          .where('p.albumId = :albumId', { albumId: album.id })
          .getRawOne<{ max: string }>();
        let position = Number(last?.max ?? -1) + 1;
        await this.placementRepository
          .createQueryBuilder()
          .insert()
          .into(Placement)
          .values(owned.map((mediaId) => ({ albumId: album.id, mediaId, position: position++ })))
          .orIgnore()
          .execute();
        added = owned.length - already;
      }
    }

    return {
      id: album.id,
      title: album.title,
      total: added,
      published: 0,
      cover: null,
      updatedAt: album.updatedAt.toISOString(),
    };
  }

  /**
   * Renomme un album du compte authentifié.
   *
   * @remarks `PATCH /api/library/albums/:albumId`. Route protégée par le garde `access-token` et limitée à
   * soixante requêtes par minute. L'identifiant d'URL est validé comme UUID version 4 par un contrôle de
   * format, un identifiant mal formé est rejeté en 400 avant toute requête. L'album est chargé avec un filtre
   * sur le propriétaire, un album d'un autre compte est donc traité comme inexistant. Aucune écriture n'a lieu
   * si le titre soumis est identique à l'actuel, ce qui préserve la date de mise à jour.
   * @param req - Requête Express portant `req.user` injecté par la stratégie d'accès.
   * @param albumId - Identifiant de l'album à renommer, contrôlé au format UUID version 4.
   * @param dto - Corps validé portant le nouveau titre nettoyé de ses espaces de bord.
   * @returns Identifiant et titre de l'album après traitement.
   * @throws NotFoundException `ALBUM_NOT_FOUND` avec le statut 404 si l'album n'existe pas ou n'appartient pas au compte.
   * @throws BadRequestException `ALBUM_TITLE_TAKEN` avec le statut 400 si un autre album du compte porte déjà ce titre.
   */
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Renommer un album' })
  @Patch('/albums/:albumId')
  @HttpCode(HttpStatus.OK)
  async renameAlbum(@Req() req: Request, @Param('albumId', new ParseUUIDPipe({ version: '4' })) albumId: string, @Body() dto: AlbumTitleDto) {
    const { sub } = req.user as AuthenticatedUser;
    const album = await this.albumRepository.findOne({ where: { id: albumId, ownerId: sub } });
    if (!album) throw new NotFoundException({ code: 'ALBUM_NOT_FOUND' });
    if (dto.title !== album.title) {
      const clash = await this.albumRepository.findOne({
        where: { ownerId: sub, title: dto.title },
        select: { id: true },
      });
      if (clash) throw new BadRequestException({ code: 'ALBUM_TITLE_TAKEN' });
      album.title = dto.title;
      await this.albumRepository.save(album);
    }
    return { id: album.id, title: album.title };
  }

  /**
   * Ajoute un lot de médias à un album du compte authentifié.
   *
   * @remarks `POST /api/library/albums/:albumId/media`, répondant en 200. Route protégée par le garde
   * `access-token` et limitée à soixante requêtes par minute. L'identifiant d'album est contrôlé au format
   * UUID version 4, et l'album comme les médias sont chargés avec un filtre sur le propriétaire, les médias
   * étant en plus restreints au rôle `content`. Les identifiants non détenus sont écartés avant écriture. Les
   * positions prolongent le maximum existant et l'insertion ignore les conflits, un même média ajouté deux
   * fois n'est donc compté qu'une seule fois grâce au comptage préalable des placements déjà présents. La date
   * de mise à jour de l'album est rafraîchie pour que la liste des albums le remonte en tête.
   * @param req - Requête Express portant `req.user` injecté par la stratégie d'accès.
   * @param albumId - Identifiant de l'album de destination, contrôlé au format UUID version 4.
   * @param dto - Corps validé portant les identifiants à ranger, entre un et deux cents UUID version 4.
   * @returns Nombre de médias réellement ajoutés et nombre d'identifiants ignorés car déjà présents dans l'album.
   * @throws NotFoundException `ALBUM_NOT_FOUND` avec le statut 404 si l'album n'existe pas ou n'appartient pas au compte.
   * @throws BadRequestException `NO_MEDIA` avec le statut 400 si aucun identifiant du lot ne correspond à un
   * média de contenu du compte.
   */
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Ajouter des médias à un album' })
  @Post('/albums/:albumId/media')
  @HttpCode(HttpStatus.OK)
  async addToAlbum(@Req() req: Request, @Param('albumId', new ParseUUIDPipe({ version: '4' })) albumId: string, @Body() dto: BulkIdsDto) {
    const { sub } = req.user as AuthenticatedUser;
    const album = await this.albumRepository.findOne({ where: { id: albumId, ownerId: sub } });
    if (!album) throw new NotFoundException({ code: 'ALBUM_NOT_FOUND' });

    const rows = await this.mediaRepository.find({
      where: { id: In(dto.ids), ownerId: sub, role: 'content' },
      select: { id: true },
    });
    const found = new Set(rows.map((r) => r.id));
    const owned = dto.ids.filter((id) => found.has(id));
    if (!owned.length) throw new BadRequestException({ code: 'NO_MEDIA' });

    const already = await this.placementRepository.count({
      where: { albumId: album.id, mediaId: In(owned) },
    });
    const last = await this.placementRepository
      .createQueryBuilder('p')
      .select('COALESCE(MAX(p.position), -1)', 'max')
      .where('p.albumId = :albumId', { albumId: album.id })
      .getRawOne<{ max: string }>();
    let position = Number(last?.max ?? -1) + 1;
    await this.placementRepository
      .createQueryBuilder()
      .insert()
      .into(Placement)
      .values(owned.map((mediaId) => ({ albumId: album.id, mediaId, position: position++ })))
      .orIgnore()
      .execute();
    const added = owned.length - already;

    await this.albumRepository.update({ id: album.id }, { updatedAt: new Date() });
    return { added, skipped: owned.length - added };
  }

  /**
   * Retire un lot de médias d'un album sans les supprimer de la bibliothèque.
   *
   * @remarks `DELETE /api/library/albums/:albumId/media`, répondant en 200. Route protégée par le garde
   * `access-token` et limitée à soixante requêtes par minute. La propriété de l'album est vérifiée avant la
   * suppression des placements, ce contrôle porte à lui seul l'isolation puisque la suppression cible ensuite
   * la clé composite album plus média. Si la couverture de l'album fait partie des médias retirés, elle est
   * remise à une valeur nulle afin que la vignette soit recalculée depuis le premier placement restant.
   * @param req - Requête Express portant `req.user` injecté par la stratégie d'accès.
   * @param albumId - Identifiant de l'album concerné, contrôlé au format UUID version 4.
   * @param dto - Corps validé portant les identifiants à retirer, entre un et deux cents UUID version 4.
   * @returns Nombre de placements effectivement supprimés, zéro si la base ne renseigne pas le compte de lignes affectées.
   * @throws NotFoundException `ALBUM_NOT_FOUND` avec le statut 404 si l'album n'existe pas ou n'appartient pas au compte.
   */
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: "Retirer des médias d'un album" })
  @Delete('/albums/:albumId/media')
  @HttpCode(HttpStatus.OK)
  async removeFromAlbum(@Req() req: Request, @Param('albumId', new ParseUUIDPipe({ version: '4' })) albumId: string, @Body() dto: BulkIdsDto) {
    const { sub } = req.user as AuthenticatedUser;
    const album = await this.albumRepository.findOne({ where: { id: albumId, ownerId: sub } });
    if (!album) throw new NotFoundException({ code: 'ALBUM_NOT_FOUND' });
    const { affected } = await this.placementRepository.delete({ albumId, mediaId: In(dto.ids) });
    if (album.coverMediaId && dto.ids.includes(album.coverMediaId)) {
      await this.albumRepository.update({ id: album.id }, { coverMediaId: null });
    }
    return { removed: affected ?? 0 };
  }

  /**
   * Définit la vignette de couverture d'un album.
   *
   * @remarks `PATCH /api/library/albums/:albumId/cover/:mediaId`, répondant en 200. Route protégée par le
   * garde `access-token` et limitée à soixante requêtes par minute. Les deux identifiants d'URL sont contrôlés
   * au format UUID version 4. L'album est chargé avec un filtre sur le propriétaire, puis l'appartenance du
   * média à cet album est vérifiée par la présence du placement, ce qui interdit de désigner en couverture un
   * média extérieur à l'album ou détenu par un autre compte.
   * @param req - Requête Express portant `req.user` injecté par la stratégie d'accès.
   * @param albumId - Identifiant de l'album concerné, contrôlé au format UUID version 4.
   * @param mediaId - Identifiant du média à promouvoir en couverture, contrôlé au format UUID version 4.
   * @returns Identifiant de l'album et identifiant de la couverture retenue.
   * @throws NotFoundException `ALBUM_NOT_FOUND` avec le statut 404 si l'album n'existe pas ou n'appartient pas au compte.
   * @throws BadRequestException `NOT_IN_ALBUM` avec le statut 400 si le média n'est pas rangé dans cet album.
   */
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: "Définir la couverture d'un album" })
  @Patch('/albums/:albumId/cover/:mediaId')
  @HttpCode(HttpStatus.OK)
  async setCover(@Req() req: Request, @Param('albumId', new ParseUUIDPipe({ version: '4' })) albumId: string, @Param('mediaId', new ParseUUIDPipe({ version: '4' })) mediaId: string) {
    const { sub } = req.user as AuthenticatedUser;
    const album = await this.albumRepository.findOne({ where: { id: albumId, ownerId: sub } });
    if (!album) throw new NotFoundException({ code: 'ALBUM_NOT_FOUND' });
    const placed = await this.placementRepository.findOne({ where: { albumId, mediaId } });
    if (!placed) throw new BadRequestException({ code: 'NOT_IN_ALBUM' });
    await this.albumRepository.update({ id: album.id }, { coverMediaId: mediaId });
    return { id: album.id, coverMediaId: mediaId };
  }

  /**
   * Supprime un album du compte authentifié en laissant ses médias dans la bibliothèque.
   *
   * @remarks `DELETE /api/library/albums/:albumId`, répondant en 200. Route protégée par le garde
   * `access-token` et limitée à trente requêtes par minute. L'identifiant est contrôlé au format UUID version 4
   * et l'album est chargé avec un filtre sur le propriétaire avant suppression. Seuls les placements
   * disparaissent, par cascade de la clé étrangère, les médias eux mêmes restent en bibliothèque et gardent
   * leur état de publication.
   * @param req - Requête Express portant `req.user` injecté par la stratégie d'accès.
   * @param albumId - Identifiant de l'album à supprimer, contrôlé au format UUID version 4.
   * @returns Un indicateur de succès à vrai.
   * @throws NotFoundException `ALBUM_NOT_FOUND` avec le statut 404 si l'album n'existe pas ou n'appartient pas au compte.
   */
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Supprimer un album (les médias restent en bibliothèque)' })
  @Delete('/albums/:albumId')
  @HttpCode(HttpStatus.OK)
  async deleteAlbum(@Req() req: Request, @Param('albumId', new ParseUUIDPipe({ version: '4' })) albumId: string) {
    const { sub } = req.user as AuthenticatedUser;
    const album = await this.albumRepository.findOne({ where: { id: albumId, ownerId: sub } });
    if (!album) throw new NotFoundException({ code: 'ALBUM_NOT_FOUND' });
    await this.albumRepository.delete({ id: album.id });
    return { success: true };
  }
}
