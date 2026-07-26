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

/**
 * Indicateur d'environnement de production, résolu une seule fois au chargement du module. Il commande
 * le nombre de relais de confiance déclarés à Express et la liste des origines acceptées par CORS, donc
 * l'essentiel du durcissement appliqué au démarrage.
 */
const isProd = process.env.NODE_ENV === 'production';

/**
 * Intergiciel de sonde de disponibilité. Répond directement à `GET /health` et court-circuite le reste
 * de la chaîne Express.
 *
 * @remarks Enregistré en premier dans la pile, la sonde reste joignable même si les couches suivantes
 * (helmet, analyse du corps, validation globale) refusent la requête. Le chemin `/health` est également
 * exclu du journal d'accès, ce qui évite de noyer les traces sous les appels répétés de l'orchestrateur.
 * @param req - Requête Express, seuls la méthode et le chemin sont inspectés.
 * @param res - Réponse Express, reçoit le statut 200 et le corps `{ status: 'ok' }` en cas de correspondance.
 * @param next - Relais vers l'intergiciel suivant pour toute requête qui n'est pas la sonde.
 * @returns Rien, la fonction répond elle-même ou délègue.
 */
function healthCheck(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'GET' && req.path === '/health') {
    res.status(200).json({ status: 'ok' });
    return;
  }
  next();
}

/**
 * Journaliseur applicatif dérivé de `ConsoleLogger`, substitué à celui de Nest dès la fabrique
 * d'application. Il ne redéfinit que la fabrication de l'horodatage.
 *
 * @remarks L'horodatage par défaut de Nest est un écart en millisecondes depuis la ligne précédente,
 * peu exploitable en exploitation. Le format français calé sur le fuseau Europe/Paris aligne les traces
 * du noyau applicatif sur celles du journal d'accès HTTP, ce qui rend les deux flux corrélables lors
 * d'une analyse d'incident.
 */
class FrenchConsoleLogger extends ConsoleLogger {
  /** Horodatage préfixant chaque ligne de journal, au format `jj/mm/aaaa hh:mm:ss` en heure de Paris. */
  protected getTimestamp(): string {
    return frTimestamp(new Date());
  }
}

/**
 * Amorce l'application Nest, assemble la pile Express, publie le contrat OpenAPI puis ouvre l'écoute
 * sur le port 3002.
 *
 * @remarks Ordre d'exécution des intergiciels, sonde de disponibilité, journal d'accès, en-têtes de
 * sécurité helmet, analyse du corps bornée à 100 ko, lecture des cookies, puis validation globale.
 * L'analyseur de corps intégré de Nest est désactivé (`bodyParser: false`) afin de maîtriser cette
 * borne de taille et de rejeter tôt les corps volumineux. Les deux analyseurs déclarés ici ne traitent
 * que le JSON et les formulaires encodés, le téléversement binaire de médias passe donc au travers sans
 * être mis en mémoire et reste consommé en flux par son contrôleur. helmet laisse la politique de
 * sécurité de contenu au frontal, ouvre les ressources en `cross-origin` pour autoriser la diffusion des
 * médias vers un autre domaine, et pose un HSTS de deux ans avec sous-domaines et préchargement.
 * La validation globale supprime les propriétés non déclarées dans les DTO (`whitelist`) et rejette
 * celles en surnombre (`forbidNonWhitelisted`), ce qui ferme la porte à l'affectation en masse.
 * CORS fonctionne sur liste blanche explicite avec transport des cookies, une origine inconnue est
 * refusée sans lever d'erreur.
 * `trust proxy` vaut 2 en production, ce qui fait remonter l'adresse cliente réelle à travers les deux
 * relais placés devant l'application et rend fiable la limitation de débit par IP.
 * `enableShutdownHooks` raccroche les cycles d'arrêt de Nest aux signaux du système, les connexions
 * Postgres et Redis sont donc libérées proprement à chaque redéploiement.
 * @returns Une promesse résolue une fois le serveur en écoute sur `0.0.0.0:3002`.
 */
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
  // Contrat OpenAPI servi sur /api/docs et /api/docs-json. Les deux mécanismes d'authentification y sont
  // déclarés, le cookie de session opaque et la clé d'API pour l'accès programmatique, et les routes sont
  // regroupées par étiquette de domaine.
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

// Amorçage déclenché au chargement du module. La promesse est volontairement ignorée, un échec de
// démarrage remonte en rejet non capturé et fait tomber le conteneur plutôt que de laisser tourner une
// instance à moitié initialisée.
void App();
