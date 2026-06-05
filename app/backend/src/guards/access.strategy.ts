// dropicture/app/backend/src/guards/access.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { Request } from 'express';
import { AUTH_COOKIES, AuthService, type AuthenticatedUser } from '../services/auth.service';

@Injectable()
export class AccessTokenStrategy extends PassportStrategy(Strategy, 'access-token') {
  constructor(private readonly authService: AuthService) {
    super();
  }

  async validate(req: Request): Promise<AuthenticatedUser> {
    const cookie = req.cookies?.[AUTH_COOKIES.SESSION];
    if (!cookie) throw new UnauthorizedException('Session missing');
    const resolved = await this.authService.resolveSession(cookie);
    if (!resolved) throw new UnauthorizedException('Invalid or expired session');
    return resolved.user;
  }
}