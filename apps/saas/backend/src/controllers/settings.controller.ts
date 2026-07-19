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
import { ACCESS_TOKEN_TTL_SECONDS, ARGON2_OPTIONS, AUTH_COOKIES, AuthService, SESSION_COOKIE_OPTIONS, generateApiKey, type AuthenticatedUser } from '../services/auth.service';

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

export class UpdateProfileDto {
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
}

export class UpdateEmailDto {
  @IsEmail({}, { message: 'EMAIL_INVALID' })
  @IsNotEmpty({ message: 'EMAIL_INVALID' })
  @Transform(({ value }): unknown => (typeof value === 'string' ? value.toLowerCase().trim() : value))
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
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    private readonly authService: AuthService,
  ) {}

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Patch('/me')
  @HttpCode(HttpStatus.OK)
  async updateProfile(@Body() body: UpdateProfileDto, @Req() req: Request) {
    const user = req.user as AuthenticatedUser;
    const firstname = normalizeName(body.firstname);
    const lastname = normalizeName(body.lastname);
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
    const account = await this.accountRepository.findOne({
      where: { id: user.sub },
    });
    if (!account) {
      throw new HttpException({ code: 'ACCOUNT_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    }
    if (account.email === body.email) {
      return { success: true, email: account.email };
    }
    const existing = await this.accountRepository.findOne({
      where: { email: body.email },
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
    const user = req.user as AuthenticatedUser;
    const account = await this.accountRepository.findOne({
      where: { id: user.sub },
    });
    if (!account) {
      throw new HttpException({ code: 'ACCOUNT_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    }
    const valid = await argon2Verify(account.password, body.currentPassword).catch(() => false);
    if (!valid) {
      throw new HttpException({ code: 'INVALID_CREDENTIALS' }, HttpStatus.UNAUTHORIZED);
    }
    const password = await argon2Hash(body.newPassword, ARGON2_OPTIONS);
    await this.accountRepository.update({ id: account.id }, { password });
    await this.authService.revokeAllTokens(account.id);
    const currentCookie = req.cookies?.[AUTH_COOKIES.SESSION] as string | undefined;
    if (currentCookie) {
      await this.authService.revokeSessionCookie(currentCookie).catch(() => undefined);
    }
    const refreshed = await this.accountRepository.findOne({
      where: { id: account.id },
    });
    if (!refreshed) {
      throw new HttpException({ code: 'ACCOUNT_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    }
    const { cookie, maxAgeSeconds } = await this.authService.createSession(refreshed, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    res.cookie(AUTH_COOKIES.SESSION, cookie, {
      ...SESSION_COOKIE_OPTIONS,
      maxAge: maxAgeSeconds * 1000,
    });
    return res.status(HttpStatus.OK).send({
      success: true,
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
    });
  }

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Get('/apikey')
  @HttpCode(HttpStatus.OK)
  async getApiKey(@Req() req: Request) {
    const user = req.user as AuthenticatedUser;
    const account = await this.accountRepository.findOne({
      where: { id: user.sub },
      select: { id: true, apiKey: true, apiKeyCreatedAt: true },
    });
    if (!account) {
      throw new HttpException({ code: 'ACCOUNT_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    }
    return {
      apiKey: account.apiKey ?? null,
      createdAt: account.apiKeyCreatedAt ?? null,
    };
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('/apikey')
  @HttpCode(HttpStatus.OK)
  async rotateApiKey(@Req() req: Request) {
    const user = req.user as AuthenticatedUser;
    const apiKey = generateApiKey();
    const createdAt = new Date();
    const result = await this.accountRepository.update({ id: user.sub }, { apiKey, apiKeyCreatedAt: createdAt });
    if (!result.affected) {
      throw new HttpException({ code: 'ACCOUNT_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    }
    return { apiKey, createdAt };
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Delete('/apikey')
  @HttpCode(HttpStatus.OK)
  async revokeApiKey(@Req() req: Request) {
    const user = req.user as AuthenticatedUser;
    const result = await this.accountRepository.update({ id: user.sub }, { apiKey: null, apiKeyCreatedAt: null });
    if (!result.affected) {
      throw new HttpException({ code: 'ACCOUNT_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    }
    return { success: true };
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Delete('/account')
  async deleteAccount(@Body() body: DeleteAccountDto, @Req() req: Request, @Res() res: Response) {
    const user = req.user as AuthenticatedUser;
    const account = await this.accountRepository.findOne({
      where: { id: user.sub },
    });
    if (!account) {
      throw new HttpException({ code: 'ACCOUNT_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    }
    const valid = await argon2Verify(account.password, body.password).catch(() => false);
    if (!valid) {
      throw new HttpException({ code: 'INVALID_CREDENTIALS' }, HttpStatus.UNAUTHORIZED);
    }
    await this.accountRepository.delete({ id: account.id });
    const currentCookie = req.cookies?.[AUTH_COOKIES.SESSION] as string | undefined;
    if (currentCookie) {
      await this.authService.revokeSessionCookie(currentCookie).catch(() => undefined);
    }
    res.clearCookie(AUTH_COOKIES.SESSION, SESSION_COOKIE_OPTIONS);
    return res.status(HttpStatus.OK).send({ success: true });
  }
}
