// dropicture/apps/saas/backend/src/controllers/settings.controller.ts
import { Body, Controller, Delete, Get, HttpCode, HttpException, HttpStatus, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { hash as argon2Hash, verify as argon2Verify } from '@node-rs/argon2';
import { Throttle } from '@nestjs/throttler';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Account } from '../models/account.entity';
import { Media } from '../models/media.entity';
import { MediaService } from '../services/media.service';
import { ACCESS_TOKEN_TTL_SECONDS, ARGON2_OPTIONS, AUTH_COOKIES, AuthService, SESSION_COOKIE_OPTIONS, generateApiKey, type AuthenticatedUser } from '../services/auth.service';
import { NAME_PATTERN, RESERVED_USERNAMES, USERNAME_PATTERN, normalizeName } from './auth.controller';

/**
 * Origine publique servant à composer le lien de profil renvoyé au client, domaine de production ou
 * serveur local du frontend selon l'environnement. La valeur est décidée côté serveur à partir de
 * `NODE_ENV` et jamais reconstruite depuis un en-tête entrant, ce qui interdit toute réécriture du
 * lien par un `Host` falsifié.
 */
const SITE = process.env.NODE_ENV === 'production' ? 'https://dropicture.com' : 'http://localhost:3000';

/**
 * Charge utile de modification de l'identité civile. Prénom et nom sont bornés entre deux et trente
 * caractères et contraints au motif `NAME_PATTERN` partagé avec l'inscription, ce qui restreint la
 * saisie aux lettres accentuées, espaces, apostrophes et tirets et écarte les balises.
 */
export class UpdateProfileDto {
  @IsString()
  @IsNotEmpty({ message: 'MISSING_FIELDS' })
  @MinLength(2, { message: 'INVALID_NAME' })
  @MaxLength(30, { message: 'INVALID_NAME' })
  @Matches(NAME_PATTERN, { message: 'INVALID_NAME' })
  firstname: string;

  @IsString()
  @IsNotEmpty({ message: 'MISSING_FIELDS' })
  @MinLength(2, { message: 'INVALID_NAME' })
  @MaxLength(30, { message: 'INVALID_NAME' })
  @Matches(NAME_PATTERN, { message: 'INVALID_NAME' })
  lastname: string;
}

/**
 * Charge utile de changement d'identifiant public. La transformation en minuscules sans espaces de
 * bord produit une forme canonique, indispensable puisque l'unicité repose sur l'index
 * `UQ_accounts_username`. La longueur est bornée entre trois et trente caractères, le motif complet
 * est vérifié dans la route.
 */
