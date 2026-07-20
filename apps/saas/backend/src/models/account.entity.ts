// dropicture/apps/saas/backend/src/models/account.entity.ts
import { Entity, Column, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Media } from './media.entity';

@Entity({ name: 'accounts' })
@Index('UQ_accounts_username', ['username'], { unique: true })
@Index('UQ_accounts_email', ['email'], { unique: true })
@Index('UQ_accounts_api_key', ['apiKey'], { unique: true, where: '"apiKey" IS NOT NULL' })
export class Account {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 30 })
  username: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'text', select: false })
  passwordHash: string;

  @Column({ type: 'varchar', length: 30 })
  firstname: string;

  @Column({ type: 'varchar', length: 30 })
  lastname: string;

  @Column({ type: 'varchar', length: 160, nullable: true })
  bio: string | null;

  @Column({ type: 'uuid', nullable: true })
  avatarMediaId: string | null;

  @ManyToOne(() => Media, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'avatarMediaId', foreignKeyConstraintName: 'FK_accounts_avatar' })
  avatar: Media | null;

  @Column({ type: 'int', default: 1 })
  tokenVersion: number;

  @Column({ type: 'varchar', length: 64, nullable: true, select: false })
  apiKey: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  apiKeyIssuedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastSeenAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
