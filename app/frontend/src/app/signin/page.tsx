// dropicture/app/frontend/src/app/signin/page.tsx
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { use, useState, type FormEvent } from 'react'
import { SessionExpired } from '@/components/SessionExpired'

const ERROR_MESSAGES: Record<string, string> = {
    MISSING_CREDENTIALS: 'Please enter your email and password.',
    EMAIL_INVALID: 'Please enter a valid email address.',
    INVALID_CREDENTIALS: 'Incorrect email or password.',
    ACCOUNT_PENDING: 'Your account is awaiting activation.',
    ACCOUNT_SUSPENDED: 'Your account has been suspended.',
    ACCOUNT_BANNED: 'Your account has been banned.',
    RATE_LIMITED: 'Too many attempts. Please wait a minute and try again.',
    UNKNOWN: 'Something went wrong. Please try again.',
}

const inputClass =
    'h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm ' +
    'text-stone-900 placeholder:text-stone-400 outline-none transition ' +
    'focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10'

const SPARKLE =
    'M12 0c.9 6.1 5 10.2 11.9 12-6.9 1.8-11 5.9-11.9 12-.9-6.1-5-10.2-11.9-12C7 10.2 11.1 6.1 12 0Z'

function safeNext(value: string | string[] | undefined): string {
    const next = Array.isArray(value) ? value[0] : value
    return next && /^\/(?!\/)/.test(next) ? next : '/auth'
}

