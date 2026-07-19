// dropicture/apps/saas/jobs/src/models/account.entity.ts
import {
  Entity,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryGeneratedColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'accounts' })
@Index('UQ_accounts_username', ['username'], { unique: true })
@Index('UQ_accounts_email', ['email'], { unique: true })
@Index('UQ_accounts_api_key', ['apiKey'], { unique: true })
export class Account {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 30, nullable: false })
  username: string;

  @Column({ type: 'varchar', length: 30, nullable: false })
  firstname: string;

  @Column({ type: 'varchar', length: 30, nullable: false })
  lastname: string;

  @Column({ nullable: false })
  email: string;

  @Column({ type: 'text', nullable: false })
  password: string;

  @Column({ default: 1 })
  tokenVersion: number;

  @Column({ type: 'uuid', nullable: true })
  avatarMediaId: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  bio: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true, select: false })
  apiKey: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  apiKeyCreatedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastSeenAt: Date | null;

  @UpdateDateColumn({ type: 'timestamptz', nullable: false })
  lastUpdate: Date;

  @CreateDateColumn({ type: 'timestamptz', nullable: false })
  createdAt: Date;
}
