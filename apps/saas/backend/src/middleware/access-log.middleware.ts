// dropicture/apps/saas/backend/src/middleware/access-log.middleware.ts
import { Logger } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import type { AuthenticatedUser } from '../services/auth.service';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface User extends AuthenticatedUser {}
  }
}

const SKIP = new Set(['/health']);

const logger = new Logger('HTTP');

const TS_FR = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

export function frTimestamp(date: Date): string {
  const p: Record<string, string> = Object.fromEntries(
    TS_FR.formatToParts(date).map((x) => [x.type, x.value] as const),
  );
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}:${p.second}`;
}

function headerNum(res: Response, name: string): number | undefined {
  const v = res.getHeader(name);
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function accessLog(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (req.method === 'OPTIONS' || SKIP.has(req.path)) return next();
  const start = performance.now();
  let logged = false;
  const write = () => {
    if (logged) return;
    logged = true;
    const user = req.user;
    const route = req.route as { path?: string } | undefined;
    const limit = headerNum(res, 'x-ratelimit-limit');
    const remaining = headerNum(res, 'x-ratelimit-remaining');
    const entry = {
      event: 'http_access',
      ts: frTimestamp(new Date()),
      method: req.method,
      path: req.path,
      route: String(route?.path ?? ''),
      status: res.statusCode,
      aborted: res.writableEnded ? undefined : true,
      ip: String(req.ip ?? ''),
      user_id: String(user?.sub ?? ''),
      ratelimit:
        limit !== undefined && remaining !== undefined
          ? `${limit - remaining}/${limit}`
          : undefined,
      duration_ms: Math.round((performance.now() - start) * 10) / 10,
    };
    const line = JSON.stringify(entry);
    if (res.statusCode >= 500) logger.error(line);
    else if (res.statusCode >= 400) logger.warn(line);
    else logger.log(line);
  };
  res.on('finish', write);
  res.on('close', write);
  next();
}
