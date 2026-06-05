// dropicture/app/backend/src/services/bootstrap.service.ts
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { hash as argon2Hash } from '@node-rs/argon2';
import { randomBytes } from 'crypto';
import { Account } from '../models/account.model';
import { Role } from '../models/role.model';
import { ALL_SCOPES } from '../guards/scopes.guard';
import { ARGON2_OPTIONS } from './auth.service';

const ADMIN_ROLE_NAME = 'admin';
const DEFAULT_ADMIN_EMAIL = 'admin@dropicture.com';
const DEFAULT_ADMIN_PASSWORD = 'admin';

const isProd = process.env.NODE_ENV === 'production';

@Injectable()
export class BootstrapService implements OnApplicationBootstrap {
    private readonly logger = new Logger(BootstrapService.name);

    constructor(
        @InjectRepository(Account)
        private readonly accountRepository: Repository<Account>,
        @InjectRepository(Role)
        private readonly roleRepository: Repository<Role>,
    ) { }

    async onApplicationBootstrap(): Promise<void> {
        try {
            const role = await this.ensureAdminRole();
            await this.ensureAdminAccount(role);
        } catch (err) {
            this.logger.error(
                `Admin bootstrap failed: ${err instanceof Error ? err.message : err}`,
            );
        }
    }

    private async ensureAdminRole(): Promise<Role> {
        let role = await this.roleRepository.findOne({ where: { name: ADMIN_ROLE_NAME } });
        if (!role) {
            try {
                role = await this.roleRepository.save(
                    this.roleRepository.create({
                        name: ADMIN_ROLE_NAME,
                        scopes: [...ALL_SCOPES],
                        lastUpdatedBy: 'system',
                    }),
                );
                this.logger.log(`Created role "${ADMIN_ROLE_NAME}" (${ALL_SCOPES.join(' ')})`);
                return role;
            } catch {
                role = await this.roleRepository.findOne({ where: { name: ADMIN_ROLE_NAME } });
                if (!role) throw new Error('admin role race could not be resolved');
            }
        }
        const current = new Set(role.scopes ?? []);
        const missing = ALL_SCOPES.filter(s => !current.has(s));
        if (missing.length > 0) {
            role.scopes = [...ALL_SCOPES];
            role.lastUpdatedBy = 'system';
            role = await this.roleRepository.save(role);
            this.logger.log(`Updated "${ADMIN_ROLE_NAME}" scopes (+ ${missing.join(' ')})`);
        }
        return role;
    }

    private async ensureAdminAccount(role: Role): Promise<void> {
        const email = (process.env.ADMIN_EMAIL ?? DEFAULT_ADMIN_EMAIL).toLowerCase().trim();
        const existing = await this.accountRepository.findOne({
            where: { email },
            relations: { roles: true },
        });
        if (existing) {
            if (!existing.roles?.some(r => r.id === role.id)) {
                existing.roles = [...(existing.roles ?? []), role];
                await this.accountRepository.save(existing);
                this.logger.log(`Attached "${ADMIN_ROLE_NAME}" role to existing account ${email}`);
            }
            return;
        }
        let password = process.env.ADMIN_PASSWORD;
        let generated = false;
        if (!password) {
            if (isProd) {
                password = randomBytes(18).toString('base64url');
                generated = true;
            } else {
                password = DEFAULT_ADMIN_PASSWORD;
            }
        }
        const passwordHash = await argon2Hash(password, ARGON2_OPTIONS);
        try {
            await this.accountRepository.save(
                this.accountRepository.create({
                    firstname: 'Admin',
                    lastname: 'Dropicture',
                    email,
                    password: passwordHash,
                    roles: [role],
                }),
            );
        } catch {
            this.logger.log(`Admin account ${email} already created by another replica`);
            return;
        }
        if (generated) {
            this.logger.warn(
                `Created admin account ${email} with a GENERATED password (ADMIN_PASSWORD not set): ${password} — sign in and change it now. This is logged only once.`,
            );
        } else if (!process.env.ADMIN_PASSWORD) {
            this.logger.warn(
                `Created admin account ${email} with the DEFAULT password "${DEFAULT_ADMIN_PASSWORD}" — never expose this instance without changing it.`,
            );
        } else {
            this.logger.log(`Created admin account ${email}`);
        }
    }
}