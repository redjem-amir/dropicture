// dropicture/apps/saas/backend/src/middleware/access-log.middleware.ts
/**
 * Intergiciel de journalisation des accès HTTP et horodatage commun des traces. Émet une ligne JSON
 * par requête servie, avec le verbe, le chemin, la route résolue, le statut, l'appelant, la
 * consommation du quota et la durée de traitement.
 *
 * @remarks La trace ne contient ni corps de requête, ni cookie, ni en-tête d'autorisation, ni chaîne
 * de requête. Du porteur, seul l'identifiant de compte est repris, jamais son adresse électronique,
 * ce qui procure la traçabilité attendue sans recopier de donnée personnelle dans les journaux. Le
 * format JSON sur une ligne est directement indexable par un collecteur de journaux.
 */
import { Logger } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import type { AuthenticatedUser } from '../services/auth.service';

/**
 * Aligne le typage de `req.user` d'Express sur l'identité produite par les stratégies
 * d'authentification, ce qui permet de lire l'identifiant du compte sans transtypage ni accès à `any`.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface User extends AuthenticatedUser {}
  }
}

/**
 * Chemins exclus du journal. La sonde de disponibilité `/health` est interrogée en continu par
 * l'infrastructure, la tracer noierait les accès réels et gonflerait le volume conservé sans apport.
 */
const SKIP = new Set(['/health']);

/** Journal unique du contexte `HTTP`, instancié au chargement du module puisque l'intergiciel est une fonction et non une classe injectable. */
const logger = new Logger('HTTP');

/**
 * Formateur d'horodatage figé sur le fuseau Europe/Paris et sur une horloge de vingt quatre heures.
 * Le fuseau est explicite pour que les traces restent comparables quelle que soit la configuration du
 * serveur, et l'instance est construite une seule fois car la création d'un formateur `Intl` est
 * coûteuse au regard de la fréquence des requêtes.
 */
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

/**
 * Formate un instant en horodatage français.
 *
 * @param date - Instant à formater.
 * @returns Chaîne au format `jj/mm/aaaa hh:mm:ss` exprimée à l'heure de Paris.
 * @remarks Le passage par les fragments du formateur puis la recomposition manuelle rendent le
 * résultat indépendant des séparateurs retenus par l'implémentation d'`Intl`, qui varient d'une
 * version de Node à l'autre. La même fonction horodate le journal d'accès et le journal de console de
 * l'application, ce qui garantit un format unique dans toutes les traces.
 */
export function frTimestamp(date: Date): string {
  const p: Record<string, string> = Object.fromEntries(TS_FR.formatToParts(date).map((x) => [x.type, x.value] as const));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}:${p.second}`;
}

/** Lit un en-tête de réponse et le convertit en nombre, avec `undefined` quand l'en-tête est absent ou non numérique. */
function headerNum(res: Response, name: string): number | undefined {
  const v = res.getHeader(name);
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Journalise la requête HTTP en cours, au moment où sa réponse se termine.
 *
 * @param req - Requête Express servie, source du verbe, du chemin, de la route résolue par Express,
 * de l'adresse de l'appelant et de `req.user` lorsque l'authentification a eu lieu.
 * @param res - Réponse Express, observée pour le statut final, les en-têtes de quota et l'état
 * d'achèvement de l'écriture.
 * @param next - Poursuite de la chaîne d'intergiciels, appelée immédiatement dans tous les cas.
 * @returns Rien, l'écriture de la trace est différée aux évènements de fin de réponse.
 * @remarks Les requêtes de pré vérification `OPTIONS` et les chemins exclus repartent sans trace ni
 * instrumentation. L'écriture est protégée par un drapeau car `finish` et `close` peuvent se
 * déclencher tous les deux sur une même réponse, la ligne n'est donc émise qu'une fois. Le
 * raccordement à `close` assure qu'une requête interrompue par le client est tout de même tracée, le
 * champ `aborted` la signalant. La consommation du quota est reconstituée à partir des en-têtes
 * `x-ratelimit-limit` et `x-ratelimit-remaining` posés par la limitation de débit, sous la forme
 * consommé sur total, ce qui rend visible une attaque par répétition. Le niveau de trace suit le
 * statut, erreur à partir de cinq cents, avertissement à partir de quatre cents, information sinon,
 * afin qu'une règle d'alerte se branche sur le niveau sans analyser la charge utile. La durée est
 * mesurée avec l'horloge monotone et arrondie au dixième de milliseconde.
 */
export function accessLog(req: Request, res: Response, next: NextFunction): void {
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
      ratelimit: limit !== undefined && remaining !== undefined ? `${limit - remaining}/${limit}` : undefined,
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
