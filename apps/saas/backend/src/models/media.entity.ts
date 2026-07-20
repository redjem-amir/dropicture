// dropicture/apps/saas/backend/src/models/media.entity.ts
import { Entity, Column, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Account } from './account.entity';

export type MediaKind = 'image' | 'video';
export type MediaRole = 'content' | 'avatar';

@Entity({ name: 'media' })
@Index('IDX_media_library', ['ownerId', 'capturedAt'])
@Index('IDX_media_feed', ['publishedAt'], {
  where: `"publishedAt" IS NOT NULL AND role = 'content'`,
})
export class Media {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  ownerId: string;

  @ManyToOne(() => Account, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId', foreignKeyConstraintName: 'FK_media_owner' })
  owner: Account;

  @Column({ type: 'enum', enum: ['content', 'avatar'], default: 'content' })
  role: MediaRole;

  @Column({ type: 'varchar', length: 64 })
  mimeType: string;

  @Column({ type: 'bigint' })
  bytes: string;

  @Column({ type: 'int', nullable: true })
  width: number | null;

  @Column({ type: 'int', nullable: true })
  height: number | null;

  @Column({ type: 'int', nullable: true })
  durationMs: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  capturedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
