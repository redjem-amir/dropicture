// dropicture/apps/saas/backend/src/models/album.entity.ts
import { Entity, Column, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Account } from './account.entity';
import { Media } from './media.entity';

@Entity({ name: 'albums' })
@Index('UQ_albums_owner_title', ['ownerId', 'title'], { unique: true })
export class Album {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  ownerId: string;

  @ManyToOne(() => Account, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId', foreignKeyConstraintName: 'FK_albums_owner' })
  owner: Account;

  @Column({ type: 'varchar', length: 60 })
  title: string;

  @Column({ type: 'uuid', nullable: true })
  coverMediaId: string | null;

  @ManyToOne(() => Media, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'coverMediaId', foreignKeyConstraintName: 'FK_albums_cover' })
  cover: Media | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
