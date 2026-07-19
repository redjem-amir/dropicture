// dropicture/apps/saas/backend/src/models/gallery-media.entity.ts
import { Entity, Column, CreateDateColumn, PrimaryColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Gallery } from './gallery.entity';
import { Media } from './media.entity';

@Entity({ name: 'gallery_media' })
@Index('IDX_gallery_media_order', ['galleryId', 'position'])
@Index('IDX_gallery_media_media', ['mediaId'])
export class GalleryMedia {
    @PrimaryColumn({ type: 'uuid' })
    galleryId: string;

    @PrimaryColumn({ type: 'uuid' })
    mediaId: string;

    @ManyToOne(() => Gallery, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'galleryId', foreignKeyConstraintName: 'FK_gallery_media_gallery' })
    gallery: Gallery;

    @ManyToOne(() => Media, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'mediaId', foreignKeyConstraintName: 'FK_gallery_media_media' })
    media: Media;

    @Column({ type: 'int', default: 0 })
    position: number;

    @CreateDateColumn({ type: 'timestamptz', nullable: false })
    createdAt: Date;
}