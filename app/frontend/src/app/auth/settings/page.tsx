// dropicture/app/frontend/src/app/auth/settings/page.tsx
'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/components/UserProvider'

const API = {
  profile: '/api/settings/profile',
  email: '/api/settings/email',
  password: '/api/settings/password',
  account: '/api/settings/account',
}

const ERROR_MESSAGES: Record<string, string> = {
  MISSING_FIELDS: 'Please fill in all fields.',
  INVALID_NAME: 'Names can use letters, spaces, apostrophes and hyphens (2–30 characters).',
  EMAIL_INVALID: 'Please enter a valid email address.',
  EMAIL_ALREADY_USED: 'An account with this email already exists.',
  INVALID_CREDENTIALS: 'Incorrect password.',
  PASSWORD_TOO_SHORT: 'Password must be at least 8 characters.',
  PASSWORD_TOO_LONG: 'Password must be at most 128 characters.',
  PASSWORD_MISSING_UPPERCASE: 'Password needs at least one uppercase letter.',
  PASSWORD_MISSING_LOWERCASE: 'Password needs at least one lowercase letter.',
  PASSWORD_MISSING_NUMBER: 'Password needs at least one number.',
  PASSWORD_MISSING_SPECIAL: 'Password needs at least one special character.',
  RATE_LIMITED: 'Too many attempts. Please wait a bit and try again.',
  UNKNOWN: 'Something went wrong. Please try again.',
}

const NAME_REGEX = /^[a-zA-ZÀ-ÿ\s'-]+$/
const PASSWORD_RULES: { label: string; test: (p: string) => boolean }[] = [
  { label: 'At least 8 characters', test: p => p.length >= 8 },
  { label: 'One uppercase letter', test: p => /[A-Z]/.test(p) },
  { label: 'One lowercase letter', test: p => /[a-z]/.test(p) },
  { label: 'One number', test: p => /[0-9]/.test(p) },
  { label: 'One special character', test: p => /[^A-Za-z0-9]/.test(p) },
]

const inputClass =
  'h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm ' +
  'text-stone-900 placeholder:text-stone-400 outline-none transition ' +
  'focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 disabled:opacity-60'

const BTN_PRIMARY =
  'inline-flex h-9 items-center justify-center gap-2 rounded-full bg-stone-900 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-stone-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 disabled:pointer-events-none disabled:opacity-60'
const BTN_DANGER =
  'inline-flex h-9 items-center justify-center gap-2 rounded-full bg-red-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:pointer-events-none disabled:opacity-60'

const SPINNER = (
  <svg viewBox="0 0 24 24" fill="none" className="size-4 animate-spin" aria-hidden="true">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
)
const SAVED = (
  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-3.5" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
    Saved
  </span>
)

type Status =
  | { state: 'idle' }
  | { state: 'saving' }
  | { state: 'saved' }
  | { state: 'error'; message: string }
const IDLE: Status = { state: 'idle' }

async function sendJson(
  url: string,
  method: string,
  body: unknown,
): Promise<{ ok: true } | { ok: false; status: number; code?: string }> {
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) return { ok: true }
    const data = await res.json().catch(() => null)
    const code = data?.code ?? (Array.isArray(data?.message) ? data.message[0] : data?.message)
    return { ok: false, status: res.status, code }
  } catch {
    return { ok: false, status: 0 }
  }
}

function errorFor(r: { status: number; code?: string }): string {
  if (r.status === 429) return ERROR_MESSAGES.RATE_LIMITED
  return ERROR_MESSAGES[r.code ?? ''] ?? ERROR_MESSAGES.UNKNOWN
}

