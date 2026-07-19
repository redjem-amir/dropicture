// dropicture/apps/saas/backend/src/models/follow.entity.ts
import { Entity, Column, CreateDateColumn, PrimaryGeneratedColumn, Index, ManyToOne, JoinColumn, Check } from 'typeorm';
import { Account } from './account.entity';

@Entity({ name: 'follows' })
@Index('UQ_follows_pair', ['followerId', 'followingId'], { unique: true })
@Index('IDX_follows_following', ['followingId'])
@Check('CHK_follows_not_self', '"followerId" <> "followingId"')
export class Follow {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', nullable: false })
    followerId: string;

    @ManyToOne(() => Account, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'followerId', foreignKeyConstraintName: 'FK_follows_follower' })
    follower: Account;

    @Column({ type: 'uuid', nullable: false })
    followingId: string;

    @ManyToOne(() => Account, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'followingId', foreignKeyConstraintName: 'FK_follows_following' })
    following: Account;

    @CreateDateColumn({ type: 'timestamptz', nullable: false })
    createdAt: Date;
}