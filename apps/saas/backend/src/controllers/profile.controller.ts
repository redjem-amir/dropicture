// dropicture/apps/saas/backend/src/controllers/profile.controller.ts
import { BadRequestException, Body, Controller, Delete, Get, Headers, HttpCode, HttpStatus, NotFoundException, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, IsNull, Not, Repository } from 'typeorm';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import type { Request } from 'express';
import { MediaService } from '../services/media.service';
import type { AuthenticatedUser } from '../services/auth.service';
import { Account } from '../models/account.entity';
import { Media } from '../models/media.entity';

/**
 * Origine publique servant à composer l'URL de partage du profil. La valeur est figée en dur par
 * environnement plutôt que déduite des en-têtes de la requête, un `Host` falsifié ne peut donc pas
 * se retrouver dans un lien renvoyé au client.
 */
const SITE = process.env.NODE_ENV === 'production' ? 'https://dropicture.com' : 'http://localhost:3000';

/**
 * Bornes appliquées aux entrées du domaine profil. `BIO_MAX` cadre la bio sur un texte court,
 * `BULK_MAX` plafonne un lot de dépublication pour borner la clause `IN` envoyée en base,
 * `PAGE_MAX` et `PAGE_DEFAULT` bornent la pagination même lorsque le client réclame une page
 * plus large.
 */
export const PROFILE_LIMITS = {
  BIO_MAX: 160,
  BULK_MAX: 200,
  PAGE_MAX: 120,
  PAGE_DEFAULT: 48,
} as const;

/**
 * Corps attendu par la modification de bio.
 *
 * @remarks Le rognage a lieu avant la validation, la limite de longueur ne peut donc pas être
 * contournée avec des espaces et une saisie composée uniquement d'espaces devient une chaîne vide.
 */