export default function SettingsPage() {
  const router = useRouter()
  const { user, isLoading, logout } = useUser()

  const [firstname, setFirstname] = useState('')
  const [lastname, setLastname] = useState('')
  const [profileStatus, setProfileStatus] = useState<Status>(IDLE)

  const [email, setEmail] = useState('')
  const [emailStatus, setEmailStatus] = useState<Status>(IDLE)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [passwordStatus, setPasswordStatus] = useState<Status>(IDLE)

  const [deletePassword, setDeletePassword] = useState('')
  const [deleteStatus, setDeleteStatus] = useState<Status>(IDLE)

  useEffect(() => {
    if (!user) return
    setFirstname(user.firstname ?? '')
    setLastname(user.lastname ?? '')
    setEmail(user.email ?? '')
  }, [user])

  const profileDirty =
    !!user && (firstname.trim() !== (user.firstname ?? '') || lastname.trim() !== (user.lastname ?? ''))
  const emailDirty = !!user && email.trim() !== (user.email ?? '')
  const passwordReady = currentPassword.length > 0 && PASSWORD_RULES.every(r => r.test(newPassword))

  async function onProfileSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (profileStatus.state === 'saving') return
    const f = firstname.trim()
    const l = lastname.trim()
    if (!f || !l) {
      setProfileStatus({ state: 'error', message: ERROR_MESSAGES.MISSING_FIELDS })
      return
    }
    const valid = (v: string) => v.length >= 2 && v.length <= 30 && NAME_REGEX.test(v)
    if (!valid(f) || !valid(l)) {
      setProfileStatus({ state: 'error', message: ERROR_MESSAGES.INVALID_NAME })
      return
    }
    setProfileStatus({ state: 'saving' })
    const r = await sendJson(API.profile, 'PATCH', { firstname: f, lastname: l })
    if (r.ok) {
      setProfileStatus({ state: 'saved' })
      router.refresh()
    } else {
      setProfileStatus({ state: 'error', message: errorFor(r) })
    }
  }

  async function onEmailSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (emailStatus.state === 'saving') return
    const value = email.trim()
    if (!/^\S+@\S+\.\S+$/.test(value)) {
      setEmailStatus({ state: 'error', message: ERROR_MESSAGES.EMAIL_INVALID })
      return
    }
    setEmailStatus({ state: 'saving' })
    const r = await sendJson(API.email, 'PATCH', { email: value })
    if (r.ok) {
      setEmailStatus({ state: 'saved' })
      router.refresh()
    } else {
      setEmailStatus({ state: 'error', message: errorFor(r) })
    }
  }

  async function onPasswordSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (passwordStatus.state === 'saving') return
    if (!PASSWORD_RULES.every(r => r.test(newPassword))) {
      setPasswordStatus({
        state: 'error',
        message: "Your new password doesn't meet all the requirements below.",
      })
      return
    }
    setPasswordStatus({ state: 'saving' })
    const r = await sendJson(API.password, 'PATCH', { currentPassword, newPassword })
    if (r.ok) {
      setPasswordStatus({ state: 'saved' })
      setCurrentPassword('')
      setNewPassword('')
    } else {
      setPasswordStatus({ state: 'error', message: errorFor(r) })
    }
  }

  async function onDeleteSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (deleteStatus.state === 'saving') return
    setDeleteStatus({ state: 'saving' })
    const r = await sendJson(API.account, 'DELETE', { password: deletePassword })
    if (r.ok) {
      logout()
    } else {
      setDeleteStatus({ state: 'error', message: errorFor(r) })
    }
  }

  if (isLoading && !user) {
    return (
      <div className="mx-auto w-full max-w-2xl" aria-hidden>
        <div className="h-7 w-48 animate-pulse rounded bg-stone-100" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded bg-stone-100" />
        <div className="mt-8 space-y-6">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-44 animate-pulse rounded-2xl bg-stone-100" />
          ))}
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="mx-auto w-full max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Account settings</h1>
      <p className="mt-1 text-sm text-stone-500">Your profile, sign-in details and account controls.</p>
      <div className="mt-8 space-y-6">
        <form onSubmit={onProfileSubmit} className="overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-sm">
          <div className="p-6">
            <h2 className="text-base font-semibold tracking-tight text-stone-900">Profile</h2>
            <p className="mt-1 text-sm text-stone-500">The name shown on your account.</p>
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-3">
              <div className="space-y-1.5">
                <label htmlFor="firstname" className="block text-sm font-medium text-stone-700">First name</label>
                <input
                  id="firstname"
                  type="text"
                  autoComplete="given-name"
                  required
                  maxLength={30}
                  value={firstname}
                  onChange={e => { setFirstname(e.target.value); setProfileStatus(IDLE) }}
                  disabled={profileStatus.state === 'saving'}
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="lastname" className="block text-sm font-medium text-stone-700">Last name</label>
                <input
                  id="lastname"
                  type="text"
                  autoComplete="family-name"
                  required
                  maxLength={30}
                  value={lastname}
                  onChange={e => { setLastname(e.target.value); setProfileStatus(IDLE) }}
                  disabled={profileStatus.state === 'saving'}
                  className={inputClass}
                />
              </div>
            </div>
            {profileStatus.state === 'error' && (
              <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600">
                {profileStatus.message}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-stone-200/70 bg-stone-50/60 px-6 py-3">
            <p className="text-xs text-stone-400">2–30 characters. Letters, spaces, apostrophes and hyphens.</p>
            <div className="flex shrink-0 items-center gap-3">
              {profileStatus.state === 'saved' && SAVED}
              <button type="submit" disabled={!profileDirty || profileStatus.state === 'saving'} className={BTN_PRIMARY}>
                {profileStatus.state === 'saving' && SPINNER}
                Save
              </button>
            </div>
          </div>
        </form>
        <form onSubmit={onEmailSubmit} className="overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-sm">
          <div className="p-6">
            <h2 className="text-base font-semibold tracking-tight text-stone-900">Email</h2>
            <p className="mt-1 text-sm text-stone-500">The address you use to sign in.</p>
            <div className="mt-5 space-y-1.5">
              <label htmlFor="email" className="block text-sm font-medium text-stone-700">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => { setEmail(e.target.value); setEmailStatus(IDLE) }}
                disabled={emailStatus.state === 'saving'}
                className={inputClass}
              />
            </div>
            {emailStatus.state === 'error' && (
              <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600">
                {emailStatus.message}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-stone-200/70 bg-stone-50/60 px-6 py-3">
            <p className="text-xs text-stone-400">We never share your email. No newsletter, no tracking.</p>
            <div className="flex shrink-0 items-center gap-3">
              {emailStatus.state === 'saved' && SAVED}
              <button type="submit" disabled={!emailDirty || emailStatus.state === 'saving'} className={BTN_PRIMARY}>
                {emailStatus.state === 'saving' && SPINNER}
                Save
              </button>
            </div>
          </div>
        </form>
        <form onSubmit={onPasswordSubmit} className="overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-sm">
          <div className="p-6">
            <h2 className="text-base font-semibold tracking-tight text-stone-900">Password</h2>
            <p className="mt-1 text-sm text-stone-500">Use your current password to set a new one.</p>
            <div className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="current-password" className="block text-sm font-medium text-stone-700">Current password</label>
                <input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  maxLength={128}
                  placeholder="••••••••"
                  value={currentPassword}
                  onChange={e => { setCurrentPassword(e.target.value); setPasswordStatus(IDLE) }}
                  disabled={passwordStatus.state === 'saving'}
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="new-password" className="block text-sm font-medium text-stone-700">New password</label>
                <div className="relative">
                  <input
                    id="new-password"
                    type={showNewPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    maxLength={128}
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={e => { setNewPassword(e.target.value); setPasswordStatus(IDLE) }}
                    disabled={passwordStatus.state === 'saving'}
                    className={`${inputClass} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(v => !v)}
                    tabIndex={-1}
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-stone-400 transition hover:text-stone-600"
                  >
                    {showNewPassword ? (
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
                  const ok = rule.test(newPassword)
                  return (
                    <li key={rule.label} className={`flex items-center gap-1.5 text-xs transition ${ok ? 'text-emerald-600' : 'text-stone-400'}`}>
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
            {passwordStatus.state === 'error' && (
              <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600">
                {passwordStatus.message}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-stone-200/70 bg-stone-50/60 px-6 py-3">
            <p className="text-xs text-stone-400">Other devices will need the new password next time they sign in.</p>
            <div className="flex shrink-0 items-center gap-3">
              {passwordStatus.state === 'saved' && SAVED}
              <button type="submit" disabled={!passwordReady || passwordStatus.state === 'saving'} className={BTN_PRIMARY}>
                {passwordStatus.state === 'saving' && SPINNER}
                Update password
              </button>
            </div>
          </div>
        </form>
        <form onSubmit={onDeleteSubmit} className="overflow-hidden rounded-2xl border border-red-200 bg-white shadow-sm">
          <div className="p-6">
            <h2 className="text-base font-semibold tracking-tight text-stone-900">Delete account</h2>
            <p className="mt-1 text-sm text-stone-500">
              Permanently deletes your account, your photos and all associated data, as described in the Privacy Policy. There is no undo.
            </p>
            <div className="mt-5 space-y-1.5">
              <label htmlFor="delete-password" className="block text-sm font-medium text-stone-700">Password</label>
              <input
                id="delete-password"
                type="password"
                autoComplete="current-password"
                required
                maxLength={128}
                placeholder="••••••••"
                value={deletePassword}
                onChange={e => { setDeletePassword(e.target.value); setDeleteStatus(IDLE) }}
                disabled={deleteStatus.state === 'saving'}
                className={inputClass}
              />
            </div>
            {deleteStatus.state === 'error' && (
              <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600">
                {deleteStatus.message}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-red-200 bg-red-50/40 px-6 py-3">
            <p className="text-xs text-stone-400">Enter your password to confirm.</p>
            <button type="submit" disabled={deletePassword.length === 0 || deleteStatus.state === 'saving'} className={BTN_DANGER}>
              {deleteStatus.state === 'saving' && SPINNER}
              Delete account
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}