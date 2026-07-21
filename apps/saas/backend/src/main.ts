// dropicture/apps/saas/backend/src/main.ts
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import bodyParser from 'body-parser';
import helmet from 'helmet';
import { ConsoleLogger, Logger, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
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
  const openapi = new DocumentBuilder()
    .setTitle('dropicture API')
    .setDescription(
      [
        'API REST de la plateforme dropicture (photos & albums, publication, réseau social léger).',
        '',
        '### Authentification',
        '- **Session (cookie `session`)** : cookie opaque `httpOnly` adossé à Redis, avec expiration glissante (30 min) et absolue (8 h), rotation par nonce et détection de rejeu. Utilisé par toutes les routes protégées.',
        "- **Clé d'API** : en-tête `x-api-key` (ou paramètre `?appid=`) pour l'accès programmatique.",
        '',
        '### Conventions',
        '- Les erreurs renvoient un corps `{ code: string }` (ex. `INVALID_CREDENTIALS`, `ACCOUNT_NOT_FOUND`).',
        '- Débit limité par IP/route (`@nestjs/throttler`, stockage Redis) : en-têtes `x-ratelimit-*`.',
        '- Pagination par curseur opaque (`cursor` / `nextCursor`).',
      ].join('\n'),
    )
    .setVersion('1.0')
    .addServer('https://app.dropicture.com', 'Production (via Traefik)')
    .addServer('http://localhost:3002', 'Développement local')
    .addCookieAuth('session', { type: 'apiKey', in: 'cookie', name: 'session' }, 'session')
    .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'api-key')
    .addTag('Authentification', 'Inscription, connexion, session')
    .addTag('Bibliothèque', 'Médias privés, upload, albums, publication')
    .addTag('Profil', 'Profil, bio, avatar')
    .addTag('Découverte', 'Fil, abonnements')
    .addTag('Paramètres', "Compte, sécurité, clé d'API")
    .addTag('API publique', 'Endpoints ouverts (profils et galeries publics)')
    .build();
  const document = SwaggerModule.createDocument(app, openapi);
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs-json',
    customSiteTitle: 'dropicture API',
    swaggerOptions: { persistAuthorization: true, tagsSorter: 'alpha' },
  });

  const port = 3002;
  await app.listen(port, '0.0.0.0');
  new Logger('App').log(`Application is running on http://localhost:${port}`);
}

void App();
