// dropicture/apps/saas/backend/src/models/media.entity.ts
import { Entity, Column, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Account } from './account.entity';

export type MediaKind = 'image' | 'video';
export type MediaStatus = 'pending' | 'queued' | 'processing' | 'ready' | 'failed' | 'rejected';
export type MediaVisibility = 'private' | 'public';
export type MediaPurpose = 'content' | 'avatar';

@Entity({ name: 'media' })
@Index('IDX_media_owner_captured', ['ownerId', 'capturedAt'])
@Index('IDX_media_owner_status', ['ownerId', 'status'])
export class Media {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', nullable: false })
    ownerId: string;

    @ManyToOne(() => Account, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'ownerId', foreignKeyConstraintName: 'FK_media_owner' })
    owner: Account;

    @Column({ type: 'varchar', length: 8, nullable: false })
    kind: MediaKind;

    @Column({ type: 'varchar', length: 8, default: 'content' })
    purpose: MediaPurpose;

    @Column({ type: 'varchar', length: 12, default: 'pending' })
    status: MediaStatus;

    @Column({ type: 'varchar', length: 8, default: 'private' })
    visibility: MediaVisibility;

    @Column({ type: 'varchar', length: 64, nullable: false })
    mimeType: string;

    @Column({ type: 'varchar', length: 8, nullable: false })
    ext: string;

    @Column({ type: 'bigint', default: 0 })
    bytes: string;

    @Column({ type: 'int', nullable: true })
    width: number | null;

    @Column({ type: 'int', nullable: true })
    height: number | null;

    @Column({ type: 'int', nullable: true })
    durationMs: number | null;

    @Column({ type: 'bytea', nullable: true })
    thumbhash: Buffer | null;

    @Column({ type: 'jsonb', default: () => "'[]'" })
    widths: number[];

    @Column({ type: 'timestamptz', nullable: true })
    capturedAt: Date | null;

    @Column({ type: 'varchar', length: 32, nullable: true })
    errorCode: string | null;

    @Column({ type: 'text', nullable: true })
    error: string | null;

    @Column({ type: 'timestamptz', nullable: true })
    deletedAt: Date | null;

    @UpdateDateColumn({ type: 'timestamptz', nullable: false })
    updatedAt: Date;

    @CreateDateColumn({ type: 'timestamptz', nullable: false })
    createdAt: Date;
}