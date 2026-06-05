// dropicture/app/backend/src/models/role.model.ts
import { Column, CreateDateColumn, Entity, Index, ManyToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Account } from "./account.model";
import { Scope } from "../guards/scopes.guard";

@Entity('roles')
@Index(['name'], { unique: true })
export class Role {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToMany(() => Account, account => account.roles)
    accounts: Account[];

    @Column({ nullable: false })
    name: string;

    @Column({ type: 'jsonb', default: () => "'[]'" })
    scopes: Scope[];

    @Column({ type: 'varchar', length: 255, nullable: false })
    lastUpdatedBy: string;

    @UpdateDateColumn({ type: 'timestamptz' })
    lastUpdate: Date;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;
}