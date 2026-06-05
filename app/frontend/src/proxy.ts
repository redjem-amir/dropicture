// dropicture/app/frontend/src/proxy.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { ROUTE_ACCESS } from './lib/routeAccess'
import { hasScope } from './lib/scopes'

const AUTH_ROUTES = new Set(['/signin', '/signup'])
const APP_PATH = '/auth'
const SIGNIN_PATH = '/signin'
const ACCESS_TOKEN_REFRESH_MARGIN_SECONDS = 60

type VerifiedUser = { sub: string; scope: string }
type RouteEntry = { path: string; scopes: string[]; hasChildren: boolean }
type ResolvePayload = {
  sub: string
  scope: string
  roles: string[]
  accessExpiresAt: number
}

const routeEntries: RouteEntry[] = (() => {
  const routes = ROUTE_ACCESS.filter(item => item.type === 'route')
  return routes
    .map(r => ({
      path: r.path,
      scopes: r.scopes ?? [],
      hasChildren: routes.some(
        other => other.path.startsWith(r.path + '/') && other.path !== r.path,
      ),
    }))
    .sort((a, b) => b.path.length - a.path.length)
})()

const SECURITY_HEADERS: Record<string, string> = {
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
}

function applySecurityHeaders(res: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    res.headers.set(key, value)
  }
  return res
}

function buildRequestHeaders(req: NextRequest, refreshedCookies: string[]): Headers {
  if (refreshedCookies.length === 0) return req.headers
  const newHeaders = new Headers(req.headers)
  const existingCookies = req.headers.get('cookie') ?? ''
  const cookieMap = new Map<string, string>()
  existingCookies.split(';').forEach(c => {
    const [k, ...v] = c.trim().split('=')
    if (k?.trim()) cookieMap.set(k.trim(), v.join('='))
  })
  refreshedCookies
    .map(c => c.split(';')[0])
    .filter(Boolean)
    .forEach(pair => {
      const [k, ...v] = pair.split('=')
      if (k?.trim()) cookieMap.set(k.trim(), v.join('='))
    })
  newHeaders.set(
    'cookie',
    Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join('; '),
  )
  return newHeaders
}

function backendBase(): string {
  return process.env.BACKEND_INTERNAL_URL ?? 'http://localhost:3001'
}

function isPrefetchRequest(req: NextRequest): boolean {
  return (
    req.headers.get('next-router-prefetch') === '1' ||
    req.headers.get('purpose') === 'prefetch' ||
    req.headers.get('x-middleware-prefetch') === '1' ||
    req.headers.get('sec-purpose')?.includes('prefetch') === true
  )
}

async function resolveSession(cookie: string): Promise<ResolvePayload | null> {
  try {
    const res = await fetch(`${backendBase()}/api/auth/resolve`, {
      method: 'POST',
      headers: { Cookie: `session=${cookie}` },
    })
    if (!res.ok) return null
    return (await res.json()) as ResolvePayload
  } catch {
    return null
  }
}

async function rotate(
  cookie: string,
): Promise<{ setCookies: string[]; value: string } | null> {
  try {
    const res = await fetch(`${backendBase()}/api/auth/session`, {
      method: 'POST',
      headers: { Cookie: `session=${cookie}` },
    })
    if (!res.ok) return null
    const setCookies =
      typeof res.headers.getSetCookie === 'function'
        ? res.headers.getSetCookie()
        : res.headers.get('set-cookie')
          ? [res.headers.get('set-cookie') as string]
          : []
    const sc = setCookies.find(c => c.startsWith('session='))
    const value = sc?.split(';')[0]?.split('=').slice(1).join('=')
    return value ? { setCookies, value } : null
  } catch {
    return null
  }
}

export async function proxy(req: NextRequest) {
  const { pathname, origin } = req.nextUrl
  const isAuthRoute = AUTH_ROUTES.has(pathname)
  const isAppRoute = pathname === APP_PATH || pathname.startsWith(APP_PATH + '/')

  if (!isAuthRoute && !isAppRoute) {
    return applySecurityHeaders(NextResponse.next())
  }

  const sessionCookie = req.cookies.get('session')?.value ?? null
  const isPrefetch = isPrefetchRequest(req)
  let refreshedCookies: string[] = []
  let user: VerifiedUser | null = null

  if (sessionCookie) {
    let ctx = await resolveSession(sessionCookie)
    if (ctx) {
      const now = Math.floor(Date.now() / 1000)
      const needsRefresh =
        ctx.accessExpiresAt - now <= ACCESS_TOKEN_REFRESH_MARGIN_SECONDS
      if (needsRefresh && !isPrefetch) {
        const rotated = await rotate(sessionCookie)
        if (rotated) {
          refreshedCookies = rotated.setCookies
          ctx = await resolveSession(rotated.value)
        } else {
          ctx = null
        }
      }
    }
    if (ctx && ctx.sub && typeof ctx.scope === 'string') {
      user = { sub: ctx.sub, scope: ctx.scope }
    }
  }

  const finalize = (res: NextResponse): NextResponse => {
    for (const cookie of refreshedCookies) {
      res.headers.append('set-cookie', cookie)
    }
    return applySecurityHeaders(res)
  }
  const redirect = (path: string): NextResponse =>
    finalize(NextResponse.redirect(new URL(path, origin)))

  if (isAuthRoute) {
    if (user) return redirect(APP_PATH)
    return finalize(NextResponse.next())
  }
  if (!user) {
    const signinUrl = new URL(SIGNIN_PATH, origin)
    signinUrl.searchParams.set('next', pathname + req.nextUrl.search)
    const res = NextResponse.redirect(signinUrl)
    if (sessionCookie) res.cookies.delete('session')
    return applySecurityHeaders(res)
  }

  const { scope } = user
  const relativePath = pathname.slice(APP_PATH.length) || '/'
  const matchedRoute = routeEntries.find(
    r => relativePath === r.path || relativePath.startsWith(r.path + '/'),
  )
  if (!matchedRoute) return redirect('/404')
  if (!hasScope(scope, matchedRoute.scopes)) {
    return redirect('/403')
  }
  if (
    matchedRoute.hasChildren &&
    !routeEntries.some(
      r => r.path.startsWith(matchedRoute.path + '/') && hasScope(scope, r.scopes),
    )
  ) {
    return redirect('/403')
  }
  return finalize(
    NextResponse.next({
      request: { headers: buildRequestHeaders(req, refreshedCookies) },
    }),
  )
}

export const config = {
  matcher: ['/((?!_next|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|otf|map)$).*)'],
}