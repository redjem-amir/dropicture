// dropicture/apps/saas/backend/src/models/placement.entity.ts
import { Entity, Column, CreateDateColumn, PrimaryColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Album } from './album.entity';
import { Media } from './media.entity';

/**
 * Table `placements`, table de liaison entre un album et un média. Une ligne matérialise l'appartenance d'un
 * média à un album et retient son rang d'affichage dans cet album.
 *
 * @remarks La clé primaire composite album plus média interdit qu'un même média figure deux fois dans le même
 * album, un ajout rejoué est donc absorbé par la base sans erreur pour l'appelant. Un média peut en revanche
 * appartenir à plusieurs albums, ce qui fait de la table le seul lieu de la relation multiple. Les deux clés
 * étrangères sont en `ON DELETE CASCADE`, la disparition de l'album comme celle du média retire donc
 * automatiquement le lien, aucune ligne ne survit à ses deux extrémités. La table ne porte ni propriétaire ni
 * visibilité, l'isolation repose sur la vérification préalable de la propriété de l'album.
 */
@Entity({ name: 'placements' })
@Index('IDX_placements_order', ['albumId', 'position'])
@Index('IDX_placements_media', ['mediaId'])
export class Placement {
  /** Album de rattachement, première part de la clé primaire. Suppression en cascade depuis l'album. */
  @PrimaryColumn({ type: 'uuid' })
  albumId: string;

  /** Relation de lecture vers l'album, jamais nulle. */
  @ManyToOne(() => Album, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'albumId', foreignKeyConstraintName: 'FK_placements_album' })
  album: Album;

  /**
   * Média placé, seconde part de la clé primaire. L'index secondaire `IDX_placements_media` couvre le sens
   * inverse de lecture, celui des albums qui contiennent un média donné, que la clé primaire ne sert pas.
   */
  @PrimaryColumn({ type: 'uuid' })
  mediaId: string;

  /** Relation de lecture vers le média, jamais nulle. */
  @ManyToOne(() => Media, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'mediaId', foreignKeyConstraintName: 'FK_placements_media' })
  media: Media;

  /**
   * Rang d'affichage dans l'album, à zéro par défaut. Calculé au moment de l'ajout comme le maximum existant
   * augmenté de un, ce qui place tout nouveau média en fin de liste. L'index `IDX_placements_order` rend le
   * parcours ordonné d'un album directement servi par la base, sans tri en mémoire.
   */
  @Column({ type: 'int', default: 0 })
  position: number;

  /** Date d'ajout du média à l'album, renseignée par la base. La table ne porte pas de date de modification. */
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
