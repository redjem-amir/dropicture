// dropicture/app/frontend/src/app/auth/accounts/page.tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import Avvvatars from 'avvvatars-react'
import { useUser } from '@/components/UserProvider'
import { TbBan, TbCheck, TbChevronLeft, TbChevronRight, TbDots, TbLock, TbPlayerPause, TbSearch, TbTrash, TbUserPlus, TbX } from 'react-icons/tb'

type AccountStatus = 'active' | 'pending' | 'suspended' | 'banned'
type Account = {
    id: string
    firstname: string
    lastname: string
    email: string
    roles: string[]
    status: AccountStatus
    createdAt: string
}
type ListResponse = {
    items: Account[]
    page: number
    pageSize: number
    total: number
    totalPages: number
    hasPrev: boolean
    hasNext: boolean
}

const PAGE_SIZE = 20
const ADMIN_ROLE = 'admin'

const STATUS: Record<AccountStatus, { label: string; tone: string }> = {
    active: { label: 'Active', tone: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
    pending: { label: 'Pending', tone: 'border-amber-200 bg-amber-50 text-amber-700' },
    suspended: { label: 'Suspended', tone: 'border-stone-200 bg-stone-50 text-stone-600' },
    banned: { label: 'Banned', tone: 'border-red-200 bg-red-50 text-red-700' },
}
const STATUS_FILTERS: { value: '' | AccountStatus; label: string }[] = [
    { value: '', label: 'All statuses' },
    { value: 'active', label: 'Active' },
    { value: 'pending', label: 'Pending' },
    { value: 'suspended', label: 'Suspended' },
    { value: 'banned', label: 'Banned' },
]

const PASSWORD_RULES: { label: string; test: (p: string) => boolean }[] = [
    { label: 'At least 8 characters', test: p => p.length >= 8 },
    { label: 'One uppercase letter', test: p => /[A-Z]/.test(p) },
    { label: 'One lowercase letter', test: p => /[a-z]/.test(p) },
    { label: 'One number', test: p => /[0-9]/.test(p) },
    { label: 'One special character', test: p => /[^A-Za-z0-9]/.test(p) },
]

const CREATE_ERRORS: Record<string, string> = {
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
}

const ACTION_ERRORS: Record<string, string> = {
    ADMIN_PROTECTED: "This account is protected — it can't be suspended, banned or deleted.",
    CANNOT_MODIFY_SELF: "You can't change the status of your own account.",
    CANNOT_DELETE_SELF: "You can't delete your own account.",
}

const BADGE_BASE = 'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium'
const BTN_PRIMARY =
    'inline-flex h-9 items-center justify-center gap-2 rounded-full bg-stone-900 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-stone-700 disabled:pointer-events-none disabled:opacity-60'
const BTN_SECONDARY =
    'inline-flex h-9 items-center justify-center gap-2 rounded-full border border-stone-200 bg-white px-4 text-sm font-medium text-stone-700 shadow-sm transition-colors hover:border-stone-300 hover:text-stone-900'
const BTN_PAGE =
    'inline-flex h-8 items-center justify-center gap-1 rounded-full border border-stone-200 bg-white px-3 text-sm font-medium text-stone-700 shadow-sm transition-colors hover:border-stone-300 hover:text-stone-900 disabled:pointer-events-none disabled:opacity-50'
const FIELD =
    'h-9 rounded-full border border-stone-200 bg-white text-sm text-stone-900 shadow-sm outline-none transition focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10'
const INPUT =
    'h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-900 placeholder:text-stone-400 outline-none transition focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 disabled:opacity-60'
const MENU_ITEM =
    'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900'
const MENU_ITEM_DANGER =
    'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 hover:text-red-700'

function joined(iso: string): string {
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export default function AccountsPage() {
    const { user } = useUser()
    const currentEmail = user?.email?.toLowerCase() ?? null

    const [query, setQuery] = useState('')
    const [debounced, setDebounced] = useState('')
    const [statusFilter, setStatusFilter] = useState<'' | AccountStatus>('')
    const [page, setPage] = useState(1)
    const [reloadKey, setReloadKey] = useState(0)

    const [data, setData] = useState<ListResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [actionError, setActionError] = useState<string | null>(null)

    const [openMenu, setOpenMenu] = useState<string | null>(null)
    const [busyId, setBusyId] = useState<string | null>(null)

    const [showCreate, setShowCreate] = useState(false)
    const [cFirst, setCFirst] = useState('')
    const [cLast, setCLast] = useState('')
    const [cEmail, setCEmail] = useState('')
    const [cPassword, setCPassword] = useState('')
    const [cShow, setCShow] = useState(false)
    const [creating, setCreating] = useState(false)
    const [createError, setCreateError] = useState<string | null>(null)

    useEffect(() => {
        const t = setTimeout(() => setDebounced(query.trim()), 300)
        return () => clearTimeout(t)
    }, [query])

    useEffect(() => {
        setPage(1)
    }, [debounced, statusFilter])

    const load = useCallback(async () => {
        setLoading(true)
        setError(null)
        setActionError(null)
        try {
            const params = new URLSearchParams()
            params.set('page', String(page))
            params.set('pageSize', String(PAGE_SIZE))
            if (debounced) params.set('q', debounced)
            if (statusFilter) params.set('status', statusFilter)
            const res = await fetch(`/api/accounts?${params.toString()}`, { credentials: 'same-origin' })
            if (res.status === 403) {
                setData(null)
                setError("You don't have permission to view accounts.")
                return
            }
            if (!res.ok) {
                setData(null)
                setError('Could not load accounts. Please try again.')
                return
            }
            setData((await res.json()) as ListResponse)
        } catch {
            setData(null)
            setError('Could not load accounts. Please try again.')
        } finally {
            setLoading(false)
        }
    }, [page, debounced, statusFilter, reloadKey])

    useEffect(() => {
        void load()
    }, [load])

    useEffect(() => {
        if (!openMenu) return
        const close = () => setOpenMenu(null)
        document.addEventListener('click', close)
        return () => document.removeEventListener('click', close)
    }, [openMenu])

    useEffect(() => {
        if (!showCreate) return
        const prev = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeCreate()
        }
        window.addEventListener('keydown', onKey)
        return () => {
            document.body.style.overflow = prev
            window.removeEventListener('keydown', onKey)
        }
    }, [showCreate])

    function closeCreate() {
        if (creating) return
        setShowCreate(false)
        setCFirst('')
        setCLast('')
        setCEmail('')
        setCPassword('')
        setCShow(false)
        setCreateError(null)
    }

    async function act(id: string, run: () => Promise<Response>, confirmMsg?: string) {
        if (confirmMsg && !window.confirm(confirmMsg)) return
        setOpenMenu(null)
        setBusyId(id)
        setActionError(null)
        try {
            const res = await run()
            if (!res.ok) {
                const body = await res.json().catch(() => null)
                const code = body?.code ?? (Array.isArray(body?.message) ? body.message[0] : body?.message)
                setActionError(ACTION_ERRORS[code] ?? 'That action could not be completed.')
                return
            }
            await load()
        } catch {
            setActionError('That action could not be completed.')
        } finally {
            setBusyId(null)
        }
    }

    const changeStatus = (id: string, status: AccountStatus, confirmMsg?: string) =>
        act(
            id,
            () =>
                fetch(`/api/accounts/${id}/status`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status }),
                }),
            confirmMsg,
        )

    const remove = (id: string) =>
        act(id, () => fetch(`/api/accounts/${id}`, { method: 'DELETE' }), 'Delete this account permanently? This cannot be undone.')

    const createValid =
        cFirst.trim().length >= 2 &&
        cLast.trim().length >= 2 &&
        /^\S+@\S+\.\S+$/.test(cEmail.trim()) &&
        PASSWORD_RULES.every(r => r.test(cPassword))

    async function createAccount(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        if (creating || !createValid) return
        setCreating(true)
        setCreateError(null)
        try {
            const res = await fetch('/api/accounts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    firstname: cFirst.trim(),
                    lastname: cLast.trim(),
                    email: cEmail.trim(),
                    password: cPassword,
                }),
            })
            if (res.ok) {
                setShowCreate(false)
                setCFirst('')
                setCLast('')
                setCEmail('')
                setCPassword('')
                setCShow(false)
                setQuery('')
                setStatusFilter('')
                setPage(1)
                setReloadKey(k => k + 1)
                return
            }
            const body = await res.json().catch(() => null)
            const code = body?.code ?? (Array.isArray(body?.message) ? body.message[0] : body?.message)
            setCreateError(CREATE_ERRORS[code] ?? 'Something went wrong. Please try again.')
        } catch {
            setCreateError('Something went wrong. Please try again.')
        } finally {
            setCreating(false)
        }
    }

    const total = data?.total ?? 0
    const totalPages = data?.totalPages ?? 1
    const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
    const to = Math.min(page * PAGE_SIZE, total)

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Accounts</h1>
                    <p className="mt-1 text-sm text-stone-500">
                        {data ? `${total.toLocaleString()} ${total === 1 ? 'account' : 'accounts'}` : '\u00A0'}
                    </p>
                </div>
                <button className={BTN_PRIMARY} onClick={() => setShowCreate(true)}>
                    <TbUserPlus className="size-4" />
                    New account
                </button>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative sm:max-w-sm sm:flex-1">
                    <TbSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
                    <input
                        type="search"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Search by name or email"
                        className={`${FIELD} w-full pl-9 pr-3`}
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value as '' | AccountStatus)}
                    className={`${FIELD} px-3 sm:w-44`}
                    aria-label="Filter by status"
                >
                    {STATUS_FILTERS.map(f => (
                        <option key={f.value} value={f.value}>
                            {f.label}
                        </option>
                    ))}
                </select>
            </div>
            {actionError && (
                <div role="alert" className="flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600">
                    <span>{actionError}</span>
                    <button onClick={() => setActionError(null)} className="shrink-0 text-xs font-medium text-red-500 hover:text-red-700">
                        Dismiss
                    </button>
                </div>
            )}
            {error ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-stone-200/70 bg-white px-6 py-16 text-center shadow-sm">
                    <p className="text-sm text-stone-500">{error}</p>
                    <button onClick={() => void load()} className={`${BTN_PAGE} mt-4`}>
                        Try again
                    </button>
                </div>
            ) : (
                <div className="divide-y divide-stone-200/70 rounded-2xl border border-stone-200/70 bg-white shadow-sm">
                    <div className="hidden items-center gap-4 px-4 py-2.5 font-mono text-[11px] font-medium uppercase tracking-widest text-stone-400 md:flex">
                        <span className="flex-1">User</span>
                        <span className="w-28 shrink-0">Role</span>
                        <span className="w-28 shrink-0">Status</span>
                        <span className="hidden w-24 shrink-0 lg:block">Joined</span>
                        <span className="w-9 shrink-0" />
                    </div>
                    {loading && !data ? (
                        Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-4 px-4 py-3" aria-hidden>
                                <div className="size-9 shrink-0 animate-pulse rounded-full bg-stone-100" />
                                <div className="flex-1 space-y-1.5">
                                    <div className="h-3 w-32 animate-pulse rounded bg-stone-100" />
                                    <div className="h-2.5 w-48 animate-pulse rounded bg-stone-100" />
                                </div>
                                <div className="hidden h-3 w-20 animate-pulse rounded bg-stone-100 md:block" />
                                <div className="h-5 w-16 animate-pulse rounded-full bg-stone-100" />
                            </div>
                        ))
                    ) : data && data.items.length > 0 ? (
                        data.items.map(a => {
                            const isAdmin = a.roles.some(r => r.toLowerCase() === ADMIN_ROLE)
                            const isSelf = !!currentEmail && a.email.toLowerCase() === currentEmail
                            const locked = isAdmin || isSelf // can't suspend / ban / delete
                            const canActivate = a.status !== 'active' && !isSelf
                            const canSuspend = a.status === 'active' && !locked
                            const canBan = a.status !== 'banned' && !locked
                            const canDelete = !locked
                            const hasActions = canActivate || canSuspend || canBan || canDelete
                            return (
                                <div
                                    key={a.id}
                                    className={`flex items-center gap-4 px-4 py-3 transition-opacity ${busyId === a.id ? 'opacity-50' : ''}`}
                                >
                                    <div className="flex min-w-0 flex-1 items-center gap-3">
                                        <span className="shrink-0">
                                            <Avvvatars value={a.email} displayValue={`${a.firstname[0] ?? ''}${a.lastname[0] ?? ''}`} style="shape" size={36} />
                                        </span>
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium text-stone-900">
                                                {a.firstname} {a.lastname}
                                                {isSelf && <span className="ml-1.5 text-xs font-normal text-stone-400">(you)</span>}
                                            </p>
                                            <p className="truncate text-xs text-stone-400">{a.email}</p>
                                        </div>
                                    </div>
                                    <div className="hidden w-28 shrink-0 truncate text-sm text-stone-500 md:block">
                                        {a.roles.length ? a.roles[0] : '—'}
                                        {a.roles.length > 1 && <span className="text-stone-400"> +{a.roles.length - 1}</span>}
                                    </div>
                                    <div className="w-28 shrink-0">
                                        <span className={`${BADGE_BASE} ${STATUS[a.status].tone}`}>{STATUS[a.status].label}</span>
                                    </div>
                                    <div className="hidden w-24 shrink-0 text-xs text-stone-400 lg:block">{joined(a.createdAt)}</div>
                                    <div className="relative">
                                        {hasActions ? (
                                            <>
                                                <button
                                                    aria-label="Account actions"
                                                    disabled={busyId === a.id}
                                                    onClick={e => {
                                                        e.stopPropagation()
                                                        setOpenMenu(openMenu === a.id ? null : a.id)
                                                    }}
                                                    className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 disabled:opacity-50"
                                                >
                                                    <TbDots className="size-4.5" />
                                                </button>
                                                {openMenu === a.id && (
                                                    <div
                                                        role="menu"
                                                        onClick={e => e.stopPropagation()}
                                                        className="absolute right-0 top-full z-20 mt-1 w-48 rounded-xl border border-stone-200/70 bg-white p-1.5 shadow-xl shadow-stone-900/8"
                                                    >
                                                        {canActivate && (
                                                            <button className={MENU_ITEM} onClick={() => changeStatus(a.id, 'active')}>
                                                                <TbCheck className="size-4 text-stone-400" />
                                                                Activate
                                                            </button>
                                                        )}
                                                        {canSuspend && (
                                                            <button className={MENU_ITEM} onClick={() => changeStatus(a.id, 'suspended')}>
                                                                <TbPlayerPause className="size-4 text-stone-400" />
                                                                Suspend
                                                            </button>
                                                        )}
                                                        {canBan && (
                                                            <button
                                                                className={MENU_ITEM_DANGER}
                                                                onClick={() => changeStatus(a.id, 'banned', 'Ban this account? Their sessions will be revoked immediately.')}
                                                            >
                                                                <TbBan className="size-4" />
                                                                Ban
                                                            </button>
                                                        )}
                                                        {canDelete && (canActivate || canSuspend || canBan) && (
                                                            <div aria-hidden className="my-1 h-px bg-stone-200/70" />
                                                        )}
                                                        {canDelete && (
                                                            <button className={MENU_ITEM_DANGER} onClick={() => remove(a.id)}>
                                                                <TbTrash className="size-4" />
                                                                Delete
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <span
                                                title={isSelf ? 'This is your account' : 'Protected account'}
                                                className="inline-flex size-9 shrink-0 items-center justify-center text-stone-300"
                                            >
                                                <TbLock className="size-4" />
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )
                        })
                    ) : (
                        <p className="px-4 py-12 text-center text-sm text-stone-500">
                            {debounced || statusFilter ? 'No accounts match your filters.' : 'No accounts yet.'}
                        </p>
                    )}
                </div>
            )}
            {data && total > 0 && (
                <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
                    <p className="text-xs text-stone-400">
                        Showing {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()} · Page {page} of {totalPages}
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            className={BTN_PAGE}
                            disabled={!data.hasPrev || loading}
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                        >
                            <TbChevronLeft className="size-4" />
                            Previous
                        </button>
                        <button
                            className={BTN_PAGE}
                            disabled={!data.hasNext || loading}
                            onClick={() => setPage(p => p + 1)}
                        >
                            Next
                            <TbChevronRight className="size-4" />
                        </button>
                    </div>
                </div>
            )}
            {showCreate && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/20 p-4 backdrop-blur-sm sm:items-center">
                    <div aria-hidden className="absolute inset-0" onClick={closeCreate} />
                    <form
                        onSubmit={createAccount}
                        role="dialog"
                        aria-modal="true"
                        aria-label="New account"
                        className="relative w-full max-w-md rounded-2xl border border-stone-200/70 bg-white p-6 shadow-xl shadow-stone-900/10"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-base font-semibold tracking-tight text-stone-900">New account</h2>
                                <p className="mt-1 text-sm text-stone-500">Create an account and set its initial password.</p>
                            </div>
                            <button
                                type="button"
                                onClick={closeCreate}
                                aria-label="Close"
                                className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-900"
                            >
                                <TbX className="size-4.5" />
                            </button>
                        </div>
                        <div className="mt-5 space-y-4">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-3">
                                <div className="space-y-1.5">
                                    <label htmlFor="c-first" className="block text-sm font-medium text-stone-700">First name</label>
                                    <input id="c-first" type="text" autoComplete="off" required maxLength={30} placeholder="Ada" value={cFirst} onChange={e => { setCFirst(e.target.value); setCreateError(null) }} disabled={creating} className={INPUT} />
                                </div>
                                <div className="space-y-1.5">
                                    <label htmlFor="c-last" className="block text-sm font-medium text-stone-700">Last name</label>
                                    <input id="c-last" type="text" autoComplete="off" required maxLength={30} placeholder="Lovelace" value={cLast} onChange={e => { setCLast(e.target.value); setCreateError(null) }} disabled={creating} className={INPUT} />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label htmlFor="c-email" className="block text-sm font-medium text-stone-700">Email</label>
                                <input id="c-email" type="email" autoComplete="off" required placeholder="you@example.com" value={cEmail} onChange={e => { setCEmail(e.target.value); setCreateError(null) }} disabled={creating} className={INPUT} />
                            </div>
                            <div className="space-y-1.5">
                                <label htmlFor="c-password" className="block text-sm font-medium text-stone-700">Initial password</label>
                                <div className="relative">
                                    <input id="c-password" type={cShow ? 'text' : 'password'} autoComplete="new-password" required maxLength={128} placeholder="••••••••" value={cPassword} onChange={e => { setCPassword(e.target.value); setCreateError(null) }} disabled={creating} className={`${INPUT} pr-10`} />
                                    <button type="button" onClick={() => setCShow(v => !v)} tabIndex={-1} aria-label={cShow ? 'Hide password' : 'Show password'} className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-stone-400 transition hover:text-stone-600">
                                        {cShow ? (
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
                                <ul className="grid grid-cols-1 gap-1.5 pt-1 sm:grid-cols-2">
                                    {PASSWORD_RULES.map(rule => {
                                        const ok = rule.test(cPassword)
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
                            {createError && (
                                <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600">
                                    {createError}
                                </div>
                            )}
                        </div>
                        <div className="mt-6 flex justify-end gap-3">
                            <button type="button" onClick={closeCreate} disabled={creating} className={BTN_SECONDARY}>
                                Cancel
                            </button>
                            <button type="submit" disabled={!createValid || creating} className={BTN_PRIMARY}>
                                {creating && (
                                    <svg viewBox="0 0 24 24" fill="none" className="size-4 animate-spin" aria-hidden="true">
                                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
                                        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                                    </svg>
                                )}
                                Create account
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    )
}