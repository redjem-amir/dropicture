// dropicture/app/frontend/src/app/signup/page.tsx
'use client'

import Link from 'next/link'
import { use, useState, type FormEvent } from 'react'

const ERROR_MESSAGES: Record<string, string> = {
  MISSING_FIELDS: 'Please fill in all fields.',
  INVALID_NAME: 'Names can use letters, spaces, apostrophes and hyphens (2–30 characters).',
  EMAIL_INVALID: 'Please enter a valid email address.',
  EMAIL_ALREADY_USED: 'An account with this email already exists.',
  PASSWORD_TOO_SHORT: 'Password must be at least 8 characters.',
  PASSWORD_TOO_LONG: 'Password must be at most 128 characters.',
  PASSWORD_MISSING_UPPERCASE: 'Password needs at least one uppercase letter.',
  PASSWORD_MISSING_LOWERCASE: 'Password needs at least one lowercase letter.',
  PASSWORD_MISSING_NUMBER: 'Password needs at least one number.',
  PASSWORD_MISSING_SPECIAL: 'Password needs at least one special character.',
  TOO_MANY_EMAILS: 'Too many attempts for this email. Try again in a few minutes.',
  RATE_LIMITED: 'Too many attempts. Please wait a bit and try again.',
  UNKNOWN: 'Something went wrong. Please try again.',
}

const CODE_TO_STEP: Record<string, 1 | 2 | 3> = {
  MISSING_FIELDS: 1,
  INVALID_NAME: 1,
  EMAIL_INVALID: 2,
  EMAIL_ALREADY_USED: 2,
  PASSWORD_TOO_SHORT: 3,
  PASSWORD_TOO_LONG: 3,
  PASSWORD_MISSING_UPPERCASE: 3,
  PASSWORD_MISSING_LOWERCASE: 3,
  PASSWORD_MISSING_NUMBER: 3,
  PASSWORD_MISSING_SPECIAL: 3,
}

