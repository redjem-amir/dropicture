// dropicture/apps/saas/backend/src/controllers/auth.controller.ts
import { Body, Controller, Get, HttpCode, HttpException, HttpStatus, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Response, Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { hash as argon2Hash, verify as argon2Verify } from '@node-rs/argon2';
import { Throttle } from '@nestjs/throttler';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ACCESS_TOKEN_TTL_SECONDS, ARGON2_OPTIONS, AUTH_COOKIES, AuthService, SESSION_COOKIE_OPTIONS, generateApiKey, type AuthenticatedUser } from '../services/auth.service';
import { Account } from '../models/account.entity';

export const USERNAME_RE = /^[a-z0-9](?:[a-z0-9_]|\.(?!\.)){1,28}[a-z0-9]$/;

const RESERVED_USERNAMES = new Set([
  'about',
  'admin',
  'api',
  'app',
  'apps',
  'auth',
  'billing',
  'blog',
  'cdn',
  'contact',
  'cookies',
  'dashboard',
  'dev',
  'discover',
  'doc',
  'docs',
  'dropicture',
  'explore',
  'faq',
  'ftp',
  'help',
  'home',
  'img',
  'legal',
  'login',
  'logout',
  'mail',
  'me',
  'media',
  'new',
  'news',
  'null',
  'privacy',
  'profile',
  'profiles',
  'root',
  'search',
  's',
  'security',
  'settings',
  'signin',
  'signup',
  'staff',
  'static',
  'status',
  'support',
  'system',
  'terms',
  'topics',
  'undefined',
  'user',
  'users',
  'www',
]);

const normalizeEmail = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.toLowerCase().trim() : value);

const normalizeUsername = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.toLowerCase().trim() : value);

const normalizeName = (name: string): string =>
  name
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/-+/g, '-')
    .split(' ')
    .map((word) =>
      word
        .split('-')
        .map((part) => {
          const isUniform = part === part.toUpperCase() || part === part.toLowerCase();
          return isUniform ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : part;
        })
        .join('-'),
    )
    .join(' ');

export class SigninDto {
  @IsEmail({}, { message: 'EMAIL_INVALID' })
  @IsNotEmpty({ message: 'MISSING_CREDENTIALS' })
  @Transform(normalizeEmail)
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'MISSING_CREDENTIALS' })
  @MaxLength(128)
  password: string;
}

