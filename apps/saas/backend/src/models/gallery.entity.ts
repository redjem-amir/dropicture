// dropicture/apps/saas/backend/src/models/gallery.entity.ts
import { Entity, Column, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Account } from './account.entity';
import { Media } from './media.entity';

export type GalleryVisibility = 'private' | 'public';

export const GALLERY_LIMITS = {
    TITLE_MAX: 60,
    TAGS_MAX: 5,
    TAG_MAX: 24,
} as const;

export function normalizeTag(raw: string): string {
    return raw
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, GALLERY_LIMITS.TAG_MAX);
}

@Entity({ name: 'galleries' })
@Index('UQ_galleries_owner_slug', ['ownerId', 'slug'], { unique: true, where: '"deletedAt" IS NULL' })
@Index('IDX_galleries_public_published', ['visibility', 'publishedAt'])
export class Gallery {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', nullable: false })
    ownerId: string;

    @ManyToOne(() => Account, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'ownerId', foreignKeyConstraintName: 'FK_galleries_owner' })
    owner: Account;

    @Column({ type: 'varchar', length: 60, nullable: false })
    title: string;

    @Column({ type: 'varchar', length: 72, nullable: false })
    slug: string;

    @Column({ type: 'jsonb', default: () => "'[]'" })
    tags: string[];

    @Column({ type: 'jsonb', default: () => "'[]'" })
    tagLabels: string[];

    @Column({ type: 'varchar', length: 8, default: 'private' })
    visibility: GalleryVisibility;

    @Column({ type: 'uuid', nullable: true })
    coverMediaId: string | null;

    @ManyToOne(() => Media, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'coverMediaId', foreignKeyConstraintName: 'FK_galleries_cover' })
    cover: Media | null;

    @Column({ type: 'timestamptz', nullable: true })
    publishedAt: Date | null;

    @Column({ type: 'timestamptz', nullable: true })
    deletedAt: Date | null;

    @UpdateDateColumn({ type: 'timestamptz', nullable: false })
    updatedAt: Date;

    @CreateDateColumn({ type: 'timestamptz', nullable: false })
    createdAt: Date;
}