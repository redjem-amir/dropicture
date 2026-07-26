// dropicture/apps/saas/backend/src/models/album.entity.ts
import { Entity, Column, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Account } from './account.entity';
import { Media } from './media.entity';

/**
 * Table `albums`, une ligne par album de la bibliothèque privée. Regroupe des médias d'un même
 * propriétaire sous un titre et retient la vignette de couverture choisie.
 *
 * @remarks L'album n'est qu'un regroupement, l'appartenance des médias passe par la table de liaison
 * `placements`. Un album ne porte aucune notion de visibilité publique, celle ci reste attachée au média.
 * L'index unique propriétaire plus titre interdit deux albums de même titre chez un même compte tout en
 * laissant deux comptes distincts réutiliser le même libellé. La colonne `ownerId` est le seul discriminant
 * d'isolation, toute lecture ou écriture de la bibliothèque la contraint à l'identifiant du compte appelant.
 */
@Entity({ name: 'albums' })
@Index('UQ_albums_owner_title', ['ownerId', 'title'], { unique: true })
export class Album {
  /** Identifiant technique, UUID généré par la base, exposé dans les chemins de routes de la bibliothèque. */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Compte propriétaire, obligatoire. La contrainte étrangère `FK_albums_owner` est en `ON DELETE CASCADE`,
   * la suppression du compte efface donc ses albums, et par cascade les placements associés.
   */
  @Column({ type: 'uuid' })
  ownerId: string;

  /** Relation de lecture vers le compte propriétaire, jamais nulle. */
  @ManyToOne(() => Account, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId', foreignKeyConstraintName: 'FK_albums_owner' })
  owner: Account;

  /** Titre de l'album, soixante caractères au plus, débarrassé de ses espaces de bord en amont pour ne pas contourner l'index unique. */
  @Column({ type: 'varchar', length: 60 })
  title: string;

  /**
   * Média retenu comme couverture, nul par défaut. La contrainte étrangère `FK_albums_cover` est en
   * `ON DELETE SET NULL`, et une couverture nulle fait retomber l'affichage sur le premier placement de
   * l'album, ce qui évite une vignette manquante après la suppression de l'image choisie.
   */
  @Column({ type: 'uuid', nullable: true })
  coverMediaId: string | null;

  /** Relation de lecture vers le média de couverture, nulle lorsque aucune couverture n'est fixée. */
  @ManyToOne(() => Media, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'coverMediaId', foreignKeyConstraintName: 'FK_albums_cover' })
  cover: Media | null;

  /** Date de création de l'album, renseignée par la base. */
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  /** Date de dernière modification, entretenue par TypeORM et réécrite volontairement à l'ajout de médias afin de refléter l'activité de l'album. */
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
