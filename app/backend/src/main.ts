// dropicture/app/backend/src/main.ts
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import bodyParser from 'body-parser';
import helmet from 'helmet';
import { Logger, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response, NextFunction } from 'express';

const INTERNAL_PATHS = new Set<string>([
  '/health',
  '/healthz',
  '/ready',
  '/readyz',
  '/livez',
  '/metrics',
]);

function extractCfIp(req: Request): string | null {
  const raw = req.headers['cf-connecting-ip'];
  if (!raw) return null;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function App() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  app.enableShutdownHooks();
  app.set('trust proxy', 1);
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-site' },
      hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
    }),
  );
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (INTERNAL_PATHS.has(req.path)) {
      return next();
    }
    const cfIp = extractCfIp(req);
    if (!cfIp) {
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ message: 'Forbidden' });
      }
      return next();
    }
    (req as Request & { clientIp: string }).clientIp = cfIp;
    next();
  });
  app.use(bodyParser.json({ limit: '100kb' }));
  app.use(bodyParser.urlencoded({ limit: '100kb', extended: true }));
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableCors({
    origin: process.env.NODE_ENV === 'production' ? 'https://dropicture.com' : 'http://localhost:3000',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  });
  const port = Number(process.env.PORT ?? process.env.NOMAD_PORT_http ?? 3001);
  await app.listen(port, '0.0.0.0');
  new Logger('App').log(`Application is running on port ${port}`);
}

App();