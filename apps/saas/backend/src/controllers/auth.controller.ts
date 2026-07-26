// dropicture/apps/saas/backend/src/controllers/auth.controller.ts
import { Body, Controller, Get, HttpCode, HttpException, HttpStatus, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Response, Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { hash as argon2Hash, verify as argon2Verify } from '@node-rs/argon2';
import { Throttle } from '@nestjs/throttler';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ACCESS_TOKEN_TTL_SECONDS, ARGON2_OPTIONS, AUTH_COOKIES, AuthService, SESSION_COOKIE_OPTIONS, generateApiKey, type AuthenticatedUser } from '../services/auth.service';
import { Account } from '../models/account.entity';

/**
 * Motif accepté pour un prénom ou un nom. Restreint la saisie aux lettres latines accentuées, à l'espace,
 * à l'apostrophe et au tiret, ce qui exclut chiffres, balises et ponctuation exotique avant tout stockage
 * puis tout affichage sur le profil public.
 */
export const NAME_PATTERN = /^[a-zA-ZÀ-ÿ\s'-]+$/;
/**
 * Motif accepté pour un nom d'utilisateur. Impose une première et une dernière position alphanumériques
 * minuscules, autorise le tiret bas et le point isolé grâce à l'anticipation négative qui interdit deux points
 * consécutifs, et borne la longueur totale de trois à trente caractères. Le nom d'utilisateur servant
 * d'identifiant public du profil, la casse est normalisée en minuscules avant validation pour garantir l'unicité.
 */
export const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9_]|\.(?!\.)){1,28}[a-z0-9]$/;

/**
 * Noms d'utilisateur interdits à l'inscription. Couvre les segments de routes et sous-domaines de la plateforme
 * ainsi que les libellés à valeur institutionnelle, afin d'éviter toute collision d'URL de profil public et toute
 * usurpation d'un compte officiel.
 */
export const RESERVED_USERNAMES = new Set([
  'about',
  'admin',
  'api',
  'app',
  'apps',
  'auth',
  'billing',
  'blog',
  'cdn',
  'contact',
  'cookies',
  'dashboard',
  'dev',
  'discover',
  'doc',
  'docs',
  'dropicture',
  'explore',
  'faq',
  'ftp',
  'help',
  'home',
  'img',
  'legal',
  'login',
  'logout',
  'mail',
  'me',
  'media',
  'new',
  'news',
  'null',
  'privacy',
  'profile',
  'profiles',
  'root',
  'search',
  's',
  'security',
  'settings',
  'signin',
  'signup',
  'staff',
  'static',
  'status',
  'support',
  'system',
  'terms',
  'topics',
  'undefined',
  'user',
  'users',
  'www',
]);

/**
 * Normalise un prénom ou un nom en forme d'affichage canonique.
 *
 * @remarks Supprime les espaces de bordure, réduit toute suite d'espaces et toute suite de tirets à un seul
 * caractère, puis capitalise chaque composant séparé par un espace ou par un tiret. Un composant déjà mixte en
 * casse est laissé intact, seuls les composants entièrement en majuscules ou entièrement en minuscules sont
 * réécrits. La longueur du résultat peut différer de l'entrée, l'appelant doit donc revalider les bornes.
 * @param raw - Valeur brute reçue du client, déjà filtrée par `NAME_PATTERN`.
 * @returns Le nom normalisé, composants capitalisés et séparateurs compactés.
 */
export function normalizeName(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/-+/g, '-')
    .split(' ')
    .map((word) =>
      word
        .split('-')
        .map((part) => {
          const uniform = part === part.toUpperCase() || part === part.toLowerCase();
          return uniform ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : part;
        })
        .join('-'),
    )
    .join(' ');
}

/**
 * Empreinte Argon2id factice, alignée sur les paramètres de coût réels du service. Vérifiée à la connexion quand
 * aucun compte ne correspond à l'adresse fournie, afin que le temps de réponse reste comparable au cas nominal et
 * n'expose pas l'existence d'un compte par mesure de latence.
 */
const DUMMY_HASH = '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHRzb21lc2FsdA$Yw5F8sZkKFi0YxZm7m4FqJ1aK3xD8V2n9QwPqRtUvWs';

/**
 * Charge utile attendue à la connexion. L'adresse électronique est mise en minuscules et détourée avant validation
 * de format, le mot de passe est borné à cent vingt-huit caractères pour plafonner le coût du calcul Argon2id.
 *
 * @remarks Les messages de contrainte portent les codes d'erreur métier renvoyés au client, `EMAIL_INVALID` et
 * `MISSING_CREDENTIALS`. La validation est appliquée par le `ValidationPipe` global en mode liste blanche, toute
 * propriété non déclarée fait échouer la requête en 400.
 */