export class UpdateUsernameDto {
  @IsString()
  @IsNotEmpty({ message: 'MISSING_FIELDS' })
  @MinLength(3, { message: 'USERNAME_TOO_SHORT' })
  @MaxLength(30, { message: 'USERNAME_TOO_LONG' })
  @Transform(({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  username: string;
}

/**
 * Charge utile de changement d'adresse électronique. La normalisation en minuscules sans espaces de
 * bord évite les doublons de casse sur l'index unique `UQ_accounts_email`, toute adresse mal formée
 * est rejetée sous le code `EMAIL_INVALID`.
 */
export class UpdateEmailDto {
  @IsEmail({}, { message: 'EMAIL_INVALID' })
  @IsNotEmpty({ message: 'EMAIL_INVALID' })
  @Transform(({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  email: string;
}

/**
 * Charge utile de rotation du mot de passe. Le mot de passe courant est exigé comme preuve de
 * possession du compte, le nouveau doit atteindre huit caractères et mélanger majuscule, minuscule,
 * chiffre et caractère spécial. Les deux champs sont plafonnés à cent vingt-huit caractères pour
 * borner le coût du hachage Argon2id et écarter les charges utiles de déni de service.
 */
export class UpdatePasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'INVALID_CREDENTIALS' })
  @MaxLength(128)
  currentPassword: string;

  @IsString()
  @IsNotEmpty({ message: 'MISSING_FIELDS' })
  @MinLength(8, { message: 'PASSWORD_TOO_SHORT' })
  @MaxLength(128, { message: 'PASSWORD_TOO_LONG' })
  @Matches(/[A-Z]/, { message: 'PASSWORD_MISSING_UPPERCASE' })
  @Matches(/[a-z]/, { message: 'PASSWORD_MISSING_LOWERCASE' })
  @Matches(/[0-9]/, { message: 'PASSWORD_MISSING_NUMBER' })
  @Matches(/[^A-Za-z0-9]/, { message: 'PASSWORD_MISSING_SPECIAL' })
  newPassword: string;
}

/**
 * Charge utile de suppression de compte. Le mot de passe courant sert de réauthentification avant une
 * opération irréversible, il est plafonné à cent vingt-huit caractères comme pour la connexion.
 */
export class DeleteAccountDto {
  @IsString()
  @IsNotEmpty({ message: 'INVALID_CREDENTIALS' })
  @MaxLength(128)
  password: string;
}

/**
 * Contrôleur du domaine paramètres du compte. Expose la consultation du profil et de l'usage du
 * stockage, la modification de l'identité civile, de l'identifiant public, de l'adresse électronique
 * et du mot de passe, la gestion de la clé d'API et la suppression définitive du compte sous le
 * préfixe /api/settings.
 *
 * @remarks Le garde `access-token` est appliqué à la classe entière, aucune route n'est publique et
 * l'identifiant de compte est toujours lu dans `req.user.sub` plutôt que dans la charge utile, ce qui
 * rend impossible l'accès horizontal à un autre compte. Le hachage du mot de passe et la clé d'API
 * sont des colonnes exclues des lectures par défaut, elles ne sont rapatriées qu'avec un `addSelect`
 * explicite dans les deux routes qui en ont besoin. Les opérations sensibles réauthentifient par mot
 * de passe et portent une limitation de débit resserrée, cinq requêtes par minute sur la rotation ou
 * la révocation de clé et sur la suppression de compte, dix sur les changements d'identifiant,
 * d'adresse et de mot de passe.
 */
@ApiTags('Paramètres')
@ApiCookieAuth('session')
@Controller('/api/settings')
@UseGuards(AuthGuard('access-token'))
export class SettingsController {
  /** Injecte le service de médias, les dépôts TypeORM des comptes et des médias, et le service d'authentification. */
  constructor(
    private readonly media: MediaService,
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    @InjectRepository(Media)
    private readonly mediaRepository: Repository<Media>,
    private readonly authService: AuthService,
  ) {}

  /**
   * Retourne le profil du compte authentifié, son lien public et une synthèse de son occupation de stockage.
   *
   * @remarks `GET /api/settings/`. Route protégée par le garde `access-token`, le cookie de session est
   * résolu en amont par la stratégie d'accès. Limitée à cent vingt requêtes par minute. L'agrégation est
   * faite en une seule requête SQL avec des compteurs conditionnels, restreinte aux médias dont
   * `ownerId` est le compte appelant et dont le rôle vaut `content`, ce qui exclut les avatars du calcul.
   * La somme des octets est castée en `BIGINT` puis renvoyée sous forme de chaîne pour éviter la perte
   * de précision des entiers JavaScript sur les gros volumes.
   * @param req - Requête Express portant `req.user` injecté par la stratégie d'accès.
   * @returns Identifiant public, prénom, nom, adresse électronique, URL publique du profil, date de
   * création au format ISO, un objet `storage` avec les octets consommés en chaîne, le nombre d'images,
   * de vidéos, de médias publiés et de médias privés, et un objet `limits` décrivant les plafonds de
   * taille et les types acceptés.
   * @throws HttpException `ACCOUNT_NOT_FOUND` avec le statut 404 si le compte de la session n'existe plus.
   */
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @ApiOperation({ summary: "Afficher les paramètres et l'usage du stockage" })
  @Get('/')
  async show(@Req() req: Request) {
    const { sub } = req.user as AuthenticatedUser;
    const account = await this.accountRepository.findOne({ where: { id: sub } });
    if (!account) throw new HttpException({ code: 'ACCOUNT_NOT_FOUND' }, HttpStatus.NOT_FOUND);

    const row = await this.mediaRepository
      .createQueryBuilder('m')
      .select('COALESCE(SUM(CAST(m.bytes AS BIGINT)), 0)', 'bytes')
      .addSelect("COUNT(*) FILTER (WHERE m.mimeType LIKE 'image/%')", 'images')
      .addSelect("COUNT(*) FILTER (WHERE m.mimeType LIKE 'video/%')", 'videos')
      .addSelect('COUNT(*) FILTER (WHERE m.publishedAt IS NOT NULL)', 'published')
      .addSelect('COUNT(*) FILTER (WHERE m.publishedAt IS NULL)', 'private')
      .where('m.ownerId = :ownerId', { ownerId: sub })
      .andWhere("m.role = 'content'")
      .getRawOne<{
        bytes: string;
        images: string;
        videos: string;
        published: string;
        private: string;
      }>();

    return {
      username: account.username,
      firstname: account.firstname,
      lastname: account.lastname,
      email: account.email,
      publicUrl: `${SITE}/u/?u=${account.username}`,
      createdAt: account.createdAt.toISOString(),
      storage: {
        bytes: String(row?.bytes ?? 0),
        images: Number(row?.images ?? 0),
        videos: Number(row?.videos ?? 0),
        published: Number(row?.published ?? 0),
        private: Number(row?.private ?? 0),
      },
      limits: this.media.limits(),
    };
  }

  /**
   * Met à jour le prénom et le nom du compte authentifié.
   *
   * @remarks `PATCH /api/settings/me`. Route protégée par le garde `access-token`. Limitée à vingt
   * requêtes par minute. Les deux valeurs passent par `normalizeName`, qui compacte les espaces et les
   * tirets, puis les bornes de longueur sont revérifiées après normalisation car la normalisation peut
   * raccourcir une saisie que la validation du DTO avait acceptée. La mise à jour est filtrée sur
   * l'identifiant de session, jamais sur un identifiant fourni par le client.
   * @param body - Charge utile validée contenant le prénom et le nom souhaités.
   * @param req - Requête Express portant `req.user` injecté par la stratégie d'accès.
   * @returns Un indicateur `success` à vrai, le prénom et le nom effectivement enregistrés après normalisation.
   * @throws HttpException `INVALID_NAME` avec le statut 400 si le prénom ou le nom normalisé sort de la
   * plage de deux à trente caractères.
   * @throws HttpException `ACCOUNT_NOT_FOUND` avec le statut 404 si aucune ligne n'a été affectée par la mise à jour.
   */
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Modifier nom et prénom' })
  @Patch('/me')
  @HttpCode(HttpStatus.OK)
  async updateProfile(@Body() body: UpdateProfileDto, @Req() req: Request) {
    const { sub } = req.user as AuthenticatedUser;
    const firstname = normalizeName(body.firstname);
    const lastname = normalizeName(body.lastname);
    if (firstname.length < 2 || firstname.length > 30 || lastname.length < 2 || lastname.length > 30) {
      throw new HttpException({ code: 'INVALID_NAME' }, HttpStatus.BAD_REQUEST);
    }
    const result = await this.accountRepository.update({ id: sub }, { firstname, lastname });
    if (!result.affected) throw new HttpException({ code: 'ACCOUNT_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    return { success: true, firstname, lastname };
  }

  /**
   * Change l'identifiant public du compte authentifié après contrôle du motif, de la liste réservée et de l'unicité.
   *
   * @remarks `PATCH /api/settings/username`. Route protégée par le garde `access-token`. Limitée à dix
   * requêtes par minute. La valeur arrive déjà en minuscules grâce à la transformation du DTO, elle est
   * ensuite confrontée à `USERNAME_PATTERN` puis à `RESERVED_USERNAMES` pour éviter qu'un compte
   * s'approprie un segment d'URL de la plateforme. Reprendre son propre identifiant est traité comme une
   * opération idempotente et n'écrit rien en base. Le contrôle d'unicité en amont sert le message
   * d'erreur métier, l'index unique `UQ_accounts_username` reste le garde-fou en cas de course.
   * @param body - Charge utile validée contenant l'identifiant public souhaité, déjà normalisé en minuscules.
   * @param req - Requête Express portant `req.user` injecté par la stratégie d'accès.
   * @returns Un indicateur `success` à vrai, l'identifiant retenu et l'URL publique du profil recalculée.
   * @throws HttpException `USERNAME_INVALID` avec le statut 400 si l'identifiant ne respecte pas le motif attendu.
   * @throws HttpException `USERNAME_RESERVED` avec le statut 400 si l'identifiant figure parmi les noms réservés.
   * @throws HttpException `ACCOUNT_NOT_FOUND` avec le statut 404 si le compte de la session n'existe plus.
   * @throws HttpException `USERNAME_ALREADY_USED` avec le statut 409 si un autre compte porte déjà cet identifiant.
   */
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: "Changer de nom d'utilisateur" })
  @Patch('/username')
  @HttpCode(HttpStatus.OK)
  async updateUsername(@Body() body: UpdateUsernameDto, @Req() req: Request) {
    const { sub } = req.user as AuthenticatedUser;
    const username = body.username;
    if (!USERNAME_PATTERN.test(username)) {
      throw new HttpException({ code: 'USERNAME_INVALID' }, HttpStatus.BAD_REQUEST);
    }
    if (RESERVED_USERNAMES.has(username)) {
      throw new HttpException({ code: 'USERNAME_RESERVED' }, HttpStatus.BAD_REQUEST);
    }
    const account = await this.accountRepository.findOne({ where: { id: sub } });
    if (!account) throw new HttpException({ code: 'ACCOUNT_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    if (account.username === username) {
      return { success: true, username, publicUrl: `${SITE}/u/?u=${username}` };
    }
    const taken = await this.accountRepository.exists({ where: { username } });
    if (taken) throw new HttpException({ code: 'USERNAME_ALREADY_USED' }, HttpStatus.CONFLICT);
    await this.accountRepository.update({ id: sub }, { username });
    return { success: true, username, publicUrl: `${SITE}/u/?u=${username}` };
  }

  /**
   * Change l'adresse électronique du compte authentifié après contrôle d'unicité.
   *
   * @remarks `PATCH /api/settings/email`. Route protégée par le garde `access-token`. Limitée à dix
   * requêtes par minute. L'adresse arrive normalisée en minuscules par le DTO. Soumettre l'adresse déjà
   * enregistrée est traité comme une opération idempotente sans écriture. La recherche de collision ne
   * sélectionne que l'identifiant du compte concurrent, elle ne divulgue donc aucune donnée du compte
   * tiers, et l'index unique `UQ_accounts_email` reste le garde-fou en cas de course.
   * @param body - Charge utile validée contenant la nouvelle adresse électronique.
   * @param req - Requête Express portant `req.user` injecté par la stratégie d'accès.
   * @returns Un indicateur `success` à vrai et l'adresse électronique retenue.
   * @throws HttpException `ACCOUNT_NOT_FOUND` avec le statut 404 si le compte de la session n'existe plus.
   * @throws HttpException `EMAIL_ALREADY_USED` avec le statut 409 si l'adresse est déjà rattachée à un autre compte.
   */
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: "Changer d'adresse e-mail" })
  @Patch('/email')
  @HttpCode(HttpStatus.OK)
  async updateEmail(@Body() body: UpdateEmailDto, @Req() req: Request) {
    const { sub } = req.user as AuthenticatedUser;
    const account = await this.accountRepository.findOne({ where: { id: sub } });
    if (!account) throw new HttpException({ code: 'ACCOUNT_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    if (account.email === body.email) return { success: true, email: account.email };
    const existing = await this.accountRepository.findOne({
      where: { email: body.email },
      select: { id: true },
    });
    if (existing && existing.id !== account.id) {
      throw new HttpException({ code: 'EMAIL_ALREADY_USED' }, HttpStatus.CONFLICT);
    }
    await this.accountRepository.update({ id: account.id }, { email: body.email });
    return { success: true, email: body.email };
  }

  /**
   * Remplace le mot de passe du compte authentifié, invalide toutes les sessions existantes et ouvre une session neuve.
   *
   * @remarks `PATCH /api/settings/password`. Route protégée par le garde `access-token`. Limitée à dix
   * requêtes par minute. Le hachage courant est une colonne exclue des lectures par défaut, il est
   * rapatrié par un `addSelect` dédié, puis vérifié avec Argon2id, l'échec de vérification étant capté
   * pour renvoyer une erreur d'identifiants uniforme plutôt qu'une trace technique. Le nouveau secret est
   * haché avec `ARGON2_OPTIONS`, dix-neuf mégaoctets de mémoire et deux passes. `revokeAllTokens`
   * incrémente la version de jeton du compte, ce qui périme toutes les sessions ouvertes ailleurs, et la
   * session courante est en plus supprimée de Redis avant qu'une session neuve soit émise, de sorte que
   * l'appelant reste connecté sans réutiliser l'ancien couple identifiant de session et nonce.
   * @param body - Charge utile validée contenant le mot de passe courant et le nouveau mot de passe.
   * @param req - Requête Express portant `req.user`, le cookie de session courant, l'agent utilisateur et l'adresse IP.
   * @param res - Réponse Express utilisée pour déposer le cookie de session httpOnly et fixer le statut.
   * @returns Réponse 200 contenant un indicateur `success` à vrai et `expires_in`, la durée de vie en
   * secondes de la fenêtre d'accès de la nouvelle session.
   * @throws HttpException `ACCOUNT_NOT_FOUND` avec le statut 404 si le compte de la session n'existe plus,
   * avant ou après l'écriture du nouveau hachage.
   * @throws HttpException `INVALID_CREDENTIALS` avec le statut 401 si le mot de passe courant ne correspond pas.
   * @throws HttpException `PASSWORD_UNCHANGED` avec le statut 400 si le nouveau mot de passe est identique à l'ancien.
   */
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Changer de mot de passe (révoque toutes les sessions)' })
  @Patch('/password')
  async updatePassword(@Body() body: UpdatePasswordDto, @Req() req: Request, @Res() res: Response) {
    const { sub } = req.user as AuthenticatedUser;
    const account = await this.accountRepository.createQueryBuilder('a').addSelect('a.passwordHash').where('a.id = :sub', { sub }).getOne();
    if (!account) throw new HttpException({ code: 'ACCOUNT_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    const valid = await argon2Verify(account.passwordHash, body.currentPassword).catch(() => false);
    if (!valid) throw new HttpException({ code: 'INVALID_CREDENTIALS' }, HttpStatus.UNAUTHORIZED);
    if (body.newPassword === body.currentPassword) {
      throw new HttpException({ code: 'PASSWORD_UNCHANGED' }, HttpStatus.BAD_REQUEST);
    }
    const passwordHash = await argon2Hash(body.newPassword, ARGON2_OPTIONS);
    await this.accountRepository.update({ id: account.id }, { passwordHash });
    await this.authService.revokeAllTokens(account.id);
    const currentCookie = req.cookies?.[AUTH_COOKIES.SESSION] as string | undefined;
    if (currentCookie) {
      await this.authService.revokeSessionCookie(currentCookie).catch(() => undefined);
    }
    const refreshed = await this.accountRepository.findOne({ where: { id: account.id } });
    if (!refreshed) throw new HttpException({ code: 'ACCOUNT_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    const { cookie, maxAgeSeconds } = await this.authService.createSession(refreshed, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    res.cookie(AUTH_COOKIES.SESSION, cookie, {
      ...SESSION_COOKIE_OPTIONS,
      maxAge: maxAgeSeconds * 1000,
    });
    return res.status(HttpStatus.OK).send({ success: true, expires_in: ACCESS_TOKEN_TTL_SECONDS });
  }

  /**
   * Retourne la clé d'API en clair du compte authentifié et sa date d'émission.
   *
   * @remarks `GET /api/settings/apikey`. Route protégée par le garde `access-token`. Limitée à vingt
   * requêtes par minute. La clé est une colonne exclue des lectures par défaut, elle n'est rapatriée que
   * par le `addSelect` explicite de cette route, ce qui évite qu'elle fuite dans les autres réponses du
   * contrôleur. La lecture est filtrée sur l'identifiant de session.
   * @param req - Requête Express portant `req.user` injecté par la stratégie d'accès.
   * @returns La clé d'API ou `null` si aucune clé n'a été émise, et la date d'émission au format ISO ou `null`.
   * @throws HttpException `ACCOUNT_NOT_FOUND` avec le statut 404 si le compte de la session n'existe plus.
   */
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: "Récupérer la clé d'API" })
  @Get('/apikey')
  @HttpCode(HttpStatus.OK)
  async getApiKey(@Req() req: Request) {
    const { sub } = req.user as AuthenticatedUser;
    const account = await this.accountRepository.createQueryBuilder('a').addSelect('a.apiKey').where('a.id = :sub', { sub }).getOne();
    if (!account) throw new HttpException({ code: 'ACCOUNT_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    return { apiKey: account.apiKey ?? null, issuedAt: account.apiKeyIssuedAt?.toISOString() ?? null };
  }

  /**
   * Génère une nouvelle clé d'API pour le compte authentifié et remplace la précédente.
   *
   * @remarks `POST /api/settings/apikey`. Route protégée par le garde `access-token`. Limitée à cinq
   * requêtes par minute, la rotation étant une opération à effet immédiat sur les intégrations. La clé
   * provient de `generateApiKey`, vingt-quatre octets tirés du générateur cryptographique et encodés en
   * base64url. L'écriture écrase l'ancienne valeur, la clé remplacée cesse donc d'authentifier dès la
   * transaction validée, et l'horodatage d'émission est renvoyé pour l'affichage.
   * @param req - Requête Express portant `req.user` injecté par la stratégie d'accès.
   * @returns La nouvelle clé d'API en clair et sa date d'émission au format ISO.
   * @throws HttpException `ACCOUNT_NOT_FOUND` avec le statut 404 si aucune ligne n'a été affectée par la mise à jour.
   */
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: "Régénérer la clé d'API" })
  @Post('/apikey')
  @HttpCode(HttpStatus.OK)
  async rotateApiKey(@Req() req: Request) {
    const { sub } = req.user as AuthenticatedUser;
    const apiKey = generateApiKey();
    const issuedAt = new Date();
    const result = await this.accountRepository.update({ id: sub }, { apiKey, apiKeyIssuedAt: issuedAt });
    if (!result.affected) throw new HttpException({ code: 'ACCOUNT_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    return { apiKey, issuedAt: issuedAt.toISOString() };
  }

  /**
   * Révoque la clé d'API du compte authentifié.
   *
   * @remarks `DELETE /api/settings/apikey`. Route protégée par le garde `access-token`. Limitée à cinq
   * requêtes par minute. La clé et son horodatage d'émission sont remis à `null`, l'index unique partiel
   * `UQ_accounts_api_key` ne portant que sur les valeurs non nulles, plusieurs comptes peuvent coexister
   * sans clé. Toute intégration qui présentait cette clé perd l'accès dès la transaction validée.
   * @param req - Requête Express portant `req.user` injecté par la stratégie d'accès.
   * @returns Un indicateur `success` à vrai.
   * @throws HttpException `ACCOUNT_NOT_FOUND` avec le statut 404 si aucune ligne n'a été affectée par la mise à jour.
   */
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: "Révoquer la clé d'API" })
  @Delete('/apikey')
  @HttpCode(HttpStatus.OK)
  async revokeApiKey(@Req() req: Request) {
    const { sub } = req.user as AuthenticatedUser;
    const result = await this.accountRepository.update({ id: sub }, { apiKey: null, apiKeyIssuedAt: null });
    if (!result.affected) throw new HttpException({ code: 'ACCOUNT_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    return { success: true };
  }

  /**
   * Supprime définitivement le compte authentifié, ses médias stockés et la session courante, après confirmation par mot de passe.
   *
   * @remarks `DELETE /api/settings/account`. Route protégée par le garde `access-token`. Limitée à cinq
   * requêtes par minute. Le hachage est rapatrié par un `addSelect` dédié puis vérifié avec Argon2id, la
   * réauthentification étant exigée avant une opération irréversible. Les identifiants des médias du
   * propriétaire sont collectés sans charger les colonnes lourdes, puis `MediaService.destroy` supprime
   * les objets du bucket par lots, retire les lignes et demande une invalidation du cache de diffusion
   * afin qu'aucun média ne reste servi par le réseau après suppression. La ligne de compte est ensuite
   * supprimée, la relation en cascade nettoyant les médias résiduels. La session est enfin retirée de
   * Redis et le cookie effacé avec les mêmes options que celles utilisées pour le déposer, condition
   * nécessaire pour que le navigateur l'invalide effectivement.
   * @param body - Charge utile validée contenant le mot de passe de confirmation.
   * @param req - Requête Express portant `req.user` et le cookie de session courant.
   * @param res - Réponse Express utilisée pour effacer le cookie de session et fixer le statut.
   * @returns Réponse 200 contenant un indicateur `success` à vrai.
   * @throws HttpException `ACCOUNT_NOT_FOUND` avec le statut 404 si le compte de la session n'existe plus.
   * @throws HttpException `INVALID_CREDENTIALS` avec le statut 401 si le mot de passe de confirmation ne correspond pas.
   */
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Supprimer le compte et tous les médias' })
  @Delete('/account')
  async deleteAccount(@Body() body: DeleteAccountDto, @Req() req: Request, @Res() res: Response) {
    const { sub } = req.user as AuthenticatedUser;
    const account = await this.accountRepository.createQueryBuilder('a').addSelect('a.passwordHash').where('a.id = :sub', { sub }).getOne();
    if (!account) throw new HttpException({ code: 'ACCOUNT_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    const valid = await argon2Verify(account.passwordHash, body.password).catch(() => false);
    if (!valid) throw new HttpException({ code: 'INVALID_CREDENTIALS' }, HttpStatus.UNAUTHORIZED);
    const files = await this.mediaRepository.find({
      where: { ownerId: account.id },
      select: { id: true },
    });
    await this.media.destroy(
      account.id,
      files.map((f) => f.id),
    );
    await this.accountRepository.delete({ id: account.id });
    const currentCookie = req.cookies?.[AUTH_COOKIES.SESSION] as string | undefined;
    if (currentCookie) {
      await this.authService.revokeSessionCookie(currentCookie).catch(() => undefined);
    }
    res.clearCookie(AUTH_COOKIES.SESSION, SESSION_COOKIE_OPTIONS);
    return res.status(HttpStatus.OK).send({ success: true });
  }
}
