// dropicture/apps/saas/backend/src/controllers/settings.controller.ts
import { Body, Controller, Delete, Get, HttpCode, HttpException, HttpStatus, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { hash as argon2Hash, verify as argon2Verify } from '@node-rs/argon2';
import { Throttle } from '@nestjs/throttler';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Account } from '../models/account.entity';
import { Media } from '../models/media.entity';
import { MediaService } from '../services/media.service';
import { ACCESS_TOKEN_TTL_SECONDS, ARGON2_OPTIONS, AUTH_COOKIES, AuthService, SESSION_COOKIE_OPTIONS, generateApiKey, type AuthenticatedUser } from '../services/auth.service';
import { NAME_PATTERN, RESERVED_USERNAMES, USERNAME_PATTERN, normalizeName } from './auth.controller';

const SITE = process.env.NODE_ENV === 'production' ? 'https://dropicture.com' : 'http://localhost:3000';

export class UpdateProfileDto {
  @IsString()
  @IsNotEmpty({ message: 'MISSING_FIELDS' })
  @MinLength(2, { message: 'INVALID_NAME' })
  @MaxLength(30, { message: 'INVALID_NAME' })
  @Matches(NAME_PATTERN, { message: 'INVALID_NAME' })
  firstname: string;

  @IsString()
  @IsNotEmpty({ message: 'MISSING_FIELDS' })
  @MinLength(2, { message: 'INVALID_NAME' })
  @MaxLength(30, { message: 'INVALID_NAME' })
  @Matches(NAME_PATTERN, { message: 'INVALID_NAME' })
  lastname: string;
}

