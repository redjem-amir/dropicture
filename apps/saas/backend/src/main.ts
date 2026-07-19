// dropicture/apps/saas/backend/src/main.ts
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import bodyParser from 'body-parser';
import helmet from 'helmet';
import { ConsoleLogger, Logger, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response, NextFunction } from 'express';
import { accessLog, frTimestamp } from './middleware/access-log.middleware';

const isProd = process.env.NODE_ENV === 'production';

function healthCheck(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'GET' && req.path === '/health') {
    res.status(200).json({ status: 'ok' });
    return;
  }
  next();
}

class FrenchConsoleLogger extends ConsoleLogger {
  protected getTimestamp(): string {
    return frTimestamp(new Date());
  }
}

async function App() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
    logger: new FrenchConsoleLogger(),
  });
  app.enableShutdownHooks();
  app.set('trust proxy', isProd ? 2 : false);
  app.use(healthCheck);
  app.use(accessLog);
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
    }),
  );
  app.use(bodyParser.json({ limit: '100kb' }));
  app.use(bodyParser.urlencoded({ limit: '100kb', extended: true }));
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const allowedOrigins = isProd ? ['https://app.dropicture.com', 'https://dropicture.com', 'https://www.dropicture.com'] : ['http://localhost:3001', 'http://localhost:3000'];
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  });
  const port = 3002;
  await app.listen(port, '0.0.0.0');
  new Logger('App').log(`Application is running on http://localhost:${port}`);
}

void App();