const NAME_REGEX = /^[a-zA-ZÀ-ÿ\s'-]+$/
const PASSWORD_RULES: { label: string; test: (p: string) => boolean }[] = [
  { label: 'At least 8 characters', test: p => p.length >= 8 },
  { label: 'One uppercase letter', test: p => /[A-Z]/.test(p) },
  { label: 'One lowercase letter', test: p => /[a-z]/.test(p) },
  { label: 'One number', test: p => /[0-9]/.test(p) },
  { label: 'One special character', test: p => /[^A-Za-z0-9]/.test(p) },
]

const STEP_CAPTIONS = ['Your profile', 'Your email', 'Secure your account']

const inputClass =
  'h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm ' +
  'text-stone-900 placeholder:text-stone-400 outline-none transition ' +
  'focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 disabled:opacity-60'

function safeNext(value: string | string[] | undefined): string {
  const next = Array.isArray(value) ? value[0] : value
  return next && /^\/(?!\/)/.test(next) ? next : '/auth'
}

export default function SignupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = use(searchParams)
  const next = safeNext(params.next)
  const signinHref = next !== '/auth' ? `/signin?next=${encodeURIComponent(next)}` : '/signin'

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [done, setDone] = useState(false)
  const [firstname, setFirstname] = useState('')
  const [lastname, setLastname] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function validateStep(s: 1 | 2 | 3): string | null {
    if (s === 1) {
      const f = firstname.trim()
      const l = lastname.trim()
      if (!f || !l) return ERROR_MESSAGES.MISSING_FIELDS
      const valid = (v: string) => v.length >= 2 && v.length <= 30 && NAME_REGEX.test(v)
      if (!valid(f) || !valid(l)) return ERROR_MESSAGES.INVALID_NAME
    }
    if (s === 2 && !/^\S+@\S+\.\S+$/.test(email.trim())) {
      return ERROR_MESSAGES.EMAIL_INVALID
    }
    if (s === 3 && !PASSWORD_RULES.every(r => r.test(password))) {
      return "Your password doesn't meet all the requirements below."
    }
    return null
  }

  function goBack() {
    setError(null)
    setStep(s => (s > 1 ? ((s - 1) as 1 | 2) : s))
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (loading) return
    setError(null)

    const invalid = validateStep(step)
    if (invalid) {
      setError(invalid)
      return
    }
    if (step < 3) {
      setStep((step + 1) as 2 | 3)
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstname: firstname.trim(),
          lastname: lastname.trim(),
          email: email.trim(),
          password,
        }),
      })
      if (res.ok) {
        setLoading(false)
        setDone(true)
        return
      }
      const data = await res.json().catch(() => null)
      const code =
        data?.code ?? (Array.isArray(data?.message) ? data.message[0] : data?.message)
      if (res.status === 429) {
        setError(
          code === 'TOO_MANY_EMAILS' ? ERROR_MESSAGES.TOO_MANY_EMAILS : ERROR_MESSAGES.RATE_LIMITED,
        )
      } else {
        setError(ERROR_MESSAGES[code] ?? ERROR_MESSAGES.UNKNOWN)
        const target = CODE_TO_STEP[code]
        if (target) setStep(target)
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
          <div className="rounded-2xl border border-stone-200/70 bg-white p-8 shadow-xl shadow-stone-900/4">
            {done ? (
              <div data-anim style={{ animation: 'dpPop 0.3s ease-out' }} className="text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-stone-200 bg-white text-emerald-600 shadow-sm">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-6" aria-hidden="true">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </div>
                <h1 className="mt-5 text-2xl font-semibold tracking-tight text-stone-900">
                  You&apos;re all set
                </h1>
                <p className="mt-3 text-sm text-stone-500">
                  Your account has been created. Sign in to start uploading your photos.
                </p>
                <Link
                  href={signinHref}
                  className="mt-6 inline-flex h-10 w-full items-center justify-center rounded-full bg-stone-900 text-sm font-medium text-white shadow-sm transition-colors hover:bg-stone-700"
                >
                  Continue to sign in
                </Link>
              </div>
            ) : (
              <>
                <div className="flex justify-center">
                  <Link
                    href="/"
                    aria-label="Dropicture home"
                    className="text-stone-900 transition-opacity hover:opacity-80"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-7" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M14.31 8l5.74 9.94M9.69 8h11.48M7.38 12l5.74-9.94M9.69 16L3.95 6.06M14.31 16H2.83M16.62 12l-5.74 9.94" />
                    </svg>
                  </Link>
                </div>
                <h1 className="mt-5 text-center text-2xl font-semibold tracking-tight text-stone-900">
                  Create your account
                </h1>
                <p className="mt-2 text-center text-sm text-stone-500">
                  Free, open source, and yours.
                </p>
                <ol aria-label="Progress" className="mx-auto mt-6 flex w-full max-w-60 items-center">
                  {([1, 2, 3] as const).map(id => {
                    const isDone = step > id
                    const isCurrent = step === id
                    return (
                      <li key={id} className={id < 3 ? 'flex flex-1 items-center' : 'flex items-center'}>
                        <span
                          className={
                            'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ' +
                            (isDone
                              ? 'bg-stone-900 text-white'
                              : isCurrent
                                ? 'border-2 border-stone-900 bg-white text-stone-900'
                                : 'border border-stone-200 bg-white text-stone-400')
                          }
                        >
                          {isDone ? (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="size-3.5" aria-hidden="true">
                              <path d="M20 6 9 17l-5-5" />
                            </svg>
                          ) : (
                            id
                          )}
                        </span>
                        {id < 3 && (
                          <span
                            className={
                              'mx-2 h-px flex-1 rounded-full transition-colors ' +
                              (step > id ? 'bg-stone-900' : 'bg-stone-200')
                            }
                          />
                        )}
                      </li>
                    )
                  })}
                </ol>
                <p className="mt-3 text-center font-mono text-[11px] font-medium uppercase tracking-widest text-stone-400">
                  Step {step} of 3 · {STEP_CAPTIONS[step - 1]}
                </p>
                <form onSubmit={onSubmit} className="mt-6 space-y-4">
                  {error && (
                    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600">
                      {error}
                    </div>
                  )}
                  <div key={step} data-anim style={{ animation: 'dpStepIn 0.25s ease-out' }} className="space-y-4">
                    {step === 1 && (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-3">
                        <div className="space-y-1.5">
                          <label htmlFor="firstname" className="block text-sm font-medium text-stone-700">
                            First name
                          </label>
                          <input
                            id="firstname"
                            type="text"
                            autoComplete="given-name"
                            autoFocus
                            required
                            maxLength={30}
                            placeholder="Ada"
                            value={firstname}
                            onChange={e => setFirstname(e.target.value)}
                            disabled={loading}
                            className={inputClass}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label htmlFor="lastname" className="block text-sm font-medium text-stone-700">
                            Last name
                          </label>
                          <input
                            id="lastname"
                            type="text"
                            autoComplete="family-name"
                            required
                            maxLength={30}
                            placeholder="Lovelace"
                            value={lastname}
                            onChange={e => setLastname(e.target.value)}
                            disabled={loading}
                            className={inputClass}
                          />
                        </div>
                      </div>
                    )}
                    {step === 2 && (
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
                          className={inputClass}
                        />
                        <p className="pt-0.5 text-xs text-stone-400">
                          We never share your email. No newsletter, no tracking.
                        </p>
                      </div>
                    )}
                    {step === 3 && (
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <label htmlFor="password" className="block text-sm font-medium text-stone-700">
                            Password
                          </label>
                          <div className="relative">
                            <input
                              id="password"
                              type={showPassword ? 'text' : 'password'}
                              autoComplete="new-password"
                              autoFocus
                              required
                              maxLength={128}
                              placeholder="••••••••"
                              value={password}
                              onChange={e => setPassword(e.target.value)}
                              disabled={loading}
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
                        <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                          {PASSWORD_RULES.map(rule => {
                            const ok = rule.test(password)
                            return (
                              <li
                                key={rule.label}
                                className={`flex items-center gap-1.5 text-xs transition ${ok ? 'text-emerald-600' : 'text-stone-400'}`}
                              >
                                {ok ? (
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-3.5 shrink-0" aria-hidden="true">
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="m9 12 2 2 4-4" />
                                  </svg>
                                ) : (
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5 shrink-0" aria-hidden="true">
                                    <circle cx="12" cy="12" r="10" />
                                  </svg>
                                )}
                                {rule.label}
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-3 pt-1">
                    {step > 1 && (
                      <button
                        type="button"
                        onClick={goBack}
                        disabled={loading}
                        className="inline-flex h-10 items-center justify-center rounded-full border border-stone-200 bg-white px-4 text-sm font-medium text-stone-700 shadow-sm transition-colors hover:border-stone-300 hover:text-stone-900 disabled:pointer-events-none disabled:opacity-60"
                      >
                        Back
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-stone-900 text-sm font-medium text-white shadow-sm transition-colors hover:bg-stone-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 disabled:pointer-events-none disabled:opacity-60"
                    >
                      {loading && (
                        <svg viewBox="0 0 24 24" fill="none" className="size-4 animate-spin" aria-hidden="true">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
                          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                        </svg>
                      )}
                      {step < 3 ? 'Continue' : loading ? 'Creating account…' : 'Create account'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
          {!done && (
            <p className="mt-6 text-center text-sm text-stone-500">
              Already have an account?{' '}
              <Link href={signinHref} className="font-medium text-stone-900 underline-offset-4 hover:underline">
                Sign in
              </Link>
            </p>
          )}
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