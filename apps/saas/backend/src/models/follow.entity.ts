// dropicture/apps/saas/backend/src/models/follow.entity.ts
import { Entity, CreateDateColumn, PrimaryColumn, Index, ManyToOne, JoinColumn, Check } from 'typeorm';
import { Account } from './account.entity';

@Entity({ name: 'follows' })
@Index('IDX_follows_following', ['followingId'])
@Check('CHK_follows_not_self', '"followerId" <> "followingId"')
export class Follow {
  @PrimaryColumn({ type: 'uuid' })
  followerId: string;

  @ManyToOne(() => Account, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'followerId', foreignKeyConstraintName: 'FK_follows_follower' })
  follower: Account;

  @PrimaryColumn({ type: 'uuid' })
  followingId: string;

  @ManyToOne(() => Account, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'followingId', foreignKeyConstraintName: 'FK_follows_following' })
  following: Account;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
