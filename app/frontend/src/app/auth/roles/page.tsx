// dropicture/app/frontend/src/app/auth/roles/page.tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import { TbDots, TbLock, TbPencil, TbPlus, TbShieldCheck, TbTrash, TbX } from 'react-icons/tb'

type Role = {
    id: string
    name: string
    scopes: string[]
    members: number
    system: boolean
    lastUpdatedBy: string
    lastUpdate: string
    createdAt: string
}

const SCOPE_GROUPS: { group: string; scopes: { value: string; label: string }[] }[] = [
    {
        group: 'Accounts', scopes: [
            { value: 'accounts.read', label: 'View accounts' },
            { value: 'accounts.write', label: 'Manage accounts' },
        ]
    },
    {
        group: 'Roles', scopes: [
            { value: 'roles.read', label: 'View roles' },
            { value: 'roles.write', label: 'Manage roles' },
        ]
    },
    {
        group: 'Moderation', scopes: [
            { value: 'moderation.read', label: 'View reports' },
            { value: 'moderation.write', label: 'Act on reports' },
        ]
    },
    {
        group: 'Instance', scopes: [
            { value: 'system.read', label: 'View instance health' },
        ]
    },
]

const ROLE_ERRORS: Record<string, string> = {
    MISSING_FIELDS: 'Please enter a role name.',
    INVALID_ROLE_NAME: 'Use 2–50 characters: letters, numbers, spaces, hyphens or underscores.',
    INVALID_SCOPE: 'One of the selected permissions is invalid.',
    ROLE_NAME_TAKEN: 'A role with this name already exists.',
    ROLE_PROTECTED: "This is a system role and can't be edited or deleted.",
    ROLE_HAS_MEMBERS: 'Remove all members from this role before deleting it.',
    ROLE_NOT_FOUND: 'This role no longer exists.',
}

const BADGE_NEUTRAL =
    'inline-flex items-center gap-1 rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-xs font-medium text-stone-600'
const CHIP =
    'inline-flex items-center rounded-md border border-stone-200 bg-stone-50 px-1.5 py-0.5 font-mono text-[11px] text-stone-500'
const BTN_PRIMARY =
    'inline-flex h-9 items-center justify-center gap-2 rounded-full bg-stone-900 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-stone-700 disabled:pointer-events-none disabled:opacity-60'
const BTN_SECONDARY =
    'inline-flex h-9 items-center justify-center gap-2 rounded-full border border-stone-200 bg-white px-4 text-sm font-medium text-stone-700 shadow-sm transition-colors hover:border-stone-300 hover:text-stone-900'
const BTN_PAGE =
    'inline-flex h-8 items-center justify-center gap-1 rounded-full border border-stone-200 bg-white px-3 text-sm font-medium text-stone-700 shadow-sm transition-colors hover:border-stone-300 hover:text-stone-900'
const INPUT =
    'h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-900 placeholder:text-stone-400 outline-none transition focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 disabled:opacity-60'
const MENU_ITEM =
    'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900'
const MENU_ITEM_DANGER =
    'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 disabled:pointer-events-none disabled:opacity-40'

