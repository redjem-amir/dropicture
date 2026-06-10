// dropicture/app/backend/src/controllers/roles.controller.ts
import { Body, Controller, Delete, Get, HttpCode, HttpException, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Throttle } from '@nestjs/throttler';
import { IsArray, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Role } from '../models/role.model';
import type { AuthenticatedUser } from '../services/auth.service';
import { ALL_SCOPES, RequireScopes, SCOPES, type Scope } from '../guards/scopes.guard';

const ADMIN_ROLE_NAME = 'admin';

const NAME_REGEX = /^[\w -]+$/;

export class CreateRoleDto {
    @IsString()
    @IsNotEmpty({ message: 'MISSING_FIELDS' })
    @MinLength(2, { message: 'INVALID_ROLE_NAME' })
    @MaxLength(50, { message: 'INVALID_ROLE_NAME' })
    @Matches(NAME_REGEX, { message: 'INVALID_ROLE_NAME' })
    name: string | undefined;

    @IsArray()
    @IsIn(ALL_SCOPES, { each: true, message: 'INVALID_SCOPE' })
    scopes: Scope[] = [];
}

export class UpdateRoleDto {
    @IsOptional()
    @IsString()
    @MinLength(2, { message: 'INVALID_ROLE_NAME' })
    @MaxLength(50, { message: 'INVALID_ROLE_NAME' })
    @Matches(NAME_REGEX, { message: 'INVALID_ROLE_NAME' })
    name?: string;

    @IsOptional()
    @IsArray()
    @IsIn(ALL_SCOPES, { each: true, message: 'INVALID_SCOPE' })
    scopes?: Scope[];
}

@Controller('/api/roles')
@UseGuards(AuthGuard('access-token'))
export class RolesController {
    constructor(
        @InjectRepository(Role)
        private readonly roleRepository: Repository<Role>,
    ) { }

    private isSystem(role: Role): boolean {
        return role.name?.toLowerCase() === ADMIN_ROLE_NAME;
    }

    private normalizeScopes(scopes?: Scope[]): Scope[] {
        const set = new Set((scopes ?? []).filter(s => (ALL_SCOPES as string[]).includes(s)));
        return ALL_SCOPES.filter(s => set.has(s));
    }

    private async memberCount(roleId: string): Promise<number> {
        const row = await this.roleRepository
            .createQueryBuilder('role')
            .leftJoin('role.accounts', 'account')
            .where('role.id = :roleId', { roleId })
            .select('COUNT(account.id)', 'count')
            .getRawOne<{ count: string }>();
        return row ? parseInt(row.count, 10) || 0 : 0;
    }

    private async findByNameInsensitive(name: string, exceptId?: string): Promise<Role | null> {
        const qb = this.roleRepository
            .createQueryBuilder('role')
            .where('LOWER(role.name) = LOWER(:name)', { name });
        if (exceptId) qb.andWhere('role.id != :exceptId', { exceptId });
        return qb.getOne();
    }

    private toDto(role: Role, members: number) {
        return {
            id: role.id,
            name: role.name,
            scopes: role.scopes ?? [],
            members,
            system: this.isSystem(role),
            lastUpdatedBy: role.lastUpdatedBy,
            lastUpdate: role.lastUpdate,
            createdAt: role.createdAt,
        };
    }

    @Throttle({ default: { limit: 60, ttl: 60000 } })
    @Get()
    @RequireScopes(SCOPES.ROLES_READ)
    async list() {
        const roles = await this.roleRepository
            .createQueryBuilder('role')
            .orderBy('role.createdAt', 'ASC')
            .getMany();
        const counts = await this.roleRepository
            .createQueryBuilder('role')
            .leftJoin('role.accounts', 'account')
            .select('role.id', 'id')
            .addSelect('COUNT(account.id)', 'count')
            .groupBy('role.id')
            .getRawMany<{ id: string; count: string }>();
        const countById = new Map(counts.map(c => [c.id, parseInt(c.count, 10) || 0]));
        return { items: roles.map(r => this.toDto(r, countById.get(r.id) ?? 0)) };
    }

