// dropicture/apps/saas/backend/src/models/placement.entity.ts
import { Entity, Column, CreateDateColumn, PrimaryColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Album } from './album.entity';
import { Media } from './media.entity';

@Entity({ name: 'placements' })
@Index('IDX_placements_order', ['albumId', 'position'])
@Index('IDX_placements_media', ['mediaId'])
export class Placement {
  @PrimaryColumn({ type: 'uuid' })
  albumId: string;

  @ManyToOne(() => Album, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'albumId', foreignKeyConstraintName: 'FK_placements_album' })
  album: Album;

  @PrimaryColumn({ type: 'uuid' })
  mediaId: string;

  @ManyToOne(() => Media, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'mediaId', foreignKeyConstraintName: 'FK_placements_media' })
  media: Media;

  @Column({ type: 'int', default: 0 })
  position: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
