// dropicture/apps/saas/backend/src/guards/api-key.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from '../models/account.entity';
import type { AuthenticatedUser } from '../services/auth.service';

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(Strategy, 'api-key') {
  constructor(
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
  ) {
    super();
  }

  async validate(req: Request): Promise<AuthenticatedUser | null> {
    const raw = req.query?.appid ?? req.headers['x-api-key'];
    const apiKey = typeof raw === 'string' ? raw.trim() : '';
    if (!apiKey) return null;
    if (apiKey.length < 8 || apiKey.length > 64) {
      throw new UnauthorizedException('INVALID_API_KEY');
    }
    const account = await this.accountRepository.findOne({
      where: { apiKey },
      select: { id: true },
    });
    if (!account) throw new UnauthorizedException('INVALID_API_KEY');
    return { sub: account.id };
  }
}
