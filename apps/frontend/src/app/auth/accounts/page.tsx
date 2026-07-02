// dropicture/apps/frontend/src/app/auth/accounts/page.tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import Avvvatars from 'avvvatars-react'
import { useUser } from '@/components/UserProvider'
import { TbBan, TbCheck, TbChevronLeft, TbChevronRight, TbDatabase, TbDots, TbLock, TbPlayerPause, TbSearch, TbTrash, TbUserPlus, TbX } from 'react-icons/tb'

type AccountStatus = 'active' | 'pending' | 'suspended' | 'banned'
type Account = {
    id: string
    firstname: string
    lastname: string
    email: string
    roles: string[]
    status: AccountStatus
    storageQuotaBytes: number
    storageUsedBytes: number
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
type StorageSummary = {
    capacityBytes: number
    usedBytes: number
    allocatedBytes: number
    freeBytes: number
    accountCount: number
    pictureCount: number
    usedPercent: number
    allocatedPercent: number
}

const PAGE_SIZE = 20
const ADMIN_ROLE = 'admin'

const KB = 1000
const MB = KB * 1000
const GB = MB * 1000
const TB = GB * 1000

type QuotaUnit = 'MB' | 'GB' | 'TB'
const UNIT_FACTOR: Record<QuotaUnit, number> = { MB, GB, TB }
const QUOTA_PRESETS: { label: string; bytes: number }[] = [
    { label: '1 GB', bytes: GB },
    { label: '5 GB', bytes: 5 * GB },
    { label: '10 GB', bytes: 10 * GB },
    { label: '50 GB', bytes: 50 * GB },
    { label: '100 GB', bytes: 100 * GB },
    { label: '1 TB', bytes: TB },
]

function formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 GB'
    const units: [string, number][] = [['B', 1], ['KB', KB], ['MB', MB], ['GB', GB], ['TB', TB]]
    let i = units.length - 1
    while (i > 0 && bytes < units[i][1]) i--
    let value = bytes / units[i][1]
    let digits = value >= 100 ? 0 : 1
    let rounded = Number(value.toFixed(digits))
    if (rounded >= 1000 && i < units.length - 1) {
        i += 1
        value = bytes / units[i][1]
        digits = value >= 100 ? 0 : 1
        rounded = Number(value.toFixed(digits))
    }
    const label = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(digits)
    return `${label} ${units[i][0]}`
}

function splitBytes(bytes: number): { value: string; unit: QuotaUnit } {
    if (bytes >= TB) return { value: trimNumber(bytes / TB), unit: 'TB' }
    if (bytes >= GB || bytes === 0) return { value: trimNumber(bytes / GB), unit: 'GB' }
    return { value: trimNumber(bytes / MB), unit: 'MB' }
}

function trimNumber(n: number): string {
    return String(Number(n.toFixed(2)))
}

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
    MISSING_FIELDS: 'Please fill in every field.',
    INVALID_NAME: 'Names can use letters, spaces, apostrophes and hyphens (2–30 characters).',
    EMAIL_INVALID: 'Please enter a valid email address.',
    EMAIL_ALREADY_USED: 'This email is already taken.',
    PASSWORD_TOO_SHORT: 'Use at least 8 characters.',
    PASSWORD_TOO_LONG: 'Use 128 characters or fewer.',
    PASSWORD_MISSING_UPPERCASE: 'Add an uppercase letter.',
    PASSWORD_MISSING_LOWERCASE: 'Add a lowercase letter.',
    PASSWORD_MISSING_NUMBER: 'Add a number.',
    PASSWORD_MISSING_SPECIAL: 'Add a special character.',
    INVALID_QUOTA: 'Enter an amount of space.',
    QUOTA_EXCEEDS_CAPACITY: "That's more space than you have.",
}

const ACTION_ERRORS: Record<string, string> = {
    ADMIN_PROTECTED: "This account is protected and can't be changed.",
    CANNOT_MODIFY_SELF: "You can't change your own account.",
    CANNOT_DELETE_SELF: "You can't delete your own account.",
}

