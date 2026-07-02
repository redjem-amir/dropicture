// dropicture/apps/backend/src/controllers/accounts.controller.ts
import { Body, Controller, Delete, Get, HttpCode, HttpException, HttpStatus, Logger, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { hash as argon2Hash } from '@node-rs/argon2';
import { Throttle } from '@nestjs/throttler';
import { Transform, Type } from 'class-transformer';
import { IsEmail, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Account, AccountStatus } from '../models/account.model';
import { Picture } from '../models/picture.model';
import { AuthService, type AuthenticatedUser } from '../services/auth.service';
import { RequireScopes, SCOPES } from '../guards/scopes.guard';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const ADMIN_ROLE_NAME = 'admin';

const GARAGE_TIMEOUT_MS = 5000;

const ARGON2_OPTIONS = {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
    outputLen: 32,
};

interface GarageBucketInfo {
    id: string;
    globalAliases?: string[];
    bytes?: number;
    objects?: number;
    quotas?: { maxSize?: number | null; maxObjects?: number | null };
}
interface GarageClusterStatus {
    nodes?: Array<{ role?: { capacity?: number | null } | null }>;
}

interface StorageOverview {
    capacityBytes: number;
    usedBytes: number;
    allocatedBytes: number;
    freeBytes: number;
    accountCount: number;
    pictureCount: number;
    usedPercent: number;
    allocatedPercent: number;
    source: 'garage' | 'unavailable';
}

type SortKey = 'recent' | 'name' | 'email';

export class ListAccountsQuery {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(MAX_PAGE_SIZE)
    pageSize: number = DEFAULT_PAGE_SIZE;

    @IsOptional()
    @IsString()
    @MaxLength(120)
    q?: string;

    @IsOptional()
    @IsEnum(AccountStatus)
    status?: AccountStatus;

    @IsOptional()
    @IsEnum(['recent', 'name', 'email'] as const, { message: 'INVALID_SORT' })
    sort: SortKey = 'recent';
}

export class CreateAccountDto {
    @IsString()
    @IsNotEmpty({ message: 'MISSING_FIELDS' })
    @MinLength(2, { message: 'INVALID_NAME' })
    @MaxLength(30, { message: 'INVALID_NAME' })
    @Matches(/^[a-zA-ZÀ-ÿ\s'-]+$/, { message: 'INVALID_NAME' })
    firstname: string | undefined;

    @IsString()
    @IsNotEmpty({ message: 'MISSING_FIELDS' })
    @MinLength(2, { message: 'INVALID_NAME' })
    @MaxLength(30, { message: 'INVALID_NAME' })
    @Matches(/^[a-zA-ZÀ-ÿ\s'-]+$/, { message: 'INVALID_NAME' })
    lastname: string | undefined;

    @IsEmail({}, { message: 'EMAIL_INVALID' })
    @IsNotEmpty({ message: 'MISSING_FIELDS' })
    @Transform(({ value }) => value?.toLowerCase().trim())
    email: string | undefined;

    @IsString()
    @IsNotEmpty({ message: 'MISSING_FIELDS' })
    @MinLength(8, { message: 'PASSWORD_TOO_SHORT' })
    @MaxLength(128, { message: 'PASSWORD_TOO_LONG' })
    @Matches(/[A-Z]/, { message: 'PASSWORD_MISSING_UPPERCASE' })
    @Matches(/[a-z]/, { message: 'PASSWORD_MISSING_LOWERCASE' })
    @Matches(/[0-9]/, { message: 'PASSWORD_MISSING_NUMBER' })
    @Matches(/[^A-Za-z0-9]/, { message: 'PASSWORD_MISSING_SPECIAL' })
    password: string | undefined;

    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'INVALID_QUOTA' })
    @Min(0, { message: 'INVALID_QUOTA' })
    storageQuotaBytes?: number;
}

export class UpdateStatusDto {
    @IsEnum(AccountStatus, { message: 'INVALID_STATUS' })
    status: AccountStatus | undefined;
}

export class UpdateStorageDto {
    @Type(() => Number)
    @IsInt({ message: 'INVALID_QUOTA' })
    @Min(0, { message: 'INVALID_QUOTA' })
    quotaBytes: number | undefined;
}

export class UpdateCapacityDto {
    @Type(() => Number)
    @IsInt({ message: 'INVALID_CAPACITY' })
    @Min(0, { message: 'INVALID_CAPACITY' })
    capacityBytes: number | undefined;
}

@Controller('/api/accounts')
@UseGuards(AuthGuard('access-token'))
export class AccountsController {
    private readonly logger = new Logger(AccountsController.name);

    constructor(
        @InjectRepository(Account)
        private readonly accountRepository: Repository<Account>,
        @InjectRepository(Picture)
        private readonly pictureRepository: Repository<Picture>,
        private readonly authService: AuthService,
    ) { }

    private garageEnabled(): boolean {
        return !!(process.env.GARAGE_ADMIN_ENDPOINT && process.env.GARAGE_ADMIN_TOKEN);
    }

    private garageBucketAlias(): string {
        return process.env.S3_BUCKET ?? 'media';
    }

    private async garageRequest(path: string, init?: RequestInit): Promise<Response | null> {
        const base = process.env.GARAGE_ADMIN_ENDPOINT;
        const token = process.env.GARAGE_ADMIN_TOKEN;
        if (!base || !token) return null;
        try {
            const res = await fetch(`${base.replace(/\/+$/, '')}${path}`, {
                ...init,
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    ...(init?.headers ?? {}),
                },
                signal: AbortSignal.timeout(GARAGE_TIMEOUT_MS),
            });
            if (!res.ok) {
                this.logger.warn(`Garage admin ${path} -> HTTP ${res.status}`);
                return null;
            }
            return res;
        } catch (err) {
            this.logger.warn(`Garage admin ${path} failed: ${(err as Error).message}`);
            return null;
        }
    }

    private async garageBucketInfo(): Promise<GarageBucketInfo | null> {
        const alias = encodeURIComponent(this.garageBucketAlias());
        const res = await this.garageRequest(`/v2/GetBucketInfo?globalAlias=${alias}`);
        if (!res) return null;
        try {
            return (await res.json()) as GarageBucketInfo;
        } catch {
            return null;
        }
    }

    private async garageClusterCapacity(): Promise<number | null> {
        const res = await this.garageRequest('/v2/GetClusterStatus');
        if (!res) return null;
        try {
            const status = (await res.json()) as GarageClusterStatus;
            let total = 0;
            let seen = false;
            for (const node of status.nodes ?? []) {
                const cap = node.role?.capacity;
                if (typeof cap === 'number' && cap > 0) {
                    total += cap;
                    seen = true;
                }
            }
            return seen ? total : null;
        } catch {
            return null;
        }
    }

    private async setGarageBucketQuota(maxSizeBytes: number | null): Promise<boolean> {
        const info = await this.garageBucketInfo();
        if (!info?.id) return false;
        const res = await this.garageRequest(`/v2/UpdateBucket/${info.id}`, {
            method: 'POST',
            body: JSON.stringify({
                quotas: {
                    maxSize: maxSizeBytes,
                    maxObjects: info.quotas?.maxObjects ?? null,
                },
            }),
        });
        return res !== null;
    }

    private async effectiveCapacityBytes(bucket?: GarageBucketInfo | null): Promise<number> {
        const info = bucket !== undefined ? bucket : await this.garageBucketInfo();
        const quotaMax = info?.quotas?.maxSize ?? 0;
        if (quotaMax > 0) return quotaMax;
        const clusterCap = await this.garageClusterCapacity();
        return clusterCap && clusterCap > 0 ? clusterCap : 0;
    }

    private async usageForAccount(accountId: string): Promise<number> {
        const row = await this.pictureRepository
            .createQueryBuilder('p')
            .select('COALESCE(SUM(p.sizeBytes), 0)', 'used')
            .where('p.ownerId = :accountId', { accountId })
            .andWhere('p.deletedAt IS NULL')
            .getRawOne<{ used: string }>();
        return Number(row?.used ?? 0);
    }

    private async usageForAccounts(ids: string[]): Promise<Map<string, number>> {
        const usage = new Map<string, number>();
        if (ids.length === 0) return usage;
        const rows = await this.pictureRepository
            .createQueryBuilder('p')
            .select('p.ownerId', 'ownerId')
            .addSelect('COALESCE(SUM(p.sizeBytes), 0)', 'used')
            .where('p.ownerId IN (:...ids)', { ids })
            .andWhere('p.deletedAt IS NULL')
            .groupBy('p.ownerId')
            .getRawMany<{ ownerId: string; used: string }>();
        for (const row of rows) usage.set(row.ownerId, Number(row.used));
        return usage;
    }

    private async storageOverview(): Promise<StorageOverview> {
        const allocRow = await this.accountRepository
            .createQueryBuilder('a')
            .select('COALESCE(SUM(a.storageQuotaBytes), 0)', 'allocated')
            .addSelect('COUNT(*)', 'count')
            .getRawOne<{ allocated: string; count: string }>();
        const allocatedBytes = Number(allocRow?.allocated ?? 0);
        const accountCount = Number(allocRow?.count ?? 0);
        const bucket = await this.garageBucketInfo();
        if (!bucket) {
            return {
                capacityBytes: 0,
                usedBytes: 0,
                allocatedBytes,
                freeBytes: 0,
                accountCount,
                pictureCount: 0,
                usedPercent: 0,
                allocatedPercent: 0,
                source: 'unavailable',
            };
        }

        const usedBytes = Number(bucket.bytes ?? 0);
        const pictureCount = Number(bucket.objects ?? 0);
        const capacityBytes = await this.effectiveCapacityBytes(bucket);

        return {
            capacityBytes,
            usedBytes,
            allocatedBytes,
            freeBytes: Math.max(0, capacityBytes - usedBytes),
            accountCount,
            pictureCount,
            usedPercent: capacityBytes > 0 ? usedBytes / capacityBytes : 0,
            allocatedPercent: capacityBytes > 0 ? allocatedBytes / capacityBytes : 0,
            source: 'garage',
        };
    }

    private formatName(name: string): string {
        return name
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/-+/g, '-')
            .split(' ')
            .map(word =>
                word
                    .split('-')
                    .map(part => {
                        const isUniform = part === part.toUpperCase() || part === part.toLowerCase();
                        return isUniform
                            ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
                            : part;
                    })
                    .join('-'),
            )
            .join(' ');
    }

    private hasAdminRole(account: Account): boolean {
        return (account.roles ?? []).some(r => r.name?.toLowerCase() === ADMIN_ROLE_NAME);
    }

    private toDto(account: Account, usedBytes = 0) {
        return {
            id: account.id,
            firstname: account.firstname,
            lastname: account.lastname,
            email: account.email,
            roles: (account.roles ?? []).map(r => r.name),
            status: account.status,
            storageQuotaBytes: Number(account.storageQuotaBytes),
            storageUsedBytes: usedBytes,
            createdAt: account.createdAt,
            lastSeenAt: account.lastSeenAt ?? null,
        };
    }

    @Throttle({ default: { limit: 60, ttl: 60000 } })
    @Get()
    @RequireScopes(SCOPES.ACCOUNTS_READ)
    async list(@Query() query: ListAccountsQuery) {
        const page = query.page ?? 1;
        const pageSize = Math.min(query.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
        const qb = this.accountRepository
            .createQueryBuilder('account')
            .leftJoinAndSelect('account.roles', 'role');
        if (query.status) {
            qb.andWhere('account.status = :status', { status: query.status });
        }
        const search = query.q?.trim();
        if (search) {
            qb.andWhere(
                "(account.firstname ILIKE :q OR account.lastname ILIKE :q OR account.email ILIKE :q OR (account.firstname || ' ' || account.lastname) ILIKE :q)",
                { q: `%${search}%` },
            );
        }
        switch (query.sort) {
            case 'name':
                qb.orderBy('account.firstname', 'ASC').addOrderBy('account.lastname', 'ASC');
                break;
            case 'email':
                qb.orderBy('account.email', 'ASC');
                break;
            case 'recent':
            default:
                qb.orderBy('account.createdAt', 'DESC');
                break;
        }
        qb.skip((page - 1) * pageSize).take(pageSize);
        const [rows, total] = await qb.getManyAndCount();
        const usage = await this.usageForAccounts(rows.map(r => r.id));
        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        return {
            items: rows.map(a => this.toDto(a, usage.get(a.id) ?? 0)),
            page,
            pageSize,
            total,
            totalPages,
            hasPrev: page > 1,
            hasNext: page < totalPages,
        };
    }

    @Throttle({ default: { limit: 60, ttl: 60000 } })
    @Get('/storage/summary')
    @RequireScopes(SCOPES.ACCOUNTS_READ)
    async storageSummary() {
        return this.storageOverview();
    }

    @Throttle({ default: { limit: 20, ttl: 60000 } })
    @Patch('/storage/capacity')
    @HttpCode(HttpStatus.OK)
    @RequireScopes(SCOPES.ACCOUNTS_WRITE)
    async updateCapacity(@Body() body: UpdateCapacityDto) {
        if (body.capacityBytes === undefined || body.capacityBytes === null || body.capacityBytes < 0) {
            throw new HttpException({ code: 'INVALID_CAPACITY' }, HttpStatus.BAD_REQUEST);
        }
        if (!this.garageEnabled()) {
            throw new HttpException({ code: 'GARAGE_NOT_CONFIGURED' }, HttpStatus.SERVICE_UNAVAILABLE);
        }
        const ok = await this.setGarageBucketQuota(body.capacityBytes > 0 ? body.capacityBytes : null);
        if (!ok) {
            throw new HttpException({ code: 'GARAGE_UPDATE_FAILED' }, HttpStatus.BAD_GATEWAY);
        }
        return { success: true, overview: await this.storageOverview() };
    }

    @Throttle({ default: { limit: 20, ttl: 60000 } })
    @Post()
    @HttpCode(HttpStatus.CREATED)
    @RequireScopes(SCOPES.ACCOUNTS_WRITE)
    async create(@Body() body: CreateAccountDto) {
        if (!body.firstname || !body.lastname || !body.email || !body.password) {
            throw new HttpException({ code: 'MISSING_FIELDS' }, HttpStatus.BAD_REQUEST);
        }
        const firstname = this.formatName(body.firstname);
        const lastname = this.formatName(body.lastname);
        if (firstname.length < 2 || firstname.length > 30 || lastname.length < 2 || lastname.length > 30) {
            throw new HttpException({ code: 'INVALID_NAME' }, HttpStatus.BAD_REQUEST);
        }
        const email = body.email.toLowerCase().trim();
        if (await this.accountRepository.findOne({ where: { email } })) {
            throw new HttpException({ code: 'EMAIL_ALREADY_USED' }, HttpStatus.CONFLICT);
        }

        // Capacity is real (Garage). Default a new account to the full pool; an
        // admin narrows it per user afterwards. No hardcoded default.
        const capacityBytes = await this.effectiveCapacityBytes();
        let storageQuotaBytes: number;
        if (body.storageQuotaBytes !== undefined) {
            if (body.storageQuotaBytes < 0) {
                throw new HttpException({ code: 'INVALID_QUOTA' }, HttpStatus.BAD_REQUEST);
            }
            if (capacityBytes > 0 && body.storageQuotaBytes > capacityBytes) {
                throw new HttpException({ code: 'QUOTA_EXCEEDS_CAPACITY', capacityBytes }, HttpStatus.BAD_REQUEST);
            }
            storageQuotaBytes = body.storageQuotaBytes;
        } else {
            storageQuotaBytes = capacityBytes;
        }

        const passwordHash = await argon2Hash(body.password, ARGON2_OPTIONS);
        const account = await this.accountRepository.save(
            this.accountRepository.create({
                firstname,
                lastname,
                email,
                password: passwordHash,
                storageQuotaBytes: String(storageQuotaBytes),
            }),
        );
        return { success: true, account: this.toDto(account, 0) };
    }

    @Throttle({ default: { limit: 60, ttl: 60000 } })
    @Get('/:id')
    @RequireScopes(SCOPES.ACCOUNTS_READ)
    async getOne(@Param('id', new ParseUUIDPipe()) id: string) {
        const account = await this.accountRepository.findOne({
            where: { id },
            relations: { roles: true },
        });
        if (!account) {
            throw new HttpException({ code: 'ACCOUNT_NOT_FOUND' }, HttpStatus.NOT_FOUND);
        }
        const usedBytes = await this.usageForAccount(account.id);
        return this.toDto(account, usedBytes);
    }

    @Throttle({ default: { limit: 30, ttl: 60000 } })
    @Patch('/:id/status')
    @HttpCode(HttpStatus.OK)
    @RequireScopes(SCOPES.ACCOUNTS_WRITE)
    async updateStatus(
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body() body: UpdateStatusDto,
        @Req() req: Request,
    ) {
        const user = req.user as AuthenticatedUser;
        if (!body.status) {
            throw new HttpException({ code: 'INVALID_STATUS' }, HttpStatus.BAD_REQUEST);
        }
        if (id === user.sub) {
            throw new HttpException({ code: 'CANNOT_MODIFY_SELF' }, HttpStatus.BAD_REQUEST);
        }
        const account = await this.accountRepository.findOne({
            where: { id },
            relations: { roles: true },
        });
        if (!account) {
            throw new HttpException({ code: 'ACCOUNT_NOT_FOUND' }, HttpStatus.NOT_FOUND);
        }
        if (
            (body.status === AccountStatus.SUSPENDED || body.status === AccountStatus.BANNED) &&
            this.hasAdminRole(account)
        ) {
            throw new HttpException({ code: 'ADMIN_PROTECTED' }, HttpStatus.FORBIDDEN);
        }
        account.status = body.status;
        await this.accountRepository.save(account);
        if (body.status === AccountStatus.SUSPENDED || body.status === AccountStatus.BANNED) {
            await this.authService.revokeOtherAccountSessions(id, '').catch(() => undefined);
            await this.authService.revokeAllTokens(id).catch(() => undefined);
        }
        const usedBytes = await this.usageForAccount(account.id);
        return { success: true, account: this.toDto(account, usedBytes) };
    }

    @Throttle({ default: { limit: 30, ttl: 60000 } })
    @Patch('/:id/storage')
    @HttpCode(HttpStatus.OK)
    @RequireScopes(SCOPES.ACCOUNTS_WRITE)
    async updateStorage(
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body() body: UpdateStorageDto,
    ) {
        if (body.quotaBytes === undefined || body.quotaBytes === null) {
            throw new HttpException({ code: 'INVALID_QUOTA' }, HttpStatus.BAD_REQUEST);
        }
        if (body.quotaBytes < 0) {
            throw new HttpException({ code: 'INVALID_QUOTA' }, HttpStatus.BAD_REQUEST);
        }
        const capacityBytes = await this.effectiveCapacityBytes();
        if (capacityBytes > 0 && body.quotaBytes > capacityBytes) {
            throw new HttpException({ code: 'QUOTA_EXCEEDS_CAPACITY', capacityBytes }, HttpStatus.BAD_REQUEST);
        }
        const account = await this.accountRepository.findOne({
            where: { id },
            relations: { roles: true },
        });
        if (!account) {
            throw new HttpException({ code: 'ACCOUNT_NOT_FOUND' }, HttpStatus.NOT_FOUND);
        }
        account.storageQuotaBytes = String(body.quotaBytes);
        await this.accountRepository.save(account);
        const usedBytes = await this.usageForAccount(account.id);
        return { success: true, account: this.toDto(account, usedBytes) };
    }

    @Throttle({ default: { limit: 20, ttl: 60000 } })
    @Delete('/:id')
    @HttpCode(HttpStatus.OK)
    @RequireScopes(SCOPES.ACCOUNTS_WRITE)
    async remove(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
        const user = req.user as AuthenticatedUser;
        if (id === user.sub) {
            throw new HttpException({ code: 'CANNOT_DELETE_SELF' }, HttpStatus.BAD_REQUEST);
        }
        const account = await this.accountRepository.findOne({
            where: { id },
            relations: { roles: true },
        });
        if (!account) {
            throw new HttpException({ code: 'ACCOUNT_NOT_FOUND' }, HttpStatus.NOT_FOUND);
        }
        if (this.hasAdminRole(account)) {
            throw new HttpException({ code: 'ADMIN_PROTECTED' }, HttpStatus.FORBIDDEN);
        }
        await this.authService.revokeOtherAccountSessions(id, '').catch(() => undefined);
        account.roles = [];
        await this.accountRepository.save(account);
        await this.accountRepository.delete({ id: account.id });
        return { success: true };
    }
}