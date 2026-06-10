// dropicture/app/backend/src/controllers/settings.controller.ts
import { Body, Controller, Delete, HttpCode, HttpException, HttpStatus, Patch, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { hash as argon2Hash, verify as argon2Verify } from '@node-rs/argon2';
import { Throttle } from '@nestjs/throttler';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Account } from '../models/account.model';
import { AuthService, AUTH_COOKIES, SESSION_COOKIE_OPTIONS, type AuthenticatedUser } from '../services/auth.service';

export class UpdateProfileDto {
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
}

export class UpdateEmailDto {
    @IsEmail({}, { message: 'EMAIL_INVALID' })
    @IsNotEmpty({ message: 'EMAIL_INVALID' })
    @Transform(({ value }) => value?.toLowerCase().trim())
    email: string | undefined;
}

export class UpdatePasswordDto {
    @IsString()
    @IsNotEmpty({ message: 'INVALID_CREDENTIALS' })
    @MaxLength(128)
    currentPassword: string | undefined;

    @IsString()
    @IsNotEmpty({ message: 'MISSING_FIELDS' })
    @MinLength(8, { message: 'PASSWORD_TOO_SHORT' })
    @MaxLength(128, { message: 'PASSWORD_TOO_LONG' })
    @Matches(/[A-Z]/, { message: 'PASSWORD_MISSING_UPPERCASE' })
    @Matches(/[a-z]/, { message: 'PASSWORD_MISSING_LOWERCASE' })
    @Matches(/[0-9]/, { message: 'PASSWORD_MISSING_NUMBER' })
    @Matches(/[^A-Za-z0-9]/, { message: 'PASSWORD_MISSING_SPECIAL' })
    newPassword: string | undefined;
}

export class DeleteAccountDto {
    @IsString()
    @IsNotEmpty({ message: 'INVALID_CREDENTIALS' })
    @MaxLength(128)
    password: string | undefined;
}

const ARGON2_OPTIONS = {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
    outputLen: 32,
};

@Controller('/api/settings')
@UseGuards(AuthGuard('access-token'))
export class SettingsController {
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

    private async verifyPassword(storedHash: string, password: string): Promise<boolean> {
        try {
            return await argon2Verify(storedHash, password);
        } catch {
            return false;
        }
    }

    private currentSid(req: Request): string | null {
        const cookie = req.cookies?.[AUTH_COOKIES.SESSION] as string | undefined;
        if (!cookie) return null;
        const i = cookie.indexOf('.');
        return i > 0 ? cookie.slice(0, i) : null;
    }

    @Throttle({ default: { limit: 20, ttl: 60000 } })
    @Patch('/profile')
    @HttpCode(HttpStatus.OK)
    async updateProfile(@Body() body: UpdateProfileDto, @Req() req: Request) {
        const user = req.user as AuthenticatedUser;
        if (!body.firstname || !body.lastname) {
            throw new HttpException({ code: 'MISSING_FIELDS' }, HttpStatus.BAD_REQUEST);
        }
        const firstname = this.formatName(body.firstname);
        const lastname = this.formatName(body.lastname);
        if (firstname.length < 2 || firstname.length > 30 || lastname.length < 2 || lastname.length > 30) {
            throw new HttpException({ code: 'INVALID_NAME' }, HttpStatus.BAD_REQUEST);
        }
        const result = await this.accountRepository.update({ id: user.sub }, { firstname, lastname });
        if (!result.affected) {
            throw new HttpException({ code: 'ACCOUNT_NOT_FOUND' }, HttpStatus.NOT_FOUND);
        }
        return { success: true, firstname, lastname };
    }

    @Throttle({ default: { limit: 10, ttl: 60000 } })
    @Patch('/email')
    @HttpCode(HttpStatus.OK)
    async updateEmail(@Body() body: UpdateEmailDto, @Req() req: Request) {
        const user = req.user as AuthenticatedUser;
        if (!body.email) {
            throw new HttpException({ code: 'EMAIL_INVALID' }, HttpStatus.BAD_REQUEST);
        }
        const email = body.email.toLowerCase().trim();
        const account = await this.accountRepository.findOne({ where: { id: user.sub } });
        if (!account) {
            throw new HttpException({ code: 'ACCOUNT_NOT_FOUND' }, HttpStatus.NOT_FOUND);
        }
        if (account.email === email) {
            return { success: true };
        }
        const existing = await this.accountRepository.findOne({ where: { email } });
        if (existing && existing.id !== account.id) {
            throw new HttpException({ code: 'EMAIL_ALREADY_USED' }, HttpStatus.CONFLICT);
        }
        await this.accountRepository.update({ id: account.id }, { email });
        return { success: true, email };
    }

    @Throttle({ default: { limit: 10, ttl: 60000 } })
    @Patch('/password')
    @HttpCode(HttpStatus.OK)
    async updatePassword(@Body() body: UpdatePasswordDto, @Req() req: Request) {
        const user = req.user as AuthenticatedUser;
        if (!body.currentPassword || !body.newPassword) {
            throw new HttpException({ code: 'MISSING_FIELDS' }, HttpStatus.BAD_REQUEST);
        }
        const account = await this.accountRepository.findOne({ where: { id: user.sub } });
        if (!account) {
            throw new HttpException({ code: 'ACCOUNT_NOT_FOUND' }, HttpStatus.NOT_FOUND);
        }
        const valid = await this.verifyPassword(account.password, body.currentPassword);
        if (!valid) {
            throw new HttpException({ code: 'INVALID_CREDENTIALS' }, HttpStatus.UNAUTHORIZED);
        }
        const passwordHash = await argon2Hash(body.newPassword, ARGON2_OPTIONS);
        await this.accountRepository.update({ id: account.id }, { password: passwordHash });
        const sid = this.currentSid(req);
        if (sid) {
            await this.authService.revokeOtherAccountSessions(account.id, sid).catch(() => undefined);
        }
        return { success: true };
    }

    @Throttle({ default: { limit: 5, ttl: 60000 } })
    @Delete('/account')
    @HttpCode(HttpStatus.OK)
    async deleteAccount(@Body() body: DeleteAccountDto, @Req() req: Request, @Res() res: Response) {
        const user = req.user as AuthenticatedUser;
        if (!body.password) {
            throw new HttpException({ code: 'INVALID_CREDENTIALS' }, HttpStatus.UNAUTHORIZED);
        }
        const account = await this.accountRepository.findOne({
            where: { id: user.sub },
            relations: { roles: true },
        });
        if (!account) {
            throw new HttpException({ code: 'ACCOUNT_NOT_FOUND' }, HttpStatus.NOT_FOUND);
        }
        const valid = await this.verifyPassword(account.password, body.password);
        if (!valid) {
            throw new HttpException({ code: 'INVALID_CREDENTIALS' }, HttpStatus.UNAUTHORIZED);
        }
        await this.authService.revokeOtherAccountSessions(account.id, '').catch(() => undefined);
        account.roles = [];
        await this.accountRepository.save(account);
        await this.accountRepository.delete({ id: account.id });
        res.clearCookie(AUTH_COOKIES.SESSION, SESSION_COOKIE_OPTIONS);
        return res.status(HttpStatus.OK).send({ success: true });
    }
}