export class UpdateUsernameDto {
  @IsString()
  @IsNotEmpty({ message: 'MISSING_FIELDS' })
  @MinLength(3, { message: 'USERNAME_TOO_SHORT' })
  @MaxLength(30, { message: 'USERNAME_TOO_LONG' })
  @Transform(({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  username: string;
}

export class UpdateEmailDto {
  @IsEmail({}, { message: 'EMAIL_INVALID' })
  @IsNotEmpty({ message: 'EMAIL_INVALID' })
  @Transform(({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  email: string;
}

export class UpdatePasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'INVALID_CREDENTIALS' })
  @MaxLength(128)
  currentPassword: string;

  @IsString()
  @IsNotEmpty({ message: 'MISSING_FIELDS' })
  @MinLength(8, { message: 'PASSWORD_TOO_SHORT' })
  @MaxLength(128, { message: 'PASSWORD_TOO_LONG' })
  @Matches(/[A-Z]/, { message: 'PASSWORD_MISSING_UPPERCASE' })
  @Matches(/[a-z]/, { message: 'PASSWORD_MISSING_LOWERCASE' })
  @Matches(/[0-9]/, { message: 'PASSWORD_MISSING_NUMBER' })
  @Matches(/[^A-Za-z0-9]/, { message: 'PASSWORD_MISSING_SPECIAL' })
  newPassword: string;
}

export class DeleteAccountDto {
  @IsString()
  @IsNotEmpty({ message: 'INVALID_CREDENTIALS' })
  @MaxLength(128)
  password: string;
}

@Controller('/api/settings')
@UseGuards(AuthGuard('access-token'))
export class SettingsController {
  constructor(
    private readonly media: MediaService,
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    @InjectRepository(Media)
    private readonly mediaRepository: Repository<Media>,
    private readonly authService: AuthService,
  ) {}

  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @Get('/')
  async show(@Req() req: Request) {
    const { sub } = req.user as AuthenticatedUser;
    const account = await this.accountRepository.findOne({ where: { id: sub } });
    if (!account) throw new HttpException({ code: 'ACCOUNT_NOT_FOUND' }, HttpStatus.NOT_FOUND);

    const row = await this.mediaRepository
      .createQueryBuilder('m')
      .select('COALESCE(SUM(CAST(m.bytes AS BIGINT)), 0)', 'bytes')
      .addSelect("COUNT(*) FILTER (WHERE m.mimeType LIKE 'image/%')", 'images')
      .addSelect("COUNT(*) FILTER (WHERE m.mimeType LIKE 'video/%')", 'videos')
      .addSelect('COUNT(*) FILTER (WHERE m.publishedAt IS NOT NULL)', 'published')
      .addSelect('COUNT(*) FILTER (WHERE m.publishedAt IS NULL)', 'private')
      .where('m.ownerId = :ownerId', { ownerId: sub })
      .andWhere("m.role = 'content'")
      .getRawOne<{
        bytes: string;
        images: string;
        videos: string;
        published: string;
        private: string;
      }>();

    return {
      username: account.username,
      firstname: account.firstname,
      lastname: account.lastname,
      email: account.email,
      publicUrl: `${SITE}/u/?u=${account.username}`,
      createdAt: account.createdAt.toISOString(),
      storage: {
        bytes: String(row?.bytes ?? 0),
        images: Number(row?.images ?? 0),
        videos: Number(row?.videos ?? 0),
        published: Number(row?.published ?? 0),
        private: Number(row?.private ?? 0),
      },
      limits: this.media.limits(),
    };
  }

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Patch('/me')
  @HttpCode(HttpStatus.OK)
  async updateProfile(@Body() body: UpdateProfileDto, @Req() req: Request) {
    const { sub } = req.user as AuthenticatedUser;
    const firstname = normalizeName(body.firstname);
    const lastname = normalizeName(body.lastname);
    if (firstname.length < 2 || firstname.length > 30 || lastname.length < 2 || lastname.length > 30) {
      throw new HttpException({ code: 'INVALID_NAME' }, HttpStatus.BAD_REQUEST);
    }
    const result = await this.accountRepository.update({ id: sub }, { firstname, lastname });
    if (!result.affected) throw new HttpException({ code: 'ACCOUNT_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    return { success: true, firstname, lastname };
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Patch('/username')
  @HttpCode(HttpStatus.OK)
  async updateUsername(@Body() body: UpdateUsernameDto, @Req() req: Request) {
    const { sub } = req.user as AuthenticatedUser;
    const username = body.username;
    if (!USERNAME_PATTERN.test(username)) {
      throw new HttpException({ code: 'USERNAME_INVALID' }, HttpStatus.BAD_REQUEST);
    }
    if (RESERVED_USERNAMES.has(username)) {
      throw new HttpException({ code: 'USERNAME_RESERVED' }, HttpStatus.BAD_REQUEST);
    }
    const account = await this.accountRepository.findOne({ where: { id: sub } });
    if (!account) throw new HttpException({ code: 'ACCOUNT_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    if (account.username === username) {
      return { success: true, username, publicUrl: `${SITE}/u/?u=${username}` };
    }
    const taken = await this.accountRepository.exists({ where: { username } });
    if (taken) throw new HttpException({ code: 'USERNAME_ALREADY_USED' }, HttpStatus.CONFLICT);
    await this.accountRepository.update({ id: sub }, { username });
    return { success: true, username, publicUrl: `${SITE}/u/?u=${username}` };
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Patch('/email')
  @HttpCode(HttpStatus.OK)
  async updateEmail(@Body() body: UpdateEmailDto, @Req() req: Request) {
    const { sub } = req.user as AuthenticatedUser;
    const account = await this.accountRepository.findOne({ where: { id: sub } });
    if (!account) throw new HttpException({ code: 'ACCOUNT_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    if (account.email === body.email) return { success: true, email: account.email };
    const existing = await this.accountRepository.findOne({
      where: { email: body.email },
      select: { id: true },
    });
    if (existing && existing.id !== account.id) {
      throw new HttpException({ code: 'EMAIL_ALREADY_USED' }, HttpStatus.CONFLICT);
    }
    await this.accountRepository.update({ id: account.id }, { email: body.email });
    return { success: true, email: body.email };
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Patch('/password')
  async updatePassword(@Body() body: UpdatePasswordDto, @Req() req: Request, @Res() res: Response) {
    const { sub } = req.user as AuthenticatedUser;
    const account = await this.accountRepository.createQueryBuilder('a').addSelect('a.passwordHash').where('a.id = :sub', { sub }).getOne();
    if (!account) throw new HttpException({ code: 'ACCOUNT_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    const valid = await argon2Verify(account.passwordHash, body.currentPassword).catch(() => false);
    if (!valid) throw new HttpException({ code: 'INVALID_CREDENTIALS' }, HttpStatus.UNAUTHORIZED);
    if (body.newPassword === body.currentPassword) {
      throw new HttpException({ code: 'PASSWORD_UNCHANGED' }, HttpStatus.BAD_REQUEST);
    }
    const passwordHash = await argon2Hash(body.newPassword, ARGON2_OPTIONS);
    await this.accountRepository.update({ id: account.id }, { passwordHash });
    await this.authService.revokeAllTokens(account.id);
    const currentCookie = req.cookies?.[AUTH_COOKIES.SESSION] as string | undefined;
    if (currentCookie) {
      await this.authService.revokeSessionCookie(currentCookie).catch(() => undefined);
    }
    const refreshed = await this.accountRepository.findOne({ where: { id: account.id } });
    if (!refreshed) throw new HttpException({ code: 'ACCOUNT_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    const { cookie, maxAgeSeconds } = await this.authService.createSession(refreshed, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    res.cookie(AUTH_COOKIES.SESSION, cookie, {
      ...SESSION_COOKIE_OPTIONS,
      maxAge: maxAgeSeconds * 1000,
    });
    return res.status(HttpStatus.OK).send({ success: true, expires_in: ACCESS_TOKEN_TTL_SECONDS });
  }

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Get('/apikey')
  @HttpCode(HttpStatus.OK)
  async getApiKey(@Req() req: Request) {
    const { sub } = req.user as AuthenticatedUser;
    const account = await this.accountRepository.createQueryBuilder('a').addSelect('a.apiKey').where('a.id = :sub', { sub }).getOne();
    if (!account) throw new HttpException({ code: 'ACCOUNT_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    return { apiKey: account.apiKey ?? null, issuedAt: account.apiKeyIssuedAt?.toISOString() ?? null };
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('/apikey')
  @HttpCode(HttpStatus.OK)
  async rotateApiKey(@Req() req: Request) {
    const { sub } = req.user as AuthenticatedUser;
    const apiKey = generateApiKey();
    const issuedAt = new Date();
    const result = await this.accountRepository.update({ id: sub }, { apiKey, apiKeyIssuedAt: issuedAt });
    if (!result.affected) throw new HttpException({ code: 'ACCOUNT_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    return { apiKey, issuedAt: issuedAt.toISOString() };
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Delete('/apikey')
  @HttpCode(HttpStatus.OK)
  async revokeApiKey(@Req() req: Request) {
    const { sub } = req.user as AuthenticatedUser;
    const result = await this.accountRepository.update({ id: sub }, { apiKey: null, apiKeyIssuedAt: null });
    if (!result.affected) throw new HttpException({ code: 'ACCOUNT_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    return { success: true };
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Delete('/account')
  async deleteAccount(@Body() body: DeleteAccountDto, @Req() req: Request, @Res() res: Response) {
    const { sub } = req.user as AuthenticatedUser;
    const account = await this.accountRepository.createQueryBuilder('a').addSelect('a.passwordHash').where('a.id = :sub', { sub }).getOne();
    if (!account) throw new HttpException({ code: 'ACCOUNT_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    const valid = await argon2Verify(account.passwordHash, body.password).catch(() => false);
    if (!valid) throw new HttpException({ code: 'INVALID_CREDENTIALS' }, HttpStatus.UNAUTHORIZED);
    const files = await this.mediaRepository.find({
      where: { ownerId: account.id },
      select: { id: true },
    });
    await this.media.destroy(
      account.id,
      files.map((f) => f.id),
    );
    await this.accountRepository.delete({ id: account.id });
    const currentCookie = req.cookies?.[AUTH_COOKIES.SESSION] as string | undefined;
    if (currentCookie) {
      await this.authService.revokeSessionCookie(currentCookie).catch(() => undefined);
    }
    res.clearCookie(AUTH_COOKIES.SESSION, SESSION_COOKIE_OPTIONS);
    return res.status(HttpStatus.OK).send({ success: true });
  }
}
