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
    'h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm ' +
    'text-stone-900 placeholder:text-stone-400 outline-none transition ' +
    'focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 disabled:opacity-60'

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
        <main className="relative flex min-h-dvh flex-col overflow-hidden bg-white">
            <div aria-hidden className="pointer-events-none absolute inset-0 select-none overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-120 bg-[linear-gradient(to_right,rgba(28,25,23,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(28,25,23,0.05)_1px,transparent_1px)] bg-size-[56px_56px] mask-[radial-gradient(ellipse_75%_65%_at_50%_0%,#000_50%,transparent_100%)]" />
                <div className="absolute left-1/2 -top-55 h-110 w-170 -translate-x-1/2 rounded-full bg-amber-100/50 blur-3xl" />
            </div>
            <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-12">
                <div className="w-full max-w-sm">
                    <SessionExpired className="mb-4" />
                    <div className="rounded-2xl border border-stone-200/70 bg-white p-8 shadow-xl shadow-stone-900/4">
                        <div className="flex justify-center">
                            <Link
                                href="/"
                                aria-label="Dropicture home"
                                className="text-stone-900 transition-opacity hover:opacity-80"
                            >
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="size-7"
                                    aria-hidden="true"
                                >
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="M14.31 8l5.74 9.94M9.69 8h11.48M7.38 12l5.74-9.94M9.69 16L3.95 6.06M14.31 16H2.83M16.62 12l-5.74 9.94" />
                                </svg>
                            </Link>
                        </div>
                        <h1 className="mt-5 text-center text-2xl font-semibold tracking-tight text-stone-900">
                            Welcome back
                        </h1>
                        <p className="mt-2 text-center text-sm text-stone-500">
                            Your photos, on your terms.
                        </p>
                        <form onSubmit={onSubmit} className="mt-7 space-y-4">
                            {error && (
                                <div
                                    role="alert"
                                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600"
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
                                        className="text-sm text-stone-500 underline-offset-4 transition-colors hover:text-stone-900 hover:underline"
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
                                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-stone-900 text-sm font-medium text-white shadow-sm transition-colors hover:bg-stone-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 disabled:pointer-events-none disabled:opacity-60"
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
                <Link href="/terms" className="text-xs text-stone-500 transition-colors hover:text-stone-900">
                    Terms
                </Link>
                <Link href="/privacy" className="text-xs text-stone-500 transition-colors hover:text-stone-900">
                    Privacy
                </Link>
                <Link
                    href="https://github.com/redjem-amir/dropicture"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-stone-500 transition-colors hover:text-stone-900"
                >
                    GitHub
                </Link>
            </footer>
        </main>
    )
}