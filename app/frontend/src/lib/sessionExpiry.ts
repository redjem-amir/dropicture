// dropicture/app/frontend/src/lib/sessionExpiry.ts
const RETURN_TO_KEY = 'dropicture:returnTo'
const REASON_PARAM = 'reason'
const SIGNIN_PATH = '/signin'
const APP_PATH = '/auth'

export const SESSION_EXPIRED_REASONS = {
    EXPIRED: 'session_expired',
    REVOKED: 'session_revoked',
    SIGNED_OUT: 'signed_out',
} as const

export type SessionExpiredReason =
    (typeof SESSION_EXPIRED_REASONS)[keyof typeof SESSION_EXPIRED_REASONS]

const SAFE_PATH_REGEX = /^\/(?!\/)[A-Za-z0-9\-_/?=&%.~+]*$/

export function saveReturnTo(): void {
    if (typeof window === 'undefined') return
    const path = window.location.pathname + window.location.search
    if (
        path === '/' ||
        path.startsWith('/?') ||
        path.startsWith('/signup') ||
        path.startsWith('/signin')
    ) return
    if (!SAFE_PATH_REGEX.test(path)) return
    try {
        sessionStorage.setItem(RETURN_TO_KEY, path)
    } catch {
        // ignore silencieusement
    }
}

export function consumeReturnTo(): string | null {
    if (typeof window === 'undefined') return null
    try {
        const value = sessionStorage.getItem(RETURN_TO_KEY)
        sessionStorage.removeItem(RETURN_TO_KEY)
        if (!value || !SAFE_PATH_REGEX.test(value)) return null
        return value
    } catch {
        return null
    }
}

export function redirectToLoginExpired(
    reason: SessionExpiredReason = SESSION_EXPIRED_REASONS.EXPIRED,
): void {
    if (typeof window === 'undefined') return
    const url = new URL(SIGNIN_PATH, window.location.origin)
    url.searchParams.set(REASON_PARAM, reason)
    const path = window.location.pathname + window.location.search
    const isProtected =
        window.location.pathname === APP_PATH ||
        window.location.pathname.startsWith(APP_PATH + '/')
    if (isProtected && SAFE_PATH_REGEX.test(path)) {
        url.searchParams.set('next', path)
    }
    window.location.replace(url.toString())
}

export function readSessionExpiredReason(): SessionExpiredReason | null {
    if (typeof window === 'undefined') return null
    const value = new URLSearchParams(window.location.search).get(REASON_PARAM)
    if (
        value === SESSION_EXPIRED_REASONS.EXPIRED ||
        value === SESSION_EXPIRED_REASONS.REVOKED ||
        value === SESSION_EXPIRED_REASONS.SIGNED_OUT
    ) {
        return value
    }
    return null
}

export function clearReasonParam(): void {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    if (!url.searchParams.has(REASON_PARAM)) return
    url.searchParams.delete(REASON_PARAM)
    window.history.replaceState(null, '', url.toString())
}