// dropicture/apps/backend/src/models/account.model.ts
import { Entity, Column, CreateDateColumn, UpdateDateColumn, ManyToMany, JoinTable, PrimaryGeneratedColumn } from 'typeorm';
import { Role } from './role.model';

export enum AccountStatus {
    PENDING = 'pending',
    ACTIVE = 'active',
    SUSPENDED = 'suspended',
    BANNED = 'banned',
}

export const DEFAULT_STORAGE_QUOTA_BYTES = 1 * 1024 * 1024 * 1024;

@Entity({ name: 'accounts' })
export class Account {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 30, nullable: false })
    firstname: string;

    @Column({ type: 'varchar', length: 30, nullable: false })
    lastname: string;

    @Column({ unique: true, nullable: false })
    email: string;

    @Column({ type: 'text', nullable: false })
    password: string;

    @ManyToMany(() => Role, role => role.accounts, { onDelete: 'CASCADE' })
    @JoinTable({
        name: 'account_roles',
        joinColumn: { name: 'accountId', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'roleId', referencedColumnName: 'id' },
    })
    roles: Role[];

    @Column({ type: 'enum', enum: AccountStatus, default: AccountStatus.ACTIVE })
    status: AccountStatus;

    @Column({ type: 'bigint', default: DEFAULT_STORAGE_QUOTA_BYTES })
    storageQuotaBytes: string;

    @Column({ default: 1 })
    tokenVersion: number;

    @Column({ type: 'timestamptz', nullable: true })
    lastSeenAt: Date | null;

    @UpdateDateColumn({ type: 'timestamptz', nullable: false })
    lastUpdate: Date;

    @CreateDateColumn({ type: 'timestamptz', nullable: false })
    createdAt: Date;
}