class UpdateBioDto {
  /** Bio facultative, rognée puis limitée à `PROFILE_LIMITS.BIO_MAX` caractères, code `BIO_TOO_LONG`. */
  @IsOptional()
  @IsString()
  @MaxLength(PROFILE_LIMITS.BIO_MAX, { message: 'BIO_TOO_LONG' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  bio?: string;
}

/**
 * Corps attendu par les opérations en lot sur les médias.
 *
 * @remarks Le format UUID version 4 est imposé sur chaque élément, ce qui écarte toute valeur
 * arbitraire avant que les identifiants n'atteignent le dépôt.
 */
class BulkIdsDto {
  /** Identifiants ciblés, lot non vide (`NO_MEDIA`) et plafonné à `PROFILE_LIMITS.BULK_MAX` (`TOO_MANY_ITEMS`). */
  @IsArray()
  @ArrayNotEmpty({ message: 'NO_MEDIA' })
  @ArrayMaxSize(PROFILE_LIMITS.BULK_MAX, { message: 'TOO_MANY_ITEMS' })
  @IsUUID('4', { each: true })
  ids!: string[];
}

/**
 * Contrôleur du domaine profil. Expose la consultation du profil du compte authentifié, la
 * modification de la bio, la liste paginée des médias publiés, la dépublication en lot et la
 * gestion de la photo de profil sous le préfixe /api/profile.
 *
 * @remarks Le garde `access-token` est déclaré au niveau de la classe, aucune route n'est publique
 * et le cookie de session est résolu en amont par la stratégie d'accès. Toutes les requêtes en base
 * sont cloisonnées sur `req.user.sub`, jamais sur un identifiant de compte transmis par le client,
 * ce qui interdit l'accès horizontal aux médias d'un autre propriétaire. Chaque route porte sa
 * propre limitation de débit, cent vingt requêtes par minute sur la lecture du profil, trente sur
 * la modification de bio, deux cent quarante sur la pagination des médias, soixante sur la
 * dépublication et vingt sur les deux opérations d'avatar.
 */
@ApiTags('Profil')
@ApiCookieAuth('session')
@Controller('/api/profile')
@UseGuards(AuthGuard('access-token'))
export class ProfileController {
  constructor(
    private readonly media: MediaService,
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    @InjectRepository(Media)
    private readonly mediaRepository: Repository<Media>,
  ) {}

  /**
   * Retourne le profil du compte authentifié avec ses compteurs de médias et son avatar courant.
   *
   * @remarks `GET /api/profile`. Route protégée par le garde `access-token` déclaré sur la classe.
   * Limitée à cent vingt requêtes par minute. L'avatar n'est chargé que si le compte référence un
   * média et la recherche est doublement filtrée sur l'identifiant et sur `ownerId`, une référence
   * pointant vers le média d'un autre compte ne remonte donc rien. Les trois agrégats sont calculés
   * en parallèle et ne comptent que les médias de rôle `content`.
   * @param req - Requête Express portant `req.user` injecté par la stratégie d'accès, dont `sub`
   * fournit l'identifiant du compte.
   * @returns Nom d'utilisateur, prénom, nom, bio, URL publique du profil construite sur `SITE`,
   * vue de l'avatar ou `null`, compteurs `published` et `inLibrary`, date ISO de la première
   * publication ou `null`, et bornes de téléversement exposées par le service média.
   * @throws NotFoundException `ACCOUNT_NOT_FOUND` avec le statut 404 si le compte de la session
   * n'existe plus en base.
   */
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @ApiOperation({ summary: 'Afficher mon profil (compteurs, avatar, URL publique)' })
  @Get('/')
  async show(@Req() req: Request) {
    const { sub } = req.user as AuthenticatedUser;
    const account = await this.accountRepository.findOne({ where: { id: sub } });
    if (!account) throw new NotFoundException({ code: 'ACCOUNT_NOT_FOUND' });
    const avatar = account.avatarMediaId ? await this.mediaRepository.findOne({ where: { id: account.avatarMediaId, ownerId: sub } }) : null;
    const [published, inLibrary, first] = await Promise.all([
      this.mediaRepository.count({
        where: { ownerId: sub, role: 'content', publishedAt: Not(IsNull()) },
      }),
      this.mediaRepository.count({
        where: { ownerId: sub, role: 'content', publishedAt: IsNull() },
      }),
      this.mediaRepository
        .createQueryBuilder('m')
        .select('MIN(m.publishedAt)', 'first')
        .where('m.ownerId = :sub', { sub })
        .andWhere("m.role = 'content'")
        .andWhere('m.publishedAt IS NOT NULL')
        .getRawOne<{ first: Date | null }>(),
    ]);
    return {
      username: account.username,
      firstname: account.firstname,
      lastname: account.lastname,
      bio: account.bio,
      publicUrl: `${SITE}/u/?u=${account.username}`,
      avatar: avatar ? this.media.view(avatar) : null,
      counts: { published, inLibrary },
      firstPublishedAt: first?.first ? new Date(first.first).toISOString() : null,
      limits: this.media.limits(),
    };
  }

  /**
   * Remplace la bio du compte authentifié, ou l'efface lorsque la valeur reçue est vide.
   *
   * @remarks `PATCH /api/profile`. Route protégée par le garde `access-token` déclaré sur la classe.
   * Limitée à trente requêtes par minute. La mise à jour porte sur la seule clé `id` égale au sujet
   * de la session, aucune autre colonne n'est modifiable par cette route. Une bio absente ou réduite
   * à une chaîne vide après rognage est enregistrée à `null` plutôt qu'à une chaîne vide.
   * @param req - Requête Express portant `req.user` injecté par la stratégie d'accès.
   * @param dto - Corps validé exposant la bio facultative déjà rognée et bornée en longueur.
   * @returns La bio effectivement enregistrée, `null` si elle a été effacée.
   * @throws BadRequestException `BIO_TOO_LONG` avec le statut 400, levée par la validation du corps
   * au delà de `PROFILE_LIMITS.BIO_MAX` caractères.
   * @throws NotFoundException `ACCOUNT_NOT_FOUND` avec le statut 404 si la mise à jour n'affecte
   * aucune ligne, donc si le compte de la session a disparu.
   */
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Modifier ma bio' })
  @Patch('/')
  async updateBio(@Req() req: Request, @Body() dto: UpdateBioDto) {
    const { sub } = req.user as AuthenticatedUser;
    const bio = dto.bio?.length ? dto.bio : null;
    const result = await this.accountRepository.update({ id: sub }, { bio });
    if (!result.affected) throw new NotFoundException({ code: 'ACCOUNT_NOT_FOUND' });
    return { bio };
  }

  /**
   * Liste les médias publiés du compte authentifié, page par page, du plus récent au plus ancien.
   *
   * @remarks `GET /api/profile/media`. Route protégée par le garde `access-token` déclaré sur la
   * classe. Limitée à deux cent quarante requêtes par minute. La pagination est un curseur composite
   * sur le couple `publishedAt` puis `id`, tous deux décroissants, ce qui évite le décalage
   * d'`OFFSET` quand des médias sont publiés ou dépubliés entre deux pages. La taille demandée est
   * ramenée entre un et `PROFILE_LIMITS.PAGE_MAX`, une valeur non numérique retombe sur
   * `PROFILE_LIMITS.PAGE_DEFAULT`. Un élément de plus que la page est lu pour détecter la suite sans
   * requête de comptage, puis retiré du résultat. Le curseur est décodé en base64url et ses deux
   * composantes sont réinjectées comme paramètres liés, jamais concaténées dans le SQL.
   * @param req - Requête Express portant `req.user` injecté par la stratégie d'accès.
   * @param cursor - Curseur opaque renvoyé par l'appel précédent, encodé en base64url sous la forme
   * date ISO puis `|` puis identifiant du dernier élément servi.
   * @param limit - Taille de page demandée sous forme de chaîne de requête, bornée par le code.
   * @returns `items`, la vue de chaque média enrichie de sa date de publication au format ISO, et
   * `nextCursor`, curseur de la page suivante ou `null` s'il n'y a plus rien à servir.
   * @throws BadRequestException `BAD_CURSOR` avec le statut 400 si le curseur décodé ne contient pas
   * une date exploitable et un identifiant.
   */
  @Throttle({ default: { limit: 240, ttl: 60000 } })
  @ApiOperation({ summary: 'Lister mes médias publiés (pagination par curseur)' })
  @Get('/media')
  async listMedia(@Req() req: Request, @Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    const { sub } = req.user as AuthenticatedUser;
    const take = Math.min(PROFILE_LIMITS.PAGE_MAX, Math.max(1, Number(limit) || PROFILE_LIMITS.PAGE_DEFAULT));
    const qb = this.mediaRepository
      .createQueryBuilder('m')
      .where('m.ownerId = :sub', { sub })
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

  /**
   * Dépublie un lot de médias appartenant au compte authentifié et détaille les échecs élément par
   * élément.
   *
   * @remarks `PATCH /api/profile/media/unpublish`, réponse forcée au statut 200. Route protégée par
   * le garde `access-token` déclaré sur la classe. Limitée à soixante requêtes par minute. Le service
   * média applique la mise à jour sur les seuls identifiants dont `ownerId` correspond au sujet de la
   * session et exclut le rôle `avatar`, un avatar reste donc toujours diffusable. L'opération est
   * partiellement tolérante, elle n'échoue pas globalement, les identifiants non traités sont relus
   * dans un second temps pour être qualifiés. Cette relecture est elle aussi filtrée sur `ownerId`,
   * un identifiant appartenant à un autre compte est donc indistinguable d'un identifiant inexistant.
   * @param req - Requête Express portant `req.user` injecté par la stratégie d'accès.
   * @param dto - Corps validé exposant un lot d'UUID version 4 non vide et plafonné.
   * @returns `done`, les identifiants effectivement dépubliés, et `failed`, un couple identifiant et
   * code par échec, `MEDIA_NOT_FOUND` si le média est absent ou détenu par un autre compte,
   * `AVATAR_ALWAYS_PUBLIC` pour un avatar, `ALREADY_PRIVATE` si le média n'était pas publié, sinon
   * `UNPUBLISH_FAILED`.
   * @throws BadRequestException `NO_MEDIA` ou `TOO_MANY_ITEMS` avec le statut 400, levée par la
   * validation du corps sur un lot vide ou dépassant `PROFILE_LIMITS.BULK_MAX` éléments.
   */
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Dépublier des médias' })
  @Patch('/media/unpublish')
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
        if (m.role === 'avatar') return { id, code: 'AVATAR_ALWAYS_PUBLIC' };
        if (!m.publishedAt) return { id, code: 'ALREADY_PRIVATE' };
        return { id, code: 'UNPUBLISH_FAILED' };
      });
    }
    return { done, failed };
  }

  /**
   * Téléverse la photo de profil du compte authentifié, la rattache au compte puis supprime les
   * avatars devenus obsolètes.
   *
   * @remarks `POST /api/profile/avatar`. Route protégée par le garde `access-token` déclaré sur la
   * classe. Limitée à vingt requêtes par minute. Le corps brut de la requête est passé au service
   * média comme flux, sans mise en tampon complète en mémoire ni fichier temporaire, et le service
   * coupe l'envoi dès que le quota d'octets est dépassé même si `content-length` mentait ou était
   * absent. Le type est déduit du seul type MIME déclaré, paramètres comme `charset` retirés, puis
   * confronté à la liste blanche des formats d'avatar. La référence du compte est mise à jour avant
   * la purge, l'ancien objet n'est donc jamais supprimé tant que le nouveau n'est pas rattaché. La
   * purge délègue au service média, qui efface les objets, les lignes puis invalide le cache de
   * diffusion.
   * @param req - Requête Express, servant à la fois de porteur de `req.user` et de flux de données
   * pour le corps téléversé.
   * @param contentType - En-tête `content-type` déclaré par le client, source du type MIME retenu.
   * @param contentLength - En-tête `content-length` facultatif, utilisé comme refus anticipé avant
   * de commencer à consommer le flux.
   * @returns Vue du média créé, identifiant, nature, dimensions, durée et URL de diffusion.
   * @throws BadRequestException `UNSUPPORTED_MEDIA_TYPE` avec le statut 400 si l'en-tête
   * `content-type` est absent, ou propagée par le service média si le type déclaré n'est pas un
   * format d'avatar accepté.
   * @throws BadRequestException `FILE_TOO_LARGE` avec le statut 400, propagée par le service média
   * quand la taille annoncée ou réellement reçue dépasse le quota d'avatar.
   * @throws BadRequestException `FILE_REQUIRED` avec le statut 400, propagée par le service média
   * quand le flux ne contient aucun octet.
   * @throws BadRequestException `UPLOAD_FAILED` avec le statut 400, propagée par le service média
   * quand l'envoi vers le stockage objet est interrompu.
   */
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Téléverser une photo de profil (remplace la précédente)' })
  @Post('/avatar')
  async uploadAvatar(@Req() req: Request, @Headers('content-type') contentType?: string, @Headers('content-length') contentLength?: string) {
    const { sub } = req.user as AuthenticatedUser;
    if (!contentType) throw new BadRequestException({ code: 'UNSUPPORTED_MEDIA_TYPE' });
    const media = await this.media.upload({
      ownerId: sub,
      role: 'avatar',
      stream: req,
      mimeType: contentType.split(';')[0].trim(),
      contentLength: Number(contentLength) || undefined,
    });
    await this.accountRepository.update({ id: sub }, { avatarMediaId: media.id });
    const stale = await this.mediaRepository.find({
      where: { ownerId: sub, role: 'avatar', id: Not(media.id) },
      select: { id: true },
    });
    await this.media.destroy(
      sub,
      stale.map((m) => m.id),
    );
    return this.media.view(media);
  }

  /**
   * Détache la photo de profil du compte authentifié et supprime définitivement les médias d'avatar
   * associés.
   *
   * @remarks `DELETE /api/profile/avatar`, réponse forcée au statut 200. Route protégée par le garde
   * `access-token` déclaré sur la classe. Limitée à vingt requêtes par minute. La référence portée
   * par le compte est remise à `null` avant la suppression, ce qui évite de laisser une référence
   * pendante vers une ligne déjà effacée. La suppression vise tous les médias de rôle `avatar` du
   * propriétaire, pas uniquement celui référencé, ce qui nettoie d'éventuels restes. Elle délègue au
   * service média, qui efface les objets du stockage, les lignes en base puis invalide le cache de
   * diffusion afin que l'ancienne image ne reste pas servie par le réseau de diffusion.
   * @param req - Requête Express portant `req.user` injecté par la stratégie d'accès.
   * @returns Un objet dont le champ `avatar` vaut `null`, marquant l'absence de photo de profil.
   * @throws NotFoundException `ACCOUNT_NOT_FOUND` avec le statut 404 si le compte de la session
   * n'existe plus en base.
   */
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Supprimer la photo de profil' })
  @Delete('/avatar')
  @HttpCode(HttpStatus.OK)
  async removeAvatar(@Req() req: Request) {
    const { sub } = req.user as AuthenticatedUser;
    const account = await this.accountRepository.findOne({ where: { id: sub } });
    if (!account) throw new NotFoundException({ code: 'ACCOUNT_NOT_FOUND' });
    await this.accountRepository.update({ id: sub }, { avatarMediaId: null });
    const stale = await this.mediaRepository.find({
      where: { ownerId: sub, role: 'avatar' },
      select: { id: true },
    });
    await this.media.destroy(
      sub,
      stale.map((m) => m.id),
    );
    return { avatar: null };
  }
}