export class SigninDto {
  @IsEmail({}, { message: 'EMAIL_INVALID' })
  @IsNotEmpty({ message: 'MISSING_CREDENTIALS' })
  @Transform(({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'MISSING_CREDENTIALS' })
  @MaxLength(128)
  password: string;
}

/**
 * Charge utile attendue à l'inscription. Prénom et nom sont bornés de deux à trente caractères et filtrés par
 * `NAME_PATTERN`, le nom d'utilisateur est mis en minuscules puis filtré par `USERNAME_PATTERN`, l'adresse
 * électronique est mise en minuscules et détourée, le mot de passe est borné de huit à cent vingt-huit caractères.
 *
 * @remarks La robustesse du mot de passe est exigée par quatre contraintes distinctes, majuscule, minuscule,
 * chiffre et caractère non alphanumérique, chacune portant son propre code d'erreur métier afin que le client
 * puisse indiquer la règle manquante sans divulguer la valeur saisie.
 */
export class SignupDto {
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

  @IsString()
  @IsNotEmpty({ message: 'MISSING_FIELDS' })
  @MinLength(3, { message: 'USERNAME_TOO_SHORT' })
  @MaxLength(30, { message: 'USERNAME_TOO_LONG' })
  @Matches(USERNAME_PATTERN, { message: 'USERNAME_INVALID' })
  @Transform(({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  username: string;

  @IsEmail({}, { message: 'EMAIL_INVALID' })
  @IsNotEmpty({ message: 'MISSING_FIELDS' })
  @Transform(({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'MISSING_FIELDS' })
  @MinLength(8, { message: 'PASSWORD_TOO_SHORT' })
  @MaxLength(128, { message: 'PASSWORD_TOO_LONG' })
  @Matches(/[A-Z]/, { message: 'PASSWORD_MISSING_UPPERCASE' })
  @Matches(/[a-z]/, { message: 'PASSWORD_MISSING_LOWERCASE' })
  @Matches(/[0-9]/, { message: 'PASSWORD_MISSING_NUMBER' })
  @Matches(/[^A-Za-z0-9]/, { message: 'PASSWORD_MISSING_SPECIAL' })
  password: string;
}

/**
 * Contrôleur du domaine authentification. Expose la lecture du profil authentifié, la vérification de
 * disponibilité d'un nom d'utilisateur, la résolution de session, la connexion, l'inscription, la rotation de
 * session et la déconnexion sous le préfixe /api/auth.
 *
 * @remarks Les sessions sont opaques, le client ne reçoit qu'un cookie httpOnly de la forme identifiant de session
 * puis nonce, restreint au chemin racine, en SameSite lax et marqué secure en production. Aucun jeton n'est lisible
 * par le script de page. Les mots de passe sont vérifiés en Argon2id avec les paramètres de `ARGON2_OPTIONS`, et une
 * empreinte factice est vérifiée quand l'adresse est inconnue pour égaliser les temps de réponse. Chaque route porte
 * sa propre limitation de débit, la plus stricte étant l'inscription à cinq requêtes par heure et la connexion à dix
 * requêtes par minute. Les réponses d'échec d'authentification restent volontairement génériques et ne distinguent
 * pas l'adresse inconnue du mot de passe erroné.
 */
@ApiTags('Authentification')
@Controller('/api/auth')
export class AuthController {
  /**
   * Injecte le dépôt TypeORM des comptes et le service de sessions adossé à Redis.
   */
  constructor(
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    private readonly authService: AuthService,
  ) {}

  /**
   * Retourne l'identité du compte authentifié.
   *
   * @remarks `GET /api/auth/me`. Route protégée par le garde `access-token`, le cookie de session est résolu en amont
   * par la stratégie d'accès qui renvoie un 401 si le cookie est absent, invalide ou expiré, et qui injecte
   * `req.user`. Limitée à soixante requêtes par minute. La lecture ne sélectionne pas l'empreinte du mot de passe,
   * exclue des lectures par défaut au niveau de l'entité.
   * @param req - Requête Express portant `req.user` injecté par la stratégie d'accès, dont le champ `sub` est
   * l'identifiant du compte.
   * @returns Adresse électronique, nom d'utilisateur, prénom et nom du compte.
   * @throws HttpException `ACCOUNT_NOT_FOUND` avec le statut 404 si le compte a disparu pendant la session.
   */
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Profil du compte authentifié' })
  @ApiCookieAuth('session')
  @Get('/me')
  @UseGuards(AuthGuard('access-token'))
  async me(@Req() req: Request) {
    const { sub } = req.user as AuthenticatedUser;
    const account = await this.accountRepository.findOne({ where: { id: sub } });
    if (!account) throw new HttpException({ code: 'ACCOUNT_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    return {
      email: account.email,
      username: account.username,
      firstname: account.firstname,
      lastname: account.lastname,
    };
  }

  /**
   * Indique si un nom d'utilisateur est disponible pour une inscription.
   *
   * @remarks `GET /api/auth/username/:username`. Route publique, aucun garde, statut 200 forcé. Limitée à soixante
   * requêtes par minute afin de contenir l'énumération de comptes existants. La valeur reçue est mise en minuscules
   * et détourée avant tout contrôle, puis les trois vérifications sont ordonnées du moins coûteux au plus coûteux,
   * format, liste réservée, existence en base. L'appel en base se limite à un test d'existence et ne renvoie aucune
   * donnée de compte.
   * @param raw - Segment d'URL portant le nom d'utilisateur candidat, dans sa casse d'origine.
   * @returns Objet portant `username` normalisé, `available` à vrai seulement si le nom est libre, et `code` valant
   * `USERNAME_INVALID` si le format est refusé, `USERNAME_RESERVED` si le nom est réservé, `USERNAME_ALREADY_USED`
   * s'il est déjà pris, ou `null` quand le nom est disponible.
   */
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: "Vérifier la disponibilité d'un nom d'utilisateur" })
  @Get('/username/:username')
  @HttpCode(HttpStatus.OK)
  async checkUsername(@Param('username') raw: string) {
    const username = raw.toLowerCase().trim();
    if (!USERNAME_PATTERN.test(username)) {
      return { username, available: false, code: 'USERNAME_INVALID' };
    }
    if (RESERVED_USERNAMES.has(username)) {
      return { username, available: false, code: 'USERNAME_RESERVED' };
    }
    const taken = await this.accountRepository.exists({ where: { username } });
    return { username, available: !taken, code: taken ? 'USERNAME_ALREADY_USED' : null };
  }

  /**
   * Résout le cookie de session courant en identité de compte.
   *
   * @remarks `POST /api/auth/resolve`. Route sans garde, statut 200 forcé, mais l'accès dépend du cookie httpOnly
   * `session` lu directement dans la requête. Limitée à cent vingt requêtes par minute, la valeur la plus haute du
   * contrôleur, la route étant destinée à un appel fréquent de vérification d'état. La résolution est déléguée au
   * service, qui contrôle le nonce, la péremption absolue et la version de jeton du compte, prolonge la fenêtre
   * d'inactivité de façon amortie et révoque toute la famille de sessions en cas de nonce inconnu.
   * @param req - Requête Express dont les cookies analysés portent le cookie de session.
   * @returns Objet portant `sub`, identifiant du compte, et `accessExpiresAt`, horodatage Unix en secondes de fin de
   * validité de la fenêtre d'accès courante.
   * @throws HttpException `Unauthenticated` avec le statut 401 si le cookie de session est absent, ou si le service
   * refuse de le résoudre.
   */
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @ApiOperation({ summary: 'Résoudre la session courante (cookie vers identité)' })
  @Post('/resolve')
  @HttpCode(HttpStatus.OK)
  async resolve(@Req() req: Request) {
    const cookie = req.cookies?.[AUTH_COOKIES.SESSION] as string | undefined;
    if (!cookie) throw new HttpException('Unauthenticated', HttpStatus.UNAUTHORIZED);
    const resolved = await this.authService.resolveSession(cookie);
    if (!resolved) throw new HttpException('Unauthenticated', HttpStatus.UNAUTHORIZED);
    return { sub: resolved.user.sub, accessExpiresAt: resolved.accessExpiresAt };
  }

  /**
   * Authentifie un couple adresse et mot de passe puis ouvre une session.
   *
   * @remarks `POST /api/auth/signin`. Route publique, aucun garde. Limitée à dix requêtes par minute pour freiner le
   * bourrage d'identifiants. L'empreinte du mot de passe est exclue des lectures par défaut, elle est donc rajoutée
   * explicitement par le constructeur de requête, et la comparaison de l'adresse passe par un paramètre lié. Quand
   * aucun compte ne correspond, une empreinte factice est tout de même vérifiée afin d'égaliser le temps de réponse
   * et de ne pas révéler l'existence de l'adresse. Les deux échecs possibles renvoient le même code d'erreur. Le
   * cookie de session est écrit avec les options partagées, httpOnly et SameSite lax, et sa durée de vie suit celle
   * calculée par le service. La date de dernière activité du compte est enfin remise à l'instant courant.
   * @param body - Charge utile validée `SigninDto`, adresse déjà normalisée en minuscules et mot de passe brut.
   * @param req - Requête Express, dont l'agent utilisateur et l'adresse IP sont attachés au contexte de session.
   * @param res - Réponse Express utilisée pour poser le cookie de session et émettre le corps.
   * @returns Réponse 200 portant `success` à vrai et `expires_in`, durée en secondes de la fenêtre d'accès.
   * @throws HttpException `INVALID_CREDENTIALS` avec le statut 401 si l'adresse est inconnue ou si le mot de passe ne
   * correspond pas à l'empreinte enregistrée.
   */
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Connexion (création de session)' })
  @Post('/signin')
  async signin(@Body() body: SigninDto, @Req() req: Request, @Res() res: Response) {
    const account = await this.accountRepository.createQueryBuilder('a').addSelect('a.passwordHash').where('a.email = :email', { email: body.email }).getOne();
    if (!account) {
      await argon2Verify(DUMMY_HASH, body.password).catch(() => false);
      throw new HttpException({ code: 'INVALID_CREDENTIALS' }, HttpStatus.UNAUTHORIZED);
    }
    const valid = await argon2Verify(account.passwordHash, body.password).catch(() => false);
    if (!valid) throw new HttpException({ code: 'INVALID_CREDENTIALS' }, HttpStatus.UNAUTHORIZED);

    const { cookie, maxAgeSeconds } = await this.authService.createSession(account, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    res.cookie(AUTH_COOKIES.SESSION, cookie, {
      ...SESSION_COOKIE_OPTIONS,
      maxAge: maxAgeSeconds * 1000,
    });
    await this.accountRepository.update({ id: account.id }, { lastSeenAt: new Date() });
    return res.status(HttpStatus.OK).send({ success: true, expires_in: ACCESS_TOKEN_TTL_SECONDS });
  }

  /**
   * Crée un compte à partir des informations d'inscription validées.
   *
   * @remarks `POST /api/auth/signup`. Route publique, aucun garde, statut 201 par défaut. Limitée à cinq requêtes par
   * heure, la contrainte la plus stricte du contrôleur, pour endiguer la création massive de comptes. Prénom et nom
   * sont normalisés puis leurs bornes de longueur sont revérifiées, la normalisation pouvant modifier la longueur
   * validée en amont. La disponibilité de l'adresse et du nom d'utilisateur est contrôlée par une lecture réduite à
   * trois colonnes, puis la contrainte d'unicité en base sert de garde-fou final contre la situation de compétition
   * entre deux inscriptions simultanées. Le mot de passe n'est jamais stocké en clair, seule son empreinte Argon2id
   * est persistée. Une clé d'interface applicative aléatoire est émise à la création avec sa date d'émission.
   * @param body - Charge utile validée `SignupDto`, nom d'utilisateur et adresse déjà normalisés en minuscules.
   * @returns Objet portant `success` à vrai, aucune donnée de compte n'est renvoyée.
   * @throws HttpException `INVALID_NAME` avec le statut 400 si le prénom ou le nom normalisé sort des bornes de deux à
   * trente caractères.
   * @throws HttpException `USERNAME_RESERVED` avec le statut 400 si le nom d'utilisateur figure dans la liste
   * réservée.
   * @throws HttpException `EMAIL_ALREADY_USED` avec le statut 409 si l'adresse est déjà prise, détecté par la lecture
   * préalable ou par la violation de la contrainte unique `UQ_accounts_email`.
   * @throws HttpException `USERNAME_ALREADY_USED` avec le statut 409 si le nom d'utilisateur est déjà pris, détecté
   * par la lecture préalable ou par la violation de contrainte unique. Toute autre erreur de persistance est relancée
   * telle quelle.
   */
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  @ApiOperation({ summary: "Inscription d'un nouveau compte" })
  @Post('/signup')
  async signup(@Body() body: SignupDto) {
    const firstname = normalizeName(body.firstname);
    const lastname = normalizeName(body.lastname);
    if (firstname.length < 2 || firstname.length > 30 || lastname.length < 2 || lastname.length > 30) {
      throw new HttpException({ code: 'INVALID_NAME' }, HttpStatus.BAD_REQUEST);
    }
    if (RESERVED_USERNAMES.has(body.username)) {
      throw new HttpException({ code: 'USERNAME_RESERVED' }, HttpStatus.BAD_REQUEST);
    }
    const existing = await this.accountRepository.findOne({
      where: [{ email: body.email }, { username: body.username }],
      select: { id: true, email: true, username: true },
    });
    if (existing) {
      throw new HttpException({ code: existing.email === body.email ? 'EMAIL_ALREADY_USED' : 'USERNAME_ALREADY_USED' }, HttpStatus.CONFLICT);
    }
    const passwordHash = await argon2Hash(body.password, ARGON2_OPTIONS);
    try {
      await this.accountRepository.save(
        this.accountRepository.create({
          firstname,
          lastname,
          username: body.username,
          email: body.email,
          passwordHash,
          apiKey: generateApiKey(),
          apiKeyIssuedAt: new Date(),
        }),
      );
    } catch (err) {
      const pg = err as { code?: string; constraint?: string };
      if (pg?.code === '23505') {
        const code = pg.constraint === 'UQ_accounts_email' ? 'EMAIL_ALREADY_USED' : 'USERNAME_ALREADY_USED';
        throw new HttpException({ code }, HttpStatus.CONFLICT);
      }
      throw err;
    }
    return { success: true };
  }

  /**
   * Fait tourner la session courante et réémet le cookie correspondant.
   *
   * @remarks `POST /api/auth/session`. Route sans garde, l'accès repose sur le cookie httpOnly `session`. Limitée à
   * trente requêtes par minute. La rotation est déléguée au service, qui prend un verrou distribué par session pour
   * sérialiser les rotations concurrentes, remplace le nonce, conserve brièvement l'ancien nonce dans une fenêtre de
   * grâce pour absorber les appels en vol, et traite la réutilisation d'un nonce hors fenêtre comme un vol de session
   * en incrémentant la version de jeton du compte, ce qui invalide toutes ses sessions. L'identifiant de session est
   * conservé, seul le nonce change, et le cookie est réécrit avec la durée de vie recalculée.
   * @param req - Requête Express portant le cookie de session courant, l'agent utilisateur et l'adresse IP.
   * @param res - Réponse Express utilisée pour poser le cookie renouvelé et émettre le corps.
   * @returns Réponse portant `success` à vrai, `rotated` à vrai et `expires_in`, durée en secondes de la nouvelle
   * fenêtre d'accès.
   * @throws HttpException `Session missing` avec le statut 401 si aucun cookie de session n'accompagne la requête.
   * @throws UnauthorizedException avec le statut 401 relayée par le service quand le cookie est malformé, la session
   * expirée par inactivité ou en absolu, l'enregistrement corrompu, le compte introuvable, la version de jeton
   * révoquée, une réutilisation de nonce détectée, ou une rotation concurrente non aboutie.
   */
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Rotation de la session (refresh)' })
  @Post('/session')
  async session(@Req() req: Request, @Res() res: Response) {
    const currentCookie = req.cookies?.[AUTH_COOKIES.SESSION] as string | undefined;
    if (!currentCookie) throw new HttpException('Session missing', HttpStatus.UNAUTHORIZED);
    const { cookie, maxAgeSeconds } = await this.authService.rotateSession(currentCookie, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    res.cookie(AUTH_COOKIES.SESSION, cookie, {
      ...SESSION_COOKIE_OPTIONS,
      maxAge: maxAgeSeconds * 1000,
    });
    return res.send({ success: true, rotated: true, expires_in: ACCESS_TOKEN_TTL_SECONDS });
  }

  /**
   * Révoque la session courante et efface le cookie côté client.
   *
   * @remarks `POST /api/auth/signout`. Route sans garde, statut 200 forcé. Limitée à vingt requêtes par minute. La
   * révocation côté serveur n'est tentée que si un cookie est présent, l'enregistrement de session est alors supprimé
   * du magasin Redis, ce qui rend le cookie inexploitable même s'il a été copié. Le cookie est ensuite effacé avec les
   * mêmes options que celles de sa pose, condition nécessaire pour que le navigateur le retire effectivement. La route
   * reste idempotente et ne signale pas l'absence de session, afin de ne pas transformer la déconnexion en oracle
   * d'existence de session.
   * @param req - Requête Express dont les cookies analysés peuvent porter le cookie de session.
   * @param res - Réponse Express utilisée pour effacer le cookie et émettre le corps.
   * @returns Réponse portant le champ `message` valant `Logged out`.
   */
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Déconnexion (révocation de session)' })
  @Post('/signout')
  @HttpCode(HttpStatus.OK)
  async signout(@Req() req: Request, @Res() res: Response) {
    const sessionCookie = req.cookies?.[AUTH_COOKIES.SESSION] as string | undefined;
    if (sessionCookie) await this.authService.revokeSessionCookie(sessionCookie);
    res.clearCookie(AUTH_COOKIES.SESSION, SESSION_COOKIE_OPTIONS);
    return res.send({ message: 'Logged out' });
  }
}
