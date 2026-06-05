// dropicture/app/backend/src/controllers/auth.controller.ts
import { Body, Controller, Get, HttpCode, HttpException, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Response, Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { hash as argon2Hash, verify as argon2Verify } from '@node-rs/argon2';
import { Throttle } from '@nestjs/throttler';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { AuthService, AUTH_COOKIES, SESSION_COOKIE_OPTIONS, ACCESS_TOKEN_TTL_SECONDS, type AuthenticatedUser, type SessionContext } from '../services/auth.service';
import { Account, AccountStatus } from '../models/account.model';
import { RedisService } from '../services/redis.service';
import { getClientIp } from '../guards/throttler.guard';

export class SigninDto {
    @IsEmail({}, { message: 'EMAIL_INVALID' })
    @IsNotEmpty({ message: 'MISSING_CREDENTIALS' })
    @Transform(({ value }) => value?.toLowerCase().trim())
    email: string | undefined;

    @IsString()
    @IsNotEmpty({ message: 'MISSING_CREDENTIALS' })
    @MaxLength(128)
    password: string | undefined;
}

export class SignupDto {
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

const ARGON2_OPTIONS = {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
    outputLen: 32,
};

const DUMMY_ARGON2_HASH = '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHRzb21lc2FsdA$Yw5F8sZkKFi0YxZm7m4FqJ1aK3xD8V2n9QwPqRtUvWs';

@Controller('/api/auth')
export class AuthController {
    constructor(
        @InjectRepository(Account)
        private readonly accountRepository: Repository<Account>,
        private readonly authService: AuthService,
        private readonly redisService: RedisService,
    ) { }

    private extractClientContext(req: Request): SessionContext {
        const userAgent = req.headers['user-agent']?.toString();
        const ip = getClientIp(req);
        return { userAgent, ip };
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

    private async verifyPassword(storedHash: string, password: string): Promise<boolean> {
        try {
            return await argon2Verify(storedHash, password);
        } catch {
            return false;
        }
    }

    @Throttle({ default: { limit: 60, ttl: 60000 } })
    @Get('/me')
    @UseGuards(AuthGuard('access-token'))
    async me(@Req() req: Request) {
        const user = req.user as AuthenticatedUser;
        const account = await this.accountRepository.findOne({
            where: { id: user.sub },
        });
        if (!account) {
            throw new HttpException({ code: 'ACCOUNT_NOT_FOUND' }, HttpStatus.NOT_FOUND);
        }
        return {
            email: account.email,
            firstname: account.firstname,
            lastname: account.lastname,
            scope: user.scope,
            roles: user.roles,
        };
    }

    @Throttle({ default: { limit: 120, ttl: 60000 } })
    @Post('/resolve')
    @HttpCode(HttpStatus.OK)
    async resolve(@Req() req: Request) {
        const cookie = req.cookies?.[AUTH_COOKIES.SESSION];
        if (!cookie) throw new HttpException('Unauthenticated', HttpStatus.UNAUTHORIZED);
        const r = await this.authService.resolveSession(cookie);
        if (!r) throw new HttpException('Unauthenticated', HttpStatus.UNAUTHORIZED);
        return {
            sub: r.user.sub,
            scope: r.user.scope,
            roles: r.user.roles,
            accessExpiresAt: r.accessExpiresAt,
        };
    }

    @Throttle({ default: { limit: 10, ttl: 60000 } })
    @Post('/signin')
    async signin(@Body() body: SigninDto, @Req() req: Request, @Res() res: Response) {
        const { email, password } = body;
        if (!email || !password) {
            throw new HttpException({ code: 'MISSING_CREDENTIALS' }, HttpStatus.BAD_REQUEST);
        }
        const emailNormalized = email.toLowerCase().trim();
        const account = await this.accountRepository.findOne({
            where: { email: emailNormalized },
            relations: { roles: true },
        });
        if (!account) {
            await argon2Verify(DUMMY_ARGON2_HASH, password).catch(() => false);
            throw new HttpException({ code: 'INVALID_CREDENTIALS' }, HttpStatus.UNAUTHORIZED);
        }
        const passwordValid = await this.verifyPassword(account.password, password);
        if (!passwordValid) {
            throw new HttpException({ code: 'INVALID_CREDENTIALS' }, HttpStatus.UNAUTHORIZED);
        }
        const statusErrors: Partial<Record<AccountStatus, string>> = {
            [AccountStatus.PENDING]: 'ACCOUNT_PENDING',
            [AccountStatus.SUSPENDED]: 'ACCOUNT_SUSPENDED',
            [AccountStatus.BANNED]: 'ACCOUNT_BANNED',
        };
        const statusCode = statusErrors[account.status];
        if (statusCode) {
            throw new HttpException({ code: statusCode }, HttpStatus.FORBIDDEN);
        }
        const ctx = this.extractClientContext(req);
        const { cookie: sessionCookie, maxAgeSeconds } =
            await this.authService.createSession(account, ctx);
        res.cookie(AUTH_COOKIES.SESSION, sessionCookie, {
            ...SESSION_COOKIE_OPTIONS,
            maxAge: maxAgeSeconds * 1000,
        });
        await this.accountRepository.update({ id: account.id }, { lastSeenAt: new Date() });
        return res.status(200).send({
            success: true,
            expires_in: ACCESS_TOKEN_TTL_SECONDS,
        });
    }

    @Throttle({ default: { limit: 5, ttl: 3600000 } })
    @Post('/signup')
    async signup(@Body() body: SignupDto, @Req() req: Request) {
        let { firstname, lastname, email, password } = body;
        if (!firstname || !lastname || !email || !password) {
            throw new HttpException({ code: 'MISSING_FIELDS' }, HttpStatus.BAD_REQUEST);
        }
        firstname = this.formatName(firstname);
        lastname = this.formatName(lastname);
        if (firstname.length < 2 || firstname.length > 30 || lastname.length < 2 || lastname.length > 30) {
            throw new HttpException({ code: 'INVALID_NAME' }, HttpStatus.BAD_REQUEST);
        }
        email = email.toLowerCase().trim();
        const ip = getClientIp(req);
        const ipKey = `rate:signup:ip:${ip}`;
        const ipAttempts = await this.redisService.incr(ipKey);
        if (ipAttempts === 1) await this.redisService.expire(ipKey, 60 * 60);
        if (ipAttempts > 5) {
            throw new HttpException('Too many attempts', HttpStatus.TOO_MANY_REQUESTS);
        }
        const emailKey = `rate:signup:email:${email}`;
        const emailAttempts = await this.redisService.incr(emailKey);
        if (emailAttempts === 1) await this.redisService.expire(emailKey, 10 * 60);
        if (emailAttempts > 3) {
            throw new HttpException({ code: 'TOO_MANY_EMAILS' }, HttpStatus.TOO_MANY_REQUESTS);
        }
        if (await this.accountRepository.findOne({ where: { email } })) {
            throw new HttpException({ code: 'EMAIL_ALREADY_USED' }, HttpStatus.CONFLICT);
        }
        const passwordHash = await argon2Hash(password, ARGON2_OPTIONS);
        await this.accountRepository.save(
            this.accountRepository.create({
                firstname,
                lastname,
                email,
                password: passwordHash,
            }),
        );
        return { success: true };
    }

    @Throttle({ default: { limit: 30, ttl: 60000 } })
    @Post('/session')
    async session(@Req() req: Request, @Res() res: Response) {
        const currentCookie = req.cookies?.[AUTH_COOKIES.SESSION];
        if (!currentCookie) {
            throw new HttpException('Session missing', HttpStatus.UNAUTHORIZED);
        }
        const ctx = this.extractClientContext(req);
        const { cookie: newCookie, maxAgeSeconds } =
            await this.authService.rotateSession(currentCookie, ctx);
        res.cookie(AUTH_COOKIES.SESSION, newCookie, {
            ...SESSION_COOKIE_OPTIONS,
            maxAge: maxAgeSeconds * 1000,
        });
        return res.send({
            success: true,
            rotated: true,
            expires_in: ACCESS_TOKEN_TTL_SECONDS,
        });
    }

    @Throttle({ default: { limit: 20, ttl: 60000 } })
    @Post('/signout')
    @HttpCode(HttpStatus.OK)
    async signout(@Req() req: Request, @Res() res: Response) {
        const sessionCookie = req.cookies?.[AUTH_COOKIES.SESSION];
        if (sessionCookie) {
            await this.authService.revokeSessionCookie(sessionCookie);
        }
        res.clearCookie(AUTH_COOKIES.SESSION, SESSION_COOKIE_OPTIONS);
        return res.send({ message: 'Logged out' });
    }
}