export default function SigninPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
    const params = use(searchParams)
    const next = safeNext(params.next)
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function onSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault()
        if (loading) return
        setError(null)
        setLoading(true)
        try {
            const res = await fetch('/api/auth/signin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            })
            if (res.ok) {
                router.replace(next)
                router.refresh()
                return
            }
            if (res.status === 429) {
                setError(ERROR_MESSAGES.RATE_LIMITED)
            } else {
                const data = await res.json().catch(() => null)
                const code =
                    data?.code ??
                    (Array.isArray(data?.message) ? data.message[0] : data?.message)
                setError(ERROR_MESSAGES[code] ?? ERROR_MESSAGES.UNKNOWN)
            }
        } catch {
            setError(ERROR_MESSAGES.UNKNOWN)
        }
        setLoading(false)
    }

    return (
        <main className="relative flex min-h-dvh flex-col overflow-hidden bg-stone-50">
            <div aria-hidden className="pointer-events-none absolute inset-0 select-none">
                <svg className="absolute inset-0 h-full w-full text-stone-300 mask-[radial-gradient(ellipse_at_center,black_30%,transparent_75%)]">
                    <defs>
                        <pattern id="dots" width="26" height="26" patternUnits="userSpaceOnUse">
                            <circle cx="1.5" cy="1.5" r="1.5" fill="currentColor" />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#dots)" />
                </svg>
                <div className="absolute -left-40 -top-40 size-120 rounded-full bg-linear-to-br from-amber-200 via-orange-100 to-transparent opacity-70 blur-3xl" />
                <div className="absolute -bottom-48 -right-32 size-136 rounded-full bg-linear-to-tr from-violet-200 via-fuchsia-100 to-transparent opacity-70 blur-3xl" />
                <svg
                    viewBox="0 0 150 180"
                    className="absolute left-[4%] top-[16%] hidden w-36 -rotate-6 drop-shadow-[0_16px_32px_rgba(0,0,0,0.10)] lg:block xl:w-44"
                >
                    <defs>
                        <linearGradient id="pl1" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#FFEDD5" />
                            <stop offset="100%" stopColor="#FED7AA" />
                        </linearGradient>
                    </defs>
                    <rect x="0.5" y="0.5" width="149" height="179" rx="14" fill="#fff" stroke="#E7E5E4" />
                    <rect x="12" y="12" width="126" height="126" rx="10" fill="url(#pl1)" />
                    <circle cx="103" cy="48" r="14" fill="#FBBF24" />
                    <path d="M12 138 L50 84 L76 114 L100 88 L138 138 Z" fill="#FDBA74" />
                    <path d="M12 138 L42 100 L70 138 Z" fill="#FB923C" />
                    <rect x="12" y="150" width="72" height="8" rx="4" fill="#E7E5E4" />
                </svg>
                <svg
                    viewBox="0 0 150 180"
                    className="absolute bottom-[14%] right-[4%] hidden w-36 rotate-[8deg] drop-shadow-[0_16px_32px_rgba(0,0,0,0.10)] lg:block xl:w-44"
                >
                    <defs>
                        <linearGradient id="pl2" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#EDE9FE" />
                            <stop offset="100%" stopColor="#DDD6FE" />
                        </linearGradient>
                    </defs>
                    <rect x="0.5" y="0.5" width="149" height="179" rx="14" fill="#fff" stroke="#E7E5E4" />
                    <rect x="12" y="12" width="126" height="126" rx="10" fill="url(#pl2)" />
                    <circle cx="52" cy="50" r="12" fill="#A78BFA" />
                    <path d="M12 100 Q 40 92 75 100 T 138 100 V 138 H 12 Z" fill="#C4B5FD" />
                    <path d="M30 116 q 6 -4 12 0 M58 122 q 6 -4 12 0 M92 116 q 6 -4 12 0" stroke="#8B5CF6" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.5" />
                    <rect x="12" y="150" width="58" height="8" rx="4" fill="#E7E5E4" />
                </svg>
                <svg viewBox="0 0 24 24" className="absolute left-[22%] top-[12%] hidden size-5 text-amber-400 md:block">
                    <path d={SPARKLE} fill="currentColor" />
                </svg>
                <svg viewBox="0 0 24 24" className="absolute bottom-[22%] left-[12%] hidden size-3.5 text-violet-400 md:block">
                    <path d={SPARKLE} fill="currentColor" />
                </svg>
                <svg viewBox="0 0 24 24" className="absolute right-[20%] top-[20%] hidden size-4 animate-pulse text-orange-400 md:block">
                    <path d={SPARKLE} fill="currentColor" />
                </svg>
            </div>
            <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-12">
                <div className="relative w-full max-w-sm">
                    <svg aria-hidden viewBox="0 0 24 24" className="absolute -right-4 -top-5 size-7 text-amber-400">
                        <path d={SPARKLE} fill="currentColor" />
                    </svg>
                    <svg aria-hidden viewBox="0 0 24 24" className="absolute -bottom-4 -left-6 size-5 animate-pulse text-violet-400">
                        <path d={SPARKLE} fill="currentColor" />
                    </svg>
                    <SessionExpired className="mb-4" />
                    <div className="rounded-3xl border border-stone-200/80 bg-white/80 p-8 shadow-[0_8px_40px_-12px_rgba(28,25,23,0.12)] backdrop-blur-sm">
                        <div className="flex justify-center">
                            <Link
                                href="/"
                                className="flex size-12 items-center justify-center rounded-2xl bg-linear-to-br from-amber-400 to-orange-500 text-white shadow-[0_8px_20px_-6px_rgba(249,115,22,0.5)]"
                                aria-label="Dropicture home"
                            >
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="size-6"
                                    aria-hidden="true"
                                >
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="M14.31 8l5.74 9.94M9.69 8h11.48M7.38 12l5.74-9.94M9.69 16L3.95 6.06M14.31 16H2.83M16.62 12l-5.74 9.94" />
                                </svg>
                            </Link>
                        </div>
                        <div className="mt-5 flex justify-center">
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-500">
                                <svg viewBox="0 0 24 24" className="size-3 text-amber-500" aria-hidden="true">
                                    <path d={SPARKLE} fill="currentColor" />
                                </svg>
                                Open source · Hosted in Europe
                            </span>
                        </div>
                        <h1 className="mt-4 text-center text-2xl font-semibold tracking-tight text-stone-900">
                            Welcome back
                        </h1>
                        <svg aria-hidden viewBox="0 0 120 12" className="mx-auto mt-1 h-3 w-28 text-amber-400">
                            <path
                                d="M3 8 C 22 3, 42 10, 62 6 S 100 4, 117 7"
                                stroke="currentColor"
                                strokeWidth="3"
                                strokeLinecap="round"
                                fill="none"
                            />
                        </svg>
                        <p className="mt-2 text-center text-sm text-stone-500">
                            Your photos, on your terms.
                        </p>
                        <form onSubmit={onSubmit} className="mt-7 space-y-4">
                            {error && (
                                <div
                                    role="alert"
                                    className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600"
                                >
                                    {error}
                                </div>
                            )}
                            <div className="space-y-1.5">
                                <label htmlFor="email" className="block text-sm font-medium text-stone-700">
                                    Email
                                </label>
                                <input
                                    id="email"
                                    type="email"
                                    autoComplete="email"
                                    autoFocus
                                    required
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    disabled={loading}
                                    aria-invalid={!!error}
                                    className={inputClass}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label htmlFor="password" className="block text-sm font-medium text-stone-700">
                                        Password
                                    </label>
                                    <Link
                                        href="/reset-password"
                                        tabIndex={-1}
                                        className="text-sm text-stone-400 underline-offset-4 hover:text-stone-700 hover:underline"
                                    >
                                        Forgot password?
                                    </Link>
                                </div>
                                <div className="relative">
                                    <input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        autoComplete="current-password"
                                        required
                                        maxLength={128}
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        disabled={loading}
                                        aria-invalid={!!error}
                                        className={`${inputClass} pr-10`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(v => !v)}
                                        tabIndex={-1}
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-stone-400 transition hover:text-stone-600"
                                    >
                                        {showPassword ? (
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true">
                                                <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                                                <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                                                <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                                                <line x1="2" x2="22" y1="2" y2="22" />
                                            </svg>
                                        ) : (
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true">
                                                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                                                <circle cx="12" cy="12" r="3" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-stone-900 text-sm font-medium text-white transition hover:bg-stone-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 disabled:pointer-events-none disabled:opacity-60"
                            >
                                {loading && (
                                    <svg viewBox="0 0 24 24" fill="none" className="size-4 animate-spin" aria-hidden="true">
                                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
                                        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                                    </svg>
                                )}
                                {loading ? 'Signing in…' : 'Sign in'}
                            </button>
                        </form>
                    </div>
                    <p className="mt-6 text-center text-sm text-stone-500">
                        No account?{' '}
                        <Link
                            href="/signup"
                            className="font-medium text-stone-900 underline-offset-4 hover:underline"
                        >
                            Create one
                        </Link>
                    </p>
                </div>
            </div>
            <footer className="relative z-10 flex items-center justify-center gap-6 px-4 py-6">
                <Link href="/terms" className="text-xs text-stone-400 transition hover:text-stone-600">
                    Terms
                </Link>
                <Link href="/privacy" className="text-xs text-stone-400 transition hover:text-stone-600">
                    Privacy
                </Link>
                <Link
                    href="https://github.com/redjem-amir/dropicture"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-stone-400 transition hover:text-stone-600"
                >
                    GitHub
                </Link>
            </footer>
        </main>
    )
}