// dropicture/app/backend/src/models/picture.model.ts
import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Account } from './account.model';

export enum PictureKind {
    IMAGE = 'image',
    VIDEO = 'video',
}

@Entity({ name: 'pictures' })
@Index(['ownerId', 'archived', 'deletedAt', 'createdAt'])
@Index(['ownerId', 'favorite'])
export class Picture {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => Account, { onDelete: 'CASCADE', nullable: false })
    @JoinColumn({ name: 'ownerId' })
    owner: Account;

    @Column({ type: 'uuid' })
    ownerId: string;

    @Column({ type: 'varchar', length: 255 })
    filename: string;

    @Column({ type: 'varchar', length: 127 })
    mimeType: string;

    @Column({ type: 'enum', enum: PictureKind, default: PictureKind.IMAGE })
    kind: PictureKind;

    @Column({ type: 'bigint' })
    sizeBytes: string;

    @Column({ type: 'int', nullable: true })
    width: number | null;

    @Column({ type: 'int', nullable: true })
    height: number | null;

    @Column({ type: 'int', nullable: true })
    durationSeconds: number | null;

    @Index({ unique: true })
    @Column({ type: 'varchar', length: 512 })
    storageKey: string;

    @Column({ type: 'varchar', length: 512, nullable: true })
    thumbnailKey: string | null;

    @Column({ type: 'varchar', length: 64, nullable: true })
    sha256: string | null;

    @Column({ type: 'boolean', default: false })
    favorite: boolean;

    @Column({ type: 'boolean', default: false })
    archived: boolean;

    @Column({ type: 'timestamptz', nullable: true })
    takenAt: Date | null;

    @Index()
    @Column({ type: 'timestamptz', nullable: true })
    deletedAt: Date | null;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt: Date;
}