export class SignupDto {
  @IsString()
  @IsNotEmpty({ message: 'MISSING_FIELDS' })
  @MinLength(2, { message: 'INVALID_NAME' })
  @MaxLength(30, { message: 'INVALID_NAME' })
  @Matches(/^[a-zA-ZÀ-ÿ\s'-]+$/, { message: 'INVALID_NAME' })
  firstname: string;

  @IsString()
  @IsNotEmpty({ message: 'MISSING_FIELDS' })
  @MinLength(2, { message: 'INVALID_NAME' })
  @MaxLength(30, { message: 'INVALID_NAME' })
  @Matches(/^[a-zA-ZÀ-ÿ\s'-]+$/, { message: 'INVALID_NAME' })
  lastname: string;

  @IsString()
  @IsNotEmpty({ message: 'MISSING_FIELDS' })
  @MinLength(3, { message: 'USERNAME_TOO_SHORT' })
  @MaxLength(30, { message: 'USERNAME_TOO_LONG' })
  @Matches(USERNAME_RE, { message: 'USERNAME_INVALID' })
  @Transform(normalizeUsername)
  username: string;

  @IsEmail({}, { message: 'EMAIL_INVALID' })
  @IsNotEmpty({ message: 'MISSING_FIELDS' })
  @Transform(normalizeEmail)
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'MISSING_FIELDS' })
  @MinLength(8, { message: 'PASSWORD_TOO_SHORT' })
  @MaxLength(128, { message: 'PASSWORD_TOO_LONG' })
  @Matches(/[A-Z]/, { message: 'PASSWORD_MISSING_UPPERCASE' })
  @Matches(/[a-z]/, { message: 'PASSWORD_MISSING_LOWERCASE' })
  @Matches(/[0-9]/, { message: 'PASSWORD_MISSING_NUMBER' })
  @Matches(/[^A-Za-z0-9]/, { message: 'PASSWORD_MISSING_SPECIAL' })
  password: string;
}

const DUMMY_ARGON2_HASH = '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHRzb21lc2FsdA$Yw5F8sZkKFi0YxZm7m4FqJ1aK3xD8V2n9QwPqRtUvWs';

@Controller('/api/auth')
export class AuthController {
  constructor(
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    private readonly authService: AuthService,
  ) {}

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
      username: account.username,
      firstname: account.firstname,
      lastname: account.lastname,
    };
  }

  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Get('/username/:username')
  @HttpCode(HttpStatus.OK)
  async checkUsername(@Param('username') raw: string) {
    const username = raw.toLowerCase().trim();
    if (!USERNAME_RE.test(username)) {
      return { username, available: false, code: 'USERNAME_INVALID' };
    }
    if (RESERVED_USERNAMES.has(username)) {
      return { username, available: false, code: 'USERNAME_RESERVED' };
    }
    const taken = await this.accountRepository.exists({ where: { username } });
    return {
      username,
      available: !taken,
      code: taken ? 'USERNAME_ALREADY_USED' : null,
    };
  }

  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @Post('/resolve')
  @HttpCode(HttpStatus.OK)
  async resolve(@Req() req: Request) {
    const cookie = req.cookies?.[AUTH_COOKIES.SESSION] as string | undefined;
    if (!cookie) throw new HttpException('Unauthenticated', HttpStatus.UNAUTHORIZED);
    const resolved = await this.authService.resolveSession(cookie);
    if (!resolved) throw new HttpException('Unauthenticated', HttpStatus.UNAUTHORIZED);
    return {
      sub: resolved.user.sub,
      accessExpiresAt: resolved.accessExpiresAt,
    };
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('/signin')
  async signin(@Body() body: SigninDto, @Req() req: Request, @Res() res: Response) {
    const account = await this.accountRepository.findOne({
      where: { email: body.email },
    });
    if (!account) {
      await argon2Verify(DUMMY_ARGON2_HASH, body.password).catch(() => false);
      throw new HttpException({ code: 'INVALID_CREDENTIALS' }, HttpStatus.UNAUTHORIZED);
    }
    const passwordValid = await argon2Verify(account.password, body.password).catch(() => false);
    if (!passwordValid) {
      throw new HttpException({ code: 'INVALID_CREDENTIALS' }, HttpStatus.UNAUTHORIZED);
    }
    const { cookie, maxAgeSeconds } = await this.authService.createSession(account, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    res.cookie(AUTH_COOKIES.SESSION, cookie, {
      ...SESSION_COOKIE_OPTIONS,
      maxAge: maxAgeSeconds * 1000,
    });
    await this.accountRepository.update({ id: account.id }, { lastSeenAt: new Date() });
    return res.status(HttpStatus.OK).send({
      success: true,
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
    });
  }

  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  @Post('/signup')
  async signup(@Body() body: SignupDto) {
    const firstname = normalizeName(body.firstname);
    const lastname = normalizeName(body.lastname);
    if (firstname.length < 2 || firstname.length > 30 || lastname.length < 2 || lastname.length > 30) {
      throw new HttpException({ code: 'INVALID_NAME' }, HttpStatus.BAD_REQUEST);
    }
    if (RESERVED_USERNAMES.has(body.username)) {
      throw new HttpException({ code: 'USERNAME_RESERVED' }, HttpStatus.BAD_REQUEST);
    }
    const existing = await this.accountRepository.findOne({
      where: [{ email: body.email }, { username: body.username }],
      select: { id: true, email: true, username: true },
    });
    if (existing) {
      throw new HttpException(
        {
          code: existing.email === body.email ? 'EMAIL_ALREADY_USED' : 'USERNAME_ALREADY_USED',
        },
        HttpStatus.CONFLICT,
      );
    }
    const password = await argon2Hash(body.password, ARGON2_OPTIONS);
    try {
      await this.accountRepository.save(
        this.accountRepository.create({
          firstname,
          lastname,
          username: body.username,
          email: body.email,
          password,
          apiKey: generateApiKey(),
          apiKeyCreatedAt: new Date(),
        }),
      );
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === '23505') {
        throw new HttpException({ code: 'USERNAME_ALREADY_USED' }, HttpStatus.CONFLICT);
      }
      throw err;
    }
    return { success: true };
  }

  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post('/session')
  async session(@Req() req: Request, @Res() res: Response) {
    const currentCookie = req.cookies?.[AUTH_COOKIES.SESSION] as string | undefined;
    if (!currentCookie) {
      throw new HttpException('Session missing', HttpStatus.UNAUTHORIZED);
    }
    const { cookie, maxAgeSeconds } = await this.authService.rotateSession(currentCookie, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    res.cookie(AUTH_COOKIES.SESSION, cookie, {
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
    const sessionCookie = req.cookies?.[AUTH_COOKIES.SESSION] as string | undefined;
    if (sessionCookie) {
      await this.authService.revokeSessionCookie(sessionCookie);
    }
    res.clearCookie(AUTH_COOKIES.SESSION, SESSION_COOKIE_OPTIONS);
    return res.send({ message: 'Logged out' });
  }
}
