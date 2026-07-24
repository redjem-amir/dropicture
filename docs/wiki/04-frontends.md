# 04 · Frontends

Deux applications Next.js distinctes. L'application authentifiée `apps/saas/frontend` et le site vitrine `apps/website`.

## Socle commun

| Élément | Version |
|---|---|
| Next.js | 16.2.10 |
| React / react-dom | 19.2.7 |
| Tailwind CSS | v4 (configuration par `@import`, sans `tailwind.config`) |
| TypeScript | ^6.0.3 |
| Bundler | Webpack (drapeau `--webpack` sur dev, build, start) |
| Animation | `motion` ^12 |
| Police | `Roboto_Flex` chargée via `next/font/google` |

Les deux applications utilisent l'App Router avec un dossier `src/`. Elles portent chacune un `bun.lock` et un `package-lock.json`. Les scripts `dev`, `build`, `start`, `lint` sont identiques à l'exception du port.

Il n'y a pas de design system centralisé ni de fichier de jetons. Les `globals.css` sont minimalistes (variables `--background`, `--foreground`, police de base), les couleurs sont posées au fil des composants en classes Tailwind. La maquette et la charte visuelle cible sont décrites en Annexe F.1.

## Application authentifiée · `apps/saas/frontend`

Port de développement 3001. Conteneurisée pour la production.

### Pages

| Route | Rôle |
|---|---|
| `/` | écran de connexion |
| `/signup` | inscription |
| `/auth` | fil authentifié (avec barre de navigation) |
| `/auth/library` | bibliothèque |
| `/auth/profile` | profil |
| `/auth/settings` | réglages |

### Dialogue avec le backend

Base d'API `NEXT_PUBLIC_API_URL` (dev `http://localhost:3002`). L'authentification côté client passe par `UserProvider` (contexte `useUser`), avec `credentials: 'include'` pour transporter le cookie de session.

- Connexion, inscription, déconnexion · `POST /api/auth/signin`, `signup`, `signout`.
- Profil courant · `GET /api/auth/me`.
- Rotation du jeton · `POST /api/auth/session`, planifiée avec 60 secondes de marge avant expiration, trois tentatives à backoff croissant.
- Synchronisation entre onglets via `BroadcastChannel('dropicture:auth:refresh')`, plus un rafraîchissement au retour de visibilité de l'onglet.

Côté serveur, `lib/session.ts` lit le cookie `session` et le résout par `POST /api/auth/resolve`, en `no-store`, mémoïsé par requête. L'expiration redirige vers `/` avec un motif (`session_expired`, `session_revoked`, `signed_out`) et conserve la destination initiale.

### Conteneur

`Dockerfile` multi-étapes sur `oven/bun:1.3.14-alpine`, sortie Next.js `standalone`, utilisateur non-root, `EXPOSE 3001`, `CMD ["bun","server.js"]`. La variable `NEXT_PUBLIC_API_URL` est injectée au build.

## Site vitrine · `apps/website`

Port de développement 3000. **Export statique** (`output: 'export'`, `trailingSlash: true`, `images.unoptimized`), publié sur S3 et servi par CloudFront. Pas de Dockerfile.

### Pages

`/` (vitrine), `/u/` (profil public), `/legal`, `/privacy`, `/terms`, `/cookies`.

### Profils publics

La contrainte du site statique impose de passer le pseudo en query string plutôt qu'en segment dynamique. La route de profil est donc `/u/?u=<pseudo>` (exemple `/u/?u=lena`), lue côté client via `useSearchParams`.

Les données sont récupérées **à l'exécution dans le navigateur**, pas au build. Toutes les pages sont clientes et appellent l'API publique du backend.

- Profil · `GET ${NEXT_PUBLIC_SAAS_BACKEND_URL}/api/public/{username}`.
- Médias paginés · `GET .../api/public/{username}/media?limit=48[&cursor=...]`.
- Recherche et suggestions de profils sur la page d'accueil.

Le bouton d'appel à l'action « Suivre » renvoie vers `${NEXT_PUBLIC_SAAS_FRONTEND_URL}/signup`.

## Variables d'environnement

| Application | Variable | Rôle |
|---|---|---|
| frontend | `NEXT_PUBLIC_API_URL` | base de l'API backend |
| frontend | `NEXT_PUBLIC_WEBSITE_URL` | lien vers la vitrine (référencée par la barre de navigation, à ajouter au `.env`) |
| website | `NEXT_PUBLIC_SAAS_BACKEND_URL` | base de l'API publique |
| website | `NEXT_PUBLIC_SAAS_FRONTEND_URL` | lien vers l'inscription |

## Points ouverts

Le fichier `src/proxy.ts` du frontend implémente une logique de middleware complète (résolution et rotation de session, garde des routes, en-têtes de sécurité) mais n'est pas câblé. Il exporte une fonction `proxy` alors que Next.js attend un `middleware` par défaut, et aucun `middleware.ts` ne l'importe. La protection repose donc aujourd'hui sur le layout serveur. Ce point et les autres écarts sont recensés dans [Amélioration continue](14-amelioration-continue.md).