    @Throttle({ default: { limit: 20, ttl: 60000 } })
    @Post()
    @HttpCode(HttpStatus.CREATED)
    @RequireScopes(SCOPES.ROLES_WRITE)
    async create(@Body() body: CreateRoleDto, @Req() req: Request) {
        const user = req.user as AuthenticatedUser;
        if (!body.name) {
            throw new HttpException({ code: 'MISSING_FIELDS' }, HttpStatus.BAD_REQUEST);
        }
        const name = body.name.trim();
        if (name.length < 2 || name.length > 50) {
            throw new HttpException({ code: 'INVALID_ROLE_NAME' }, HttpStatus.BAD_REQUEST);
        }
        if (await this.findByNameInsensitive(name)) {
            throw new HttpException({ code: 'ROLE_NAME_TAKEN' }, HttpStatus.CONFLICT);
        }
        const role = await this.roleRepository.save(
            this.roleRepository.create({
                name,
                scopes: this.normalizeScopes(body.scopes),
                lastUpdatedBy: user.sub,
            }),
        );
        return { success: true, role: this.toDto(role, 0) };
    }

    @Throttle({ default: { limit: 60, ttl: 60000 } })
    @Get('/:id')
    @RequireScopes(SCOPES.ROLES_READ)
    async getOne(@Param('id', new ParseUUIDPipe()) id: string) {
        const role = await this.roleRepository.findOne({ where: { id } });
        if (!role) {
            throw new HttpException({ code: 'ROLE_NOT_FOUND' }, HttpStatus.NOT_FOUND);
        }
        return this.toDto(role, await this.memberCount(id));
    }

    @Throttle({ default: { limit: 30, ttl: 60000 } })
    @Patch('/:id')
    @HttpCode(HttpStatus.OK)
    @RequireScopes(SCOPES.ROLES_WRITE)
    async update(
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body() body: UpdateRoleDto,
        @Req() req: Request,
    ) {
        const user = req.user as AuthenticatedUser;
        const role = await this.roleRepository.findOne({ where: { id } });
        if (!role) {
            throw new HttpException({ code: 'ROLE_NOT_FOUND' }, HttpStatus.NOT_FOUND);
        }
        if (this.isSystem(role)) {
            throw new HttpException({ code: 'ROLE_PROTECTED' }, HttpStatus.FORBIDDEN);
        }
        if (body.name !== undefined) {
            const name = body.name.trim();
            if (name.length < 2 || name.length > 50) {
                throw new HttpException({ code: 'INVALID_ROLE_NAME' }, HttpStatus.BAD_REQUEST);
            }
            if (await this.findByNameInsensitive(name, role.id)) {
                throw new HttpException({ code: 'ROLE_NAME_TAKEN' }, HttpStatus.CONFLICT);
            }
            role.name = name;
        }
        if (body.scopes !== undefined) {
            role.scopes = this.normalizeScopes(body.scopes);
        }
        role.lastUpdatedBy = user.sub;
        await this.roleRepository.save(role);
        return { success: true, role: this.toDto(role, await this.memberCount(role.id)) };
    }

    @Throttle({ default: { limit: 20, ttl: 60000 } })
    @Delete('/:id')
    @HttpCode(HttpStatus.OK)
    @RequireScopes(SCOPES.ROLES_WRITE)
    async remove(@Param('id', new ParseUUIDPipe()) id: string) {
        const role = await this.roleRepository.findOne({ where: { id } });
        if (!role) {
            throw new HttpException({ code: 'ROLE_NOT_FOUND' }, HttpStatus.NOT_FOUND);
        }
        if (this.isSystem(role)) {
            throw new HttpException({ code: 'ROLE_PROTECTED' }, HttpStatus.FORBIDDEN);
        }
        if ((await this.memberCount(role.id)) > 0) {
            throw new HttpException({ code: 'ROLE_HAS_MEMBERS' }, HttpStatus.CONFLICT);
        }
        await this.roleRepository.delete({ id: role.id });
        return { success: true };
    }
}