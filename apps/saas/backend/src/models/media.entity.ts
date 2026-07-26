// dropicture/apps/saas/backend/src/models/media.entity.ts
import { Entity, Column, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Account } from './account.entity';

/**
 * Nature d'un média. Elle n'est pas stockée, elle se déduit du type MIME par la table des types acceptés,
 * ce qui garantit qu'elle reste cohérente avec le fichier réellement téléversé.
 */
export type MediaKind = 'image' | 'video';
/**
 * Rôle d'un média. `content` désigne une photo ou une vidéo de la bibliothèque, `avatar` la seule image de
 * profil courante. La distinction évite qu'un avatar apparaisse dans un fil ou dans une galerie.
 */
export type MediaRole = 'content' | 'avatar';

/**
 * Table `media`, une ligne par fichier téléversé. Décrit le propriétaire, le type MIME, le poids stocké, les
 * dimensions déclarées et l'état de publication, le binaire lui même résidant sur S3 et étant diffusé par le CDN.
 *
 * @remarks Aucune clé d'objet n'est stockée, elle est recalculée à la forme `media/<ownerId>/<id>.<ext>`, ce qui
 * interdit toute divergence entre la base et le stockage. La visibilité publique est portée par la seule colonne
 * `publishedAt`, une ligne dont elle est nulle reste strictement privée. Le couple `ownerId` et `role` conditionne
 * toutes les lectures, ce qui isole les comptes entre eux et écarte les avatars des listes de contenu.
 * L'index `IDX_media_library` sert le classement de la bibliothèque par date de prise de vue, l'index
 * `IDX_media_feed` est partiel et ne référence que les lignes réellement diffusables, il reste donc petit même
 * lorsque la majorité des médias demeure privée.
 */
@Entity({ name: 'media' })
@Index('IDX_media_library', ['ownerId', 'capturedAt'])
@Index('IDX_media_feed', ['publishedAt'], {
  where: `"publishedAt" IS NOT NULL AND role = 'content'`,
})
export class Media {
  /** Identifiant technique, UUID généré par la base. Entre dans la clé S3 et rend l'URL de diffusion non devinable. */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Compte propriétaire, obligatoire. La contrainte étrangère `FK_media_owner` est en `ON DELETE CASCADE`, la
   * suppression du compte efface donc ses lignes de médias, et par cascade les placements qui les référencent.
   * Cette colonne est le discriminant d'isolation de toutes les opérations de lecture, de mise à jour et de suppression.
   */
  @Column({ type: 'uuid' })
  ownerId: string;

  /** Relation de lecture vers le compte propriétaire, jamais nulle. */
  @ManyToOne(() => Account, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId', foreignKeyConstraintName: 'FK_media_owner' })
  owner: Account;

  /**
   * Rôle du média, `content` par défaut. Le rôle commande la borne de poids appliquée au téléversement et
   * l'exclusion des avatars des fils et des galeries, il entre à ce titre dans la condition de l'index partiel.
   */
  @Column({ type: 'enum', enum: ['content', 'avatar'], default: 'content' })
  role: MediaRole;

  /** Type MIME retenu, issu de la liste blanche des formats acceptés. Sert à déduire la nature du média et l'extension de la clé S3. */
  @Column({ type: 'varchar', length: 64 })
  mimeType: string;

  /**
   * Poids réellement écrit sur S3, compté sur le flux et non repris de l'en tête annoncé par le client. Typé en
   * chaîne parce que le pilote PostgreSQL restitue un `bigint` sous cette forme, ce qui évite toute perte de
   * précision sur un nombre à virgule flottante.
   */
  @Column({ type: 'bigint' })
  bytes: string;

  /** Largeur en pixels déclarée par le client, nulle lorsqu'elle n'a pas été transmise. Sert à réserver la place de la vignette à l'affichage. */
  @Column({ type: 'int', nullable: true })
  width: number | null;

  /** Hauteur en pixels déclarée par le client, nulle lorsqu'elle n'a pas été transmise. */
  @Column({ type: 'int', nullable: true })
  height: number | null;

  /** Durée en millisecondes, renseignée pour les vidéos et nulle pour les images. */
  @Column({ type: 'int', nullable: true })
  durationMs: number | null;

  /**
   * Date de prise de vue déclarée, nulle lorsque le client ne la fournit pas. Porte le classement chronologique de
   * la bibliothèque, les réponses retombant sur la date de création quand elle est absente.
   */
  @Column({ type: 'timestamptz', nullable: true })
  capturedAt: Date | null;

  /**
   * Date de publication, seule porteuse de la visibilité publique. Nulle signifie privé, la publication inscrit
   * l'horodatage et le retrait de publication le remet à nul. Cette colonne fournit aussi la clé de pagination des
   * fils, associée à l'identifiant pour départager deux médias publiés au même instant.
   */
  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  /** Date d'enregistrement de la ligne, renseignée par la base après le téléversement. */
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  /** Date de dernière modification, réécrite notamment lors des changements d'état de publication. */
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