const STORAGE_ERRORS: Record<string, string> = {
    INVALID_QUOTA: 'Enter an amount of space.',
    QUOTA_EXCEEDS_CAPACITY: "That's more space than you have.",
    ACCOUNT_NOT_FOUND: 'This account no longer exists.',
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

function Meter({ value, max, className }: { value: number; max: number; className?: string }) {
    const pct = max > 0 ? Math.min(100, (value / max) * 100) : value > 0 ? 100 : 0
    const tone = pct >= 90 ? 'bg-red-500' : pct >= 75 ? 'bg-amber-500' : 'bg-emerald-500'
    return (
        <div className={`h-1.5 w-full overflow-hidden rounded-full bg-stone-100 ${className ?? ''}`}>
            <div className={`h-full rounded-full transition-all ${tone}`} style={{ width: `${pct}%` }} />
        </div>
    )
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
    const [summary, setSummary] = useState<StorageSummary | null>(null)
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
    const [cQuota, setCQuota] = useState('5')
    const [cUnit, setCUnit] = useState<QuotaUnit>('GB')
    const [creating, setCreating] = useState(false)
    const [createError, setCreateError] = useState<string | null>(null)

    const [quotaFor, setQuotaFor] = useState<Account | null>(null)
    const [qValue, setQValue] = useState('5')
    const [qUnit, setQUnit] = useState<QuotaUnit>('GB')
    const [qSaving, setQSaving] = useState(false)
    const [qError, setQError] = useState<string | null>(null)

    useEffect(() => {
        const t = setTimeout(() => setDebounced(query.trim()), 300)
        return () => clearTimeout(t)
    }, [query])

    useEffect(() => {
        setPage(1)
    }, [debounced, statusFilter])

    const loadSummary = useCallback(async () => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/accounts/storage/summary`, { credentials: 'include' })
            if (res.ok) setSummary((await res.json()) as StorageSummary)
        } catch {
            /* the summary card is non-critical; ignore transient failures */
        }
    }, [])

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
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/accounts?${params.toString()}`, { credentials: 'include' })
            if (res.status === 403) {
                setData(null)
                setError("You don't have permission to view accounts.")
                return
            }
            if (!res.ok) {
                setData(null)
                setError("We couldn't load accounts. Please try again.")
                return
            }
            setData((await res.json()) as ListResponse)
            void loadSummary()
        } catch {
            setData(null)
            setError("We couldn't load accounts. Please try again.")
        } finally {
            setLoading(false)
        }
    }, [page, debounced, statusFilter, reloadKey, loadSummary])

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

    useEffect(() => {
        if (!quotaFor) return
        const prev = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeQuota()
        }
        window.addEventListener('keydown', onKey)
        return () => {
            document.body.style.overflow = prev
            window.removeEventListener('keydown', onKey)
        }
    }, [quotaFor])

    function closeCreate() {
        if (creating) return
        setShowCreate(false)
        setCFirst('')
        setCLast('')
        setCEmail('')
        setCPassword('')
        setCShow(false)
        setCQuota('5')
        setCUnit('GB')
        setCreateError(null)
    }

    function openQuota(account: Account) {
        setOpenMenu(null)
        const { value, unit } = splitBytes(account.storageQuotaBytes)
        setQuotaFor(account)
        setQValue(value)
        setQUnit(unit)
        setQError(null)
    }

    function closeQuota() {
        if (qSaving) return
        setQuotaFor(null)
        setQError(null)
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
                setActionError(ACTION_ERRORS[code] ?? "That didn't work. Please try again.")
                return
            }
            await load()
        } catch {
            setActionError("That didn't work. Please try again.")
        } finally {
            setBusyId(null)
        }
    }

    const changeStatus = (id: string, status: AccountStatus, confirmMsg?: string) =>
        act(
            id,
            () =>
                fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/accounts/${id}/status`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status }),
                }),
            confirmMsg,
        )

    const remove = (id: string) =>
        act(id, () => fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/accounts/${id}`, { method: 'DELETE' }), "Delete this account? This can't be undone.")

    const qBytes = Math.round((parseFloat(qValue) || 0) * UNIT_FACTOR[qUnit])
    const qValid = /^\d+(\.\d+)?$/.test(qValue.trim()) && qBytes >= 0 && (!summary || qBytes <= summary.capacityBytes)
    const qBelowUsage = !!quotaFor && qBytes < quotaFor.storageUsedBytes

    async function saveQuota() {
        if (!quotaFor || qSaving) return
        if (!/^\d+(\.\d+)?$/.test(qValue.trim())) {
            setQError(STORAGE_ERRORS.INVALID_QUOTA)
            return
        }
        if (summary && qBytes > summary.capacityBytes) {
            setQError(STORAGE_ERRORS.QUOTA_EXCEEDS_CAPACITY)
            return
        }
        setQSaving(true)
        setQError(null)
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/accounts/${quotaFor.id}/storage`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quotaBytes: qBytes }),
            })
            if (res.ok) {
                setQuotaFor(null)
                await load()
                return
            }
            const body = await res.json().catch(() => null)
            const code = body?.code ?? (Array.isArray(body?.message) ? body.message[0] : body?.message)
            setQError(STORAGE_ERRORS[code] ?? "We couldn't save the new limit.")
        } catch {
            setQError("We couldn't save the new limit.")
        } finally {
            setQSaving(false)
        }
    }

    const createValid =
        cFirst.trim().length >= 2 &&
        cLast.trim().length >= 2 &&
        /^\S+@\S+\.\S+$/.test(cEmail.trim()) &&
        PASSWORD_RULES.every(r => r.test(cPassword)) &&
        /^\d+(\.\d+)?$/.test(cQuota.trim())

    async function createAccount(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        if (creating || !createValid) return
        setCreating(true)
        setCreateError(null)
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/accounts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    firstname: cFirst.trim(),
                    lastname: cLast.trim(),
                    email: cEmail.trim(),
                    password: cPassword,
                    storageQuotaBytes: Math.round((parseFloat(cQuota) || 0) * UNIT_FACTOR[cUnit]),
                }),
            })
            if (res.ok) {
                setShowCreate(false)
                setCFirst('')
                setCLast('')
                setCEmail('')
                setCPassword('')
                setCShow(false)
                setCQuota('5')
                setCUnit('GB')
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
            <div className="rounded-2xl border border-stone-200/70 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex items-center gap-2 text-stone-900">
                    <TbDatabase className="size-4.5 text-stone-400" />
                    <h2 className="text-sm font-semibold tracking-tight">Storage</h2>
                </div>
                {summary ? (
                    <div className="mt-3 space-y-2.5">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                            <p className="text-sm text-stone-600">
                                <span className="font-semibold text-stone-900">{formatBytes(summary.usedBytes)}</span> of{' '}
                                {formatBytes(summary.capacityBytes)} used
                                <span className="text-stone-400"> · {formatBytes(summary.freeBytes)} available</span>
                            </p>
                            <p className="text-sm font-medium tabular-nums text-stone-500">
                                {Math.round(summary.usedPercent * 100)}%
                            </p>
                        </div>
                        <Meter value={summary.usedBytes} max={summary.capacityBytes} />
                        <p className="text-xs text-stone-400">
                            Reserved for users: {formatBytes(summary.allocatedBytes)} · {summary.accountCount.toLocaleString()}{' '}
                            {summary.accountCount === 1 ? 'account' : 'accounts'}
                            {summary.allocatedBytes > summary.capacityBytes && (
                                <span className="ml-1 font-medium text-amber-600">— more than your total space</span>
                            )}
                        </p>
                    </div>
                ) : (
                    <div className="mt-3 space-y-2.5" aria-hidden>
                        <div className="h-3 w-56 animate-pulse rounded bg-stone-100" />
                        <div className="h-1.5 w-full animate-pulse rounded-full bg-stone-100" />
                        <div className="h-2.5 w-64 animate-pulse rounded bg-stone-100" />
                    </div>
                )}
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
                        <span className="w-24 shrink-0">Role</span>
                        <span className="hidden w-40 shrink-0 lg:block">Storage</span>
                        <span className="w-24 shrink-0">Status</span>
                        <span className="hidden w-20 shrink-0 xl:block">Joined</span>
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
                            const hasStatusActions = canActivate || canSuspend || canBan
                            const overQuota = a.storageUsedBytes > a.storageQuotaBytes
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
                                    <div className="hidden w-24 shrink-0 truncate text-sm text-stone-500 md:block">
                                        {a.roles.length ? a.roles[0] : '—'}
                                        {a.roles.length > 1 && <span className="text-stone-400"> +{a.roles.length - 1}</span>}
                                    </div>
                                    <div className="hidden w-40 shrink-0 lg:block">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className={overQuota ? 'font-medium text-red-600' : 'text-stone-500'}>
                                                {formatBytes(a.storageUsedBytes)}
                                            </span>
                                            <span className="text-stone-400">{formatBytes(a.storageQuotaBytes)}</span>
                                        </div>
                                        <Meter value={a.storageUsedBytes} max={a.storageQuotaBytes} className="mt-1" />
                                    </div>
                                    <div className="w-24 shrink-0">
                                        <span className={`${BADGE_BASE} ${STATUS[a.status].tone}`}>{STATUS[a.status].label}</span>
                                    </div>
                                    <div className="hidden w-20 shrink-0 text-xs text-stone-400 xl:block">{joined(a.createdAt)}</div>
                                    <div className="relative">
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
                                                {locked && (
                                                    <p className="flex items-center gap-1.5 px-2.5 pb-1.5 pt-1 text-xs text-stone-400">
                                                        <TbLock className="size-3.5" />
                                                        {isSelf ? 'Your account' : 'Protected account'}
                                                    </p>
                                                )}
                                                <button className={MENU_ITEM} onClick={() => openQuota(a)}>
                                                    <TbDatabase className="size-4 text-stone-400" />
                                                    Storage limit
                                                </button>
                                                {hasStatusActions && <div aria-hidden className="my-1 h-px bg-stone-200/70" />}
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
                                                        onClick={() => changeStatus(a.id, 'banned', "Ban this account? They'll be signed out right away.")}
                                                    >
                                                        <TbBan className="size-4" />
                                                        Ban
                                                    </button>
                                                )}
                                                {canDelete && (
                                                    <>
                                                        <div aria-hidden className="my-1 h-px bg-stone-200/70" />
                                                        <button className={MENU_ITEM_DANGER} onClick={() => remove(a.id)}>
                                                            <TbTrash className="size-4" />
                                                            Delete
                                                        </button>
                                                    </>
                                                )}
                                            </div>
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
            {quotaFor && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/20 p-4 backdrop-blur-sm sm:items-center">
                    <div aria-hidden className="absolute inset-0" onClick={closeQuota} />
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label="Storage limit"
                        className="relative w-full max-w-md rounded-2xl border border-stone-200/70 bg-white p-6 shadow-xl shadow-stone-900/10"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                                <h2 className="text-base font-semibold tracking-tight text-stone-900">Storage limit</h2>
                                <p className="mt-1 truncate text-sm text-stone-500">
                                    {quotaFor.firstname} {quotaFor.lastname} · {quotaFor.email}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={closeQuota}
                                aria-label="Close"
                                className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-900"
                            >
                                <TbX className="size-4.5" />
                            </button>
                        </div>

                        <div className="mt-5 space-y-4">
                            <div className="rounded-xl border border-stone-200/70 bg-stone-50 p-3">
                                <div className="flex items-center justify-between text-xs text-stone-500">
                                    <span>
                                        Using <span className="font-medium text-stone-700">{formatBytes(quotaFor.storageUsedBytes)}</span>
                                    </span>
                                    <span>{formatBytes(qBytes)} limit</span>
                                </div>
                                <Meter value={quotaFor.storageUsedBytes} max={qBytes} className="mt-2" />
                            </div>

                            <div className="space-y-1.5">
                                <label htmlFor="q-value" className="block text-sm font-medium text-stone-700">New limit</label>
                                <div className="flex gap-2">
                                    <input
                                        id="q-value"
                                        type="text"
                                        inputMode="decimal"
                                        value={qValue}
                                        onChange={e => { setQValue(e.target.value); setQError(null) }}
                                        disabled={qSaving}
                                        className={`${INPUT} flex-1`}
                                    />
                                    <select
                                        value={qUnit}
                                        onChange={e => setQUnit(e.target.value as QuotaUnit)}
                                        disabled={qSaving}
                                        aria-label="Unit"
                                        className="h-10 shrink-0 rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-900 shadow-sm outline-none transition focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 disabled:opacity-60"
                                    >
                                        <option value="MB">MB</option>
                                        <option value="GB">GB</option>
                                        <option value="TB">TB</option>
                                    </select>
                                </div>
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                    {QUOTA_PRESETS.map(p => {
                                        const active = p.bytes === qBytes
                                        return (
                                            <button
                                                key={p.label}
                                                type="button"
                                                disabled={qSaving}
                                                onClick={() => {
                                                    const s = splitBytes(p.bytes)
                                                    setQValue(s.value)
                                                    setQUnit(s.unit)
                                                    setQError(null)
                                                }}
                                                className={
                                                    'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-60 ' +
                                                    (active
                                                        ? 'border-stone-900 bg-stone-900 text-white'
                                                        : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:text-stone-900')
                                                }
                                            >
                                                {p.label}
                                            </button>
                                        )
                                    })}
                                </div>
                                {summary && (
                                    <p className="pt-0.5 text-xs text-stone-400">
                                        Total space: {formatBytes(summary.capacityBytes)}.
                                    </p>
                                )}
                                {qBelowUsage && !qError && (
                                    <p className="pt-0.5 text-xs text-amber-600">
                                        That's less than they're using now — they won't be able to add photos until they free up space.
                                    </p>
                                )}
                            </div>

                            {qError && (
                                <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600">
                                    {qError}
                                </div>
                            )}
                        </div>

                        <div className="mt-6 flex justify-end gap-3">
                            <button type="button" onClick={closeQuota} disabled={qSaving} className={BTN_SECONDARY}>
                                Cancel
                            </button>
                            <button type="button" onClick={saveQuota} disabled={!qValid || qSaving} className={BTN_PRIMARY}>
                                {qSaving && (
                                    <svg viewBox="0 0 24 24" fill="none" className="size-4 animate-spin" aria-hidden="true">
                                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
                                        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                                    </svg>
                                )}
                                Save
                            </button>
                        </div>
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
                                <p className="mt-1 text-sm text-stone-500">Set up a new account and choose a starting password.</p>
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
                                <label htmlFor="c-password" className="block text-sm font-medium text-stone-700">Password</label>
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
                            <div className="space-y-1.5">
                                <label htmlFor="c-quota" className="block text-sm font-medium text-stone-700">Storage limit</label>
                                <div className="flex gap-2">
                                    <input id="c-quota" type="text" inputMode="decimal" value={cQuota} onChange={e => { setCQuota(e.target.value); setCreateError(null) }} disabled={creating} className={`${INPUT} flex-1`} />
                                    <select value={cUnit} onChange={e => setCUnit(e.target.value as QuotaUnit)} disabled={creating} aria-label="Unit" className="h-10 shrink-0 rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-900 shadow-sm outline-none transition focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 disabled:opacity-60">
                                        <option value="MB">MB</option>
                                        <option value="GB">GB</option>
                                        <option value="TB">TB</option>
                                    </select>
                                </div>
                                <p className="text-xs text-stone-400">You can change this anytime.</p>
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