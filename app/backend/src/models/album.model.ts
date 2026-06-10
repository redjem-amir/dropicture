// dropicture/app/backend/src/models/album.model.ts
import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    JoinTable,
    ManyToMany,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import { Account } from './account.model';
import { Picture } from './picture.model';

@Entity({ name: 'albums' })
@Index(['ownerId', 'createdAt'])
export class Album {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => Account, { onDelete: 'CASCADE', nullable: false })
    @JoinColumn({ name: 'ownerId' })
    owner: Account;

    @Column({ type: 'uuid' })
    ownerId: string;

    @Column({ type: 'varchar', length: 80 })
    name: string;

    @ManyToMany(() => Picture, { onDelete: 'CASCADE' })
    @JoinTable({
        name: 'album_pictures',
        joinColumn: { name: 'albumId', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'pictureId', referencedColumnName: 'id' },
    })
    pictures: Picture[];

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt: Date;
}