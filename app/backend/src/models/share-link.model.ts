// dropicture/app/backend/src/models/share-link.model.ts
import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { Account } from './account.model';
import { Album } from './album.model';

export enum ShareKind {
    ALBUM = 'album',
    SELECTION = 'selection',
}

@Entity({ name: 'share_links' })
export class ShareLink {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => Account, { onDelete: 'CASCADE', nullable: false })
    @JoinColumn({ name: 'ownerId' })
    owner: Account;

    @Column({ type: 'uuid' })
    ownerId: string;

    // Public, unguessable token used in the share URL (/share/:token).
    @Index({ unique: true })
    @Column({ type: 'varchar', length: 64 })
    token: string;

    @Column({ type: 'enum', enum: ShareKind })
    kind: ShareKind;

    // Album shares point at an album; selection shares carry a list of ids.
    @ManyToOne(() => Album, { onDelete: 'CASCADE', nullable: true })
    @JoinColumn({ name: 'albumId' })
    album: Album | null;

    @Column({ type: 'uuid', nullable: true })
    albumId: string | null;

    @Column({ type: 'jsonb', default: () => "'[]'" })
    pictureIds: string[];

    // Snapshot label + count at creation time (what was shared).
    @Column({ type: 'varchar', length: 120 })
    title: string;

    @Column({ type: 'int', default: 0 })
    itemCount: number;

    @Column({ type: 'timestamptz', nullable: true })
    expiresAt: Date | null;

    @Column({ type: 'int', default: 0 })
    views: number;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;
}