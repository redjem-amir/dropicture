// dropicture/apps/saas/backend/src/guards/access.strategy.ts
/**
 * Stratégie d'authentification par cookie de session, point d'entrée unique des routes protégées du
 * backend SaaS.
 *
 * @remarks Le secret n'est lu que dans un cookie httpOnly, jamais dans un en-tête ni dans l'URL, ce
 * qui le tient hors de portée du code de page et hors des journaux d'accès.
 */
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { Request } from 'express';
import { AUTH_COOKIES, AuthService, type AuthenticatedUser } from '../services/auth.service';

/**
 * Stratégie Passport enregistrée sous le nom `access-token`. Traduit le cookie de session en identité
 * applicative pour toutes les routes gardées par `AuthGuard('access-token')`.
 *
 * @remarks Aucun jeton n'est vérifié localement, la décision est déléguée à `AuthService` qui consulte
 * l'enregistrement de session en Redis, compare le nonce du cookie et contrôle la version de jeton du
 * compte. Un cookie forgé ou périmé ne peut donc pas être validé hors ligne. La stratégie ne relit
 * jamais la base directement, elle ne dispose que de l'identifiant du compte.
 */
@Injectable()
export class AccessTokenStrategy extends PassportStrategy(Strategy, 'access-token') {
  /** Reçoit le service de sessions, seul détenteur de la logique de résolution et de révocation. */
  constructor(private readonly authService: AuthService) {
    super();
  }

  /**
   * Résout le cookie de session présent sur la requête et retourne l'identité de son porteur.
   *
   * @param req - Requête Express dont `req.cookies.session` est peuplé en amont par `cookie-parser`.
   * @returns Identité minimale du compte, réduite au champ `sub` qui porte son identifiant, que
   * Passport dépose ensuite dans `req.user`.
   * @throws UnauthorizedException `Session missing` avec le statut 401 quand le cookie de session est
   * absent de la requête.
   * @throws UnauthorizedException `Invalid or expired session` avec le statut 401 quand la résolution
   * n'aboutit pas, ce qui couvre la session inconnue, la session expirée, le nonce refusé et la
   * version de jeton devenue obsolète après une révocation globale.
   * @remarks Les bornes temporelles renvoyées par la résolution ne sont pas propagées ici, seule
   * l'identité est injectée dans la requête, ce qui limite au strict nécessaire les informations de
   * session exposées aux contrôleurs.
   */
  async validate(req: Request): Promise<AuthenticatedUser> {
    const cookie = req.cookies?.[AUTH_COOKIES.SESSION] as string | undefined;
    if (!cookie) throw new UnauthorizedException('Session missing');
    const resolved = await this.authService.resolveSession(cookie);
    if (!resolved) throw new UnauthorizedException('Invalid or expired session');
    return resolved.user;
  }
}
