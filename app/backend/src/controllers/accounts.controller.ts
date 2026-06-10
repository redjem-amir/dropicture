// dropicture/app/backend/src/controllers/accounts.controller.ts
import { Body, Controller, Delete, Get, HttpCode, HttpException, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { hash as argon2Hash } from '@node-rs/argon2';
import { Throttle } from '@nestjs/throttler';
import { Transform, Type } from 'class-transformer';
import { IsEmail, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Account, AccountStatus } from '../models/account.model';
import { AuthService, type AuthenticatedUser } from '../services/auth.service';
import { RequireScopes, SCOPES } from '../guards/scopes.guard';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const ADMIN_ROLE_NAME = 'admin';

const ARGON2_OPTIONS = {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
    outputLen: 32,
};

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
}

export class UpdateStatusDto {
    @IsEnum(AccountStatus, { message: 'INVALID_STATUS' })
    status: AccountStatus | undefined;
}

@Controller('/api/accounts')
@UseGuards(AuthGuard('access-token'))
export class AccountsController {
    constructor(
        @InjectRepository(Account)
        private readonly accountRepository: Repository<Account>,
        private readonly authService: AuthService,
    ) { }

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

    private toDto(account: Account) {
        return {
            id: account.id,
            firstname: account.firstname,
            lastname: account.lastname,
            email: account.email,
            roles: (account.roles ?? []).map(r => r.name),
            status: account.status,
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
        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        return {
            items: rows.map(a => this.toDto(a)),
            page,
            pageSize,
            total,
            totalPages,
            hasPrev: page > 1,
            hasNext: page < totalPages,
        };
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
        const passwordHash = await argon2Hash(body.password, ARGON2_OPTIONS);
        const account = await this.accountRepository.save(
            this.accountRepository.create({ firstname, lastname, email, password: passwordHash }),
        );
        return { success: true, account: this.toDto(account) };
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
        return this.toDto(account);
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
        return { success: true, account: this.toDto(account) };
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