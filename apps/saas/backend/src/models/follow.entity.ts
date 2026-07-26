// dropicture/apps/saas/backend/src/models/follow.entity.ts
import { Entity, CreateDateColumn, PrimaryColumn, Index, ManyToOne, JoinColumn, Check } from 'typeorm';
import { Account } from './account.entity';

/**
 * Table `follows`, une ligne par lien d'abonnement orienté d'un compte vers un autre. Alimente les
 * compteurs d'abonnés et d'abonnements ainsi que le périmètre du fil de découverte.
 *
 * @remarks La clé primaire composite abonné plus abonnement rend un doublon impossible au niveau de la
 * base, un abonnement rejoué est donc absorbé sans effet de bord. La contrainte de vérification
 * `CHK_follows_not_self` interdit qu'un compte s'abonne à lui même, la règle est tenue par le moteur et
 * non par le seul code applicatif. Les deux clés étrangères sont en `ON DELETE CASCADE`, la suppression
 * d'un compte efface donc aussi bien ses abonnements que les liens dont il était la cible, sans laisser
 * de référence orpheline.
 */
@Entity({ name: 'follows' })
@Index('IDX_follows_following', ['followingId'])
@Check('CHK_follows_not_self', '"followerId" <> "followingId"')
export class Follow {
  /** Compte à l'origine de l'abonnement, première part de la clé primaire, ce qui rend déjà performante la lecture de ses abonnements. */
  @PrimaryColumn({ type: 'uuid' })
  followerId: string;

  /** Relation de lecture vers le compte abonné, jamais nulle, suppression en cascade. */
  @ManyToOne(() => Account, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'followerId', foreignKeyConstraintName: 'FK_follows_follower' })
  follower: Account;

  /**
   * Compte suivi, seconde part de la clé primaire. L'index secondaire `IDX_follows_following` porte le sens
   * inverse de lecture, celui du dénombrement des abonnés d'un compte, que la clé primaire ne couvre pas.
   */
  @PrimaryColumn({ type: 'uuid' })
  followingId: string;

  /** Relation de lecture vers le compte suivi, jamais nulle, suppression en cascade. */
  @ManyToOne(() => Account, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'followingId', foreignKeyConstraintName: 'FK_follows_following' })
  following: Account;

  /** Date de création du lien, renseignée par la base. Un désabonnement suivi d'un réabonnement produit donc une date neuve. */
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