export default function RolesPage() {
    const [roles, setRoles] = useState<Role[] | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [actionError, setActionError] = useState<string | null>(null)
    const [reloadKey, setReloadKey] = useState(0)

    const [openMenu, setOpenMenu] = useState<string | null>(null)
    const [busyId, setBusyId] = useState<string | null>(null)

    const [showModal, setShowModal] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [mName, setMName] = useState('')
    const [mScopes, setMScopes] = useState<Set<string>>(new Set())
    const [saving, setSaving] = useState(false)
    const [modalError, setModalError] = useState<string | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        setError(null)
        setActionError(null)
        try {
            const res = await fetch('/api/roles', { credentials: 'same-origin' })
            if (res.status === 403) {
                setRoles(null)
                setError("You don't have permission to view roles.")
                return
            }
            if (!res.ok) {
                setRoles(null)
                setError('Could not load roles. Please try again.')
                return
            }
            const data = await res.json()
            setRoles(data.items as Role[])
        } catch {
            setRoles(null)
            setError('Could not load roles. Please try again.')
        } finally {
            setLoading(false)
        }
    }, [reloadKey])

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
        if (!showModal) return
        const prev = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeModal()
        }
        window.addEventListener('keydown', onKey)
        return () => {
            document.body.style.overflow = prev
            window.removeEventListener('keydown', onKey)
        }
    }, [showModal])

    function openCreate() {
        setEditingId(null)
        setMName('')
        setMScopes(new Set())
        setModalError(null)
        setShowModal(true)
    }

    function openEdit(role: Role) {
        setOpenMenu(null)
        setEditingId(role.id)
        setMName(role.name)
        setMScopes(new Set(role.scopes))
        setModalError(null)
        setShowModal(true)
    }

    function closeModal() {
        if (saving) return
        setShowModal(false)
        setEditingId(null)
        setMName('')
        setMScopes(new Set())
        setModalError(null)
    }

    function toggleScope(value: string) {
        setMScopes(prev => {
            const next = new Set(prev)
            if (next.has(value)) next.delete(value)
            else next.add(value)
            return next
        })
        setModalError(null)
    }

    async function save(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        const name = mName.trim()
        if (saving || name.length < 2) return
        setSaving(true)
        setModalError(null)
        try {
            const payload = { name, scopes: Array.from(mScopes) }
            const res = await fetch(editingId ? `/api/roles/${editingId}` : '/api/roles', {
                method: editingId ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            if (res.ok) {
                setShowModal(false)
                setEditingId(null)
                setMName('')
                setMScopes(new Set())
                setReloadKey(k => k + 1)
                return
            }
            const body = await res.json().catch(() => null)
            const code = body?.code ?? (Array.isArray(body?.message) ? body.message[0] : body?.message)
            setModalError(ROLE_ERRORS[code] ?? 'Something went wrong. Please try again.')
        } catch {
            setModalError('Something went wrong. Please try again.')
        } finally {
            setSaving(false)
        }
    }

    async function remove(role: Role) {
        if (!window.confirm(`Delete the “${role.name}” role? This cannot be undone.`)) return
        setOpenMenu(null)
        setBusyId(role.id)
        setActionError(null)
        try {
            const res = await fetch(`/api/roles/${role.id}`, { method: 'DELETE' })
            if (!res.ok) {
                const body = await res.json().catch(() => null)
                const code = body?.code ?? (Array.isArray(body?.message) ? body.message[0] : body?.message)
                setActionError(ROLE_ERRORS[code] ?? 'That role could not be deleted.')
                return
            }
            setReloadKey(k => k + 1)
        } catch {
            setActionError('That role could not be deleted.')
        } finally {
            setBusyId(null)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Roles</h1>
                    <p className="mt-1 text-sm text-stone-500">
                        {roles ? `${roles.length} ${roles.length === 1 ? 'role' : 'roles'}` : '\u00A0'}
                    </p>
                </div>
                <button className={BTN_PRIMARY} onClick={openCreate}>
                    <TbPlus className="size-4" />
                    New role
                </button>
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
            ) : loading && !roles ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-44 animate-pulse rounded-2xl bg-stone-100" aria-hidden />
                    ))}
                </div>
            ) : roles && roles.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {roles.map(role => (
                        <div key={role.id} className={`flex flex-col rounded-2xl border border-stone-200/70 bg-white p-5 shadow-sm transition-opacity ${busyId === role.id ? 'opacity-50' : ''}`}>
                            <div className="flex items-start justify-between gap-2">
                                <span className="flex size-9 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-700 shadow-sm">
                                    <TbShieldCheck className="size-5" strokeWidth={1.5} />
                                </span>
                                {role.system ? (
                                    <span title="System role" className="inline-flex size-8 items-center justify-center text-stone-300">
                                        <TbLock className="size-4" />
                                    </span>
                                ) : (
                                    <div className="relative">
                                        <button
                                            aria-label="Role actions"
                                            disabled={busyId === role.id}
                                            onClick={e => {
                                                e.stopPropagation()
                                                setOpenMenu(openMenu === role.id ? null : role.id)
                                            }}
                                            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 disabled:opacity-50"
                                        >
                                            <TbDots className="size-4" />
                                        </button>
                                        {openMenu === role.id && (
                                            <div
                                                role="menu"
                                                onClick={e => e.stopPropagation()}
                                                className="absolute right-0 top-full z-20 mt-1 w-44 rounded-xl border border-stone-200/70 bg-white p-1.5 shadow-xl shadow-stone-900/8"
                                            >
                                                <button className={MENU_ITEM} onClick={() => openEdit(role)}>
                                                    <TbPencil className="size-4 text-stone-400" />
                                                    Edit
                                                </button>
                                                <div aria-hidden className="my-1 h-px bg-stone-200/70" />
                                                <button
                                                    className={MENU_ITEM_DANGER}
                                                    disabled={role.members > 0}
                                                    title={role.members > 0 ? 'Remove members first' : undefined}
                                                    onClick={() => remove(role)}
                                                >
                                                    <TbTrash className="size-4" />
                                                    Delete
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="mt-4 flex items-center gap-2">
                                <h2 className="text-sm font-semibold text-stone-900">{role.name}</h2>
                                {role.system && <span className={BADGE_NEUTRAL}>System</span>}
                            </div>
                            <div className="mt-2 flex flex-1 flex-wrap gap-1">
                                {role.scopes.length > 0 ? (
                                    role.scopes.map(s => (
                                        <span key={s} className={CHIP}>{s}</span>
                                    ))
                                ) : (
                                    <span className="text-sm text-stone-400">No permissions</span>
                                )}
                            </div>
                            <div className="mt-4 flex items-center gap-2 text-xs text-stone-400">
                                <span>{role.scopes.length} {role.scopes.length === 1 ? 'permission' : 'permissions'}</span>
                                <span aria-hidden>·</span>
                                <span>{role.members.toLocaleString()} {role.members === 1 ? 'member' : 'members'}</span>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="rounded-2xl border border-stone-200/70 bg-white px-6 py-12 text-center shadow-sm">
                    <p className="text-sm text-stone-500">No roles yet.</p>
                </div>
            )}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/20 p-4 backdrop-blur-sm sm:items-center">
                    <div aria-hidden className="absolute inset-0" onClick={closeModal} />
                    <form
                        onSubmit={save}
                        role="dialog"
                        aria-modal="true"
                        aria-label={editingId ? 'Edit role' : 'New role'}
                        className="relative w-full max-w-md rounded-2xl border border-stone-200/70 bg-white p-6 shadow-xl shadow-stone-900/10"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-base font-semibold tracking-tight text-stone-900">
                                    {editingId ? 'Edit role' : 'New role'}
                                </h2>
                                <p className="mt-1 text-sm text-stone-500">Name the role and choose what it can do.</p>
                            </div>
                            <button
                                type="button"
                                onClick={closeModal}
                                aria-label="Close"
                                className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-900"
                            >
                                <TbX className="size-4.5" />
                            </button>
                        </div>
                        <div className="mt-5 space-y-4">
                            <div className="space-y-1.5">
                                <label htmlFor="role-name" className="block text-sm font-medium text-stone-700">Name</label>
                                <input id="role-name" type="text" autoComplete="off" required maxLength={50} placeholder="e.g. Moderator" value={mName} onChange={e => { setMName(e.target.value); setModalError(null) }} disabled={saving} className={INPUT} />
                            </div>
                            <div className="space-y-2">
                                <span className="block text-sm font-medium text-stone-700">Permissions</span>
                                <div className="space-y-3 rounded-xl border border-stone-200/70 p-3">
                                    {SCOPE_GROUPS.map(group => (
                                        <div key={group.group}>
                                            <p className="mb-1.5 font-mono text-[11px] font-medium uppercase tracking-widest text-stone-400">{group.group}</p>
                                            <div className="space-y-1">
                                                {group.scopes.map(s => (
                                                    <label key={s.value} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1 transition-colors hover:bg-stone-50">
                                                        <input
                                                            type="checkbox"
                                                            checked={mScopes.has(s.value)}
                                                            onChange={() => toggleScope(s.value)}
                                                            disabled={saving}
                                                            className="size-4 shrink-0 rounded border-stone-300 text-stone-900 accent-stone-900"
                                                        />
                                                        <span className="text-sm text-stone-700">{s.label}</span>
                                                        <span className="ml-auto font-mono text-[11px] text-stone-400">{s.value}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {modalError && (
                                <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600">
                                    {modalError}
                                </div>
                            )}
                        </div>
                        <div className="mt-6 flex justify-end gap-3">
                            <button type="button" onClick={closeModal} disabled={saving} className={BTN_SECONDARY}>
                                Cancel
                            </button>
                            <button type="submit" disabled={mName.trim().length < 2 || saving} className={BTN_PRIMARY}>
                                {saving && (
                                    <svg viewBox="0 0 24 24" fill="none" className="size-4 animate-spin" aria-hidden="true">
                                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
                                        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                                    </svg>
                                )}
                                {editingId ? 'Save changes' : 'Create role'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    )
}