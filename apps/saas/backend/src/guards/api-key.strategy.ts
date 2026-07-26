// dropicture/apps/saas/backend/src/guards/api-key.strategy.ts
/**
 * Stratégie d'authentification programmatique par clé d'API, destinée aux appels serveur à serveur
 * qui ne peuvent pas porter de cookie de session.
 *
 * @remarks La clé est un secret porteur, sa seule vérification est l'égalité avec la valeur stockée
 * en base. Elle est donc bornée en longueur avant toute lecture, la sélection ne rapatrie que
 * l'identifiant du compte et le message d'erreur reste identique quel que soit le motif du rejet.
 */
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from '../models/account.entity';
import type { AuthenticatedUser } from '../services/auth.service';

/**
 * Stratégie Passport enregistrée sous le nom `api-key`. Authentifie un appel à partir d'une clé d'API,
 * mobilisable par `AuthGuard('api-key')` et déclarée comme schéma de sécurité `api-key` dans la
 * documentation OpenAPI de l'API.
 *
 * @remarks La clé est acceptée dans le paramètre de requête `appid` ou dans l'en-tête `x-api-key`,
 * l'en-tête n'étant consulté qu'à défaut du paramètre. La longueur est contrôlée avant toute requête,
 * ce qui écarte les valeurs manifestement invalides sans coût de lecture en base et limite la surface
 * exposée à un balayage. La recherche porte sur la colonne `apiKey`, exclue des sélections par défaut
 * de l'entité, et ne ramène que l'identifiant du compte.
 */
@Injectable()
export class ApiKeyStrategy extends PassportStrategy(Strategy, 'api-key') {
  /** Reçoit le dépôt des comptes, utilisé uniquement en lecture pour retrouver le porteur d'une clé. */
  constructor(
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
  ) {
    super();
  }

  /**
   * Authentifie une requête porteuse d'une clé d'API et retourne l'identité du compte propriétaire.
   *
   * @param req - Requête Express, la clé est lue dans `req.query.appid` puis, à défaut, dans l'en-tête
   * `x-api-key`. Une valeur non textuelle, cas d'un paramètre répété, est traitée comme absente.
   * @returns Identité minimale du compte, `sub` valant son identifiant, ou `null` lorsqu'aucune clé
   * n'est fournie, la requête restant alors sans porteur authentifié.
   * @throws UnauthorizedException `INVALID_API_KEY` avec le statut 401 si la clé fournie fait moins de
   * huit caractères ou plus de soixante quatre, borne haute alignée sur la longueur de la colonne.
   * @throws UnauthorizedException `INVALID_API_KEY` avec le statut 401 si aucun compte ne porte cette
   * clé. Le même code couvre les deux cas, l'appelant ne peut donc pas distinguer une clé mal formée
   * d'une clé inexistante.
   * @remarks Le contenu de la clé n'apparaît dans aucun message d'erreur ni dans la valeur retournée,
   * ce qui évite sa fuite dans les traces d'accès et les réponses d'erreur.
   */
  async validate(req: Request): Promise<AuthenticatedUser | null> {
    const raw = req.query?.appid ?? req.headers['x-api-key'];
    const apiKey = typeof raw === 'string' ? raw.trim() : '';
    if (!apiKey) return null;
    if (apiKey.length < 8 || apiKey.length > 64) {
      throw new UnauthorizedException('INVALID_API_KEY');
    }
    const account = await this.accountRepository.findOne({
      where: { apiKey },
      select: { id: true },
    });
    if (!account) throw new UnauthorizedException('INVALID_API_KEY');
    return { sub: account.id };
  }
}
