// dropicture/app/frontend/src/components/LayoutPrivate.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import Avvvatars from 'avvvatars-react'
import { TbChevronDown, TbLogout, TbMenu2, TbX } from 'react-icons/tb'
import { ROUTE_ACCESS, isRoute, type RouteItem } from '@/lib/routeAccess'
import { hasScope } from '@/lib/scopes'
import { useUser, type UserProfile } from '@/components/UserProvider'

const APP_PATH = '/auth'

type NavRoute = Extract<RouteItem, { type: 'route' }> & { href: string }
type NavGroup = { label: string | null; routes: NavRoute[] }

function buildNavGroups(scope: string | undefined): NavGroup[] {
    const groups: NavGroup[] = []
    let current: NavGroup = { label: null, routes: [] }
    for (const item of ROUTE_ACCESS) {
        if (item.type === 'section') {
            if (current.routes.length > 0) groups.push(current)
            current = { label: item.nav?.label?.trim() || null, routes: [] }
            continue
        }
        if (!isRoute(item) || !item.nav) continue
        if (!hasScope(scope, item.scopes)) continue
        current.routes.push({
            ...item,
            href: item.path === '/' ? APP_PATH : APP_PATH + item.path,
        })
    }
    if (current.routes.length > 0) groups.push(current)
    return groups
}

function isActive(pathname: string, href: string): boolean {
    if (href === APP_PATH) return pathname === APP_PATH
    return pathname === href || pathname.startsWith(href + '/')
}

function initials(user: UserProfile): string {
    return `${user.firstname?.[0] ?? ''}${user.lastname?.[0] ?? ''}`.toUpperCase() || '?'
}

function UserAvatar({ user, size }: { user: UserProfile; size: number }) {
    return (
        <span className="shrink-0" style={{ width: size, height: size }}>
            <Avvvatars
                value={user.email}
                displayValue={initials(user)}
                style="shape"
                size={size}
            />
        </span>
    )
}

function BrandMark() {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-5"
            aria-hidden="true"
        >
            <circle cx="12" cy="12" r="10" />
            <path d="M14.31 8l5.74 9.94M9.69 8h11.48M7.38 12l5.74-9.94M9.69 16L3.95 6.06M14.31 16H2.83M16.62 12l-5.74 9.94" />
        </svg>
    )
}

function NavPill({
    route,
    pathname,
    onNavigate,
}: {
    route: NavRoute
    pathname: string
    onNavigate?: () => void
}) {
    const active = isActive(pathname, route.href)
    const Icon = route.nav?.icon
    return (
        <Link
            href={route.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={
                'group flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ' +
                (active
                    ? 'bg-stone-100 text-stone-900'
                    : 'text-stone-500 hover:bg-stone-100 hover:text-stone-900')
            }
        >
            {Icon && (
                <Icon
                    className={
                        'size-4 shrink-0 transition-colors ' +
                        (active ? 'text-stone-700' : 'text-stone-400 group-hover:text-stone-600')
                    }
                />
            )}
            <span className="truncate">{route.nav?.label}</span>
        </Link>
    )
}

export default function LayoutPrivate({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const { user, isLoading, logout } = useUser()
    const groups = useMemo(() => buildNavGroups(user?.scope), [user?.scope])

    const [mobileOpen, setMobileOpen] = useState(false)
    const [userMenuOpen, setUserMenuOpen] = useState(false)
    const userMenuRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        setMobileOpen(false)
        setUserMenuOpen(false)
    }, [pathname])

    useEffect(() => {
        if (!mobileOpen && !userMenuOpen) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setMobileOpen(false)
                setUserMenuOpen(false)
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [mobileOpen, userMenuOpen])

    useEffect(() => {
        if (!userMenuOpen) return
        const onDown = (e: MouseEvent) => {
            if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
                setUserMenuOpen(false)
            }
        }
        document.addEventListener('mousedown', onDown)
        return () => document.removeEventListener('mousedown', onDown)
    }, [userMenuOpen])

    return (
        <div className="flex min-h-dvh flex-col bg-stone-50">
            <header className="sticky top-0 z-40 border-b border-stone-200/70 bg-white/80 backdrop-blur-sm">
                <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
                    <Link
                        href={APP_PATH}
                        className="inline-flex shrink-0 items-center gap-2 text-stone-900 transition-opacity hover:opacity-80"
                    >
                        <BrandMark />
                        <span className="hidden text-sm font-semibold tracking-tight sm:block">
                            Dropicture
                        </span>
                    </Link>
                    <nav aria-label="Main navigation" className="ml-4 hidden items-center gap-1 lg:flex">
                        {isLoading && !user ? (
                            <div className="flex items-center gap-2" aria-hidden>
                                {[0, 1, 2].map(i => (
                                    <div key={i} className="h-8 w-24 animate-pulse rounded-full bg-stone-100" />
                                ))}
                            </div>
                        ) : (
                            groups.map((group, gi) => (
                                <Fragment key={gi}>
                                    {gi > 0 && (
                                        <span aria-hidden className="mx-2 h-4 w-px shrink-0 bg-stone-200" />
                                    )}
                                    {group.routes.map(route => (
                                        <NavPill key={route.href} route={route} pathname={pathname} />
                                    ))}
                                </Fragment>
                            ))
                        )}
                    </nav>
                    <div className="ml-auto" />
                    {isLoading && !user ? (
                        <div className="flex items-center gap-2.5" aria-hidden>
                            <div className="size-8 animate-pulse rounded-full bg-stone-100" />
                            <div className="hidden space-y-1.5 md:block">
                                <div className="h-3 w-24 animate-pulse rounded bg-stone-100" />
                                <div className="h-2.5 w-32 animate-pulse rounded bg-stone-100" />
                            </div>
                        </div>
                    ) : user ? (
                        <div ref={userMenuRef} className="relative">
                            <button
                                type="button"
                                onClick={() => setUserMenuOpen(v => !v)}
                                aria-haspopup="menu"
                                aria-expanded={userMenuOpen}
                                className={
                                    'flex items-center gap-2.5 rounded-full p-1 pr-2 transition-colors hover:bg-stone-100 ' +
                                    (userMenuOpen ? 'bg-stone-100' : '')
                                }
                            >
                                <UserAvatar user={user} size={32} />
                                <span className="hidden min-w-0 flex-col items-start text-left md:flex">
                                    <span className="max-w-40 truncate text-sm font-medium leading-tight text-stone-900">
                                        {user.firstname} {user.lastname}
                                    </span>
                                    <span className="max-w-40 truncate text-xs leading-tight text-stone-400">
                                        {user.email}
                                    </span>
                                </span>
                                <TbChevronDown
                                    className={
                                        'size-3.5 shrink-0 text-stone-400 transition-transform ' +
                                        (userMenuOpen ? 'rotate-180' : '')
                                    }
                                />
                            </button>
                            {userMenuOpen && (
                                <div
                                    role="menu"
                                    className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-stone-200/70 bg-white p-1.5 shadow-xl shadow-stone-900/8"
                                >
                                    <div className="flex items-center gap-2.5 px-2.5 py-2">
                                        <UserAvatar user={user} size={40} />
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium text-stone-900">
                                                {user.firstname} {user.lastname}
                                            </p>
                                            <p className="truncate text-xs text-stone-400">{user.email}</p>
                                        </div>
                                    </div>
                                    <div aria-hidden className="my-1 h-px bg-stone-200/70" />
                                    <button
                                        type="button"
                                        role="menuitem"
                                        onClick={logout}
                                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900"
                                    >
                                        <TbLogout className="size-4 text-stone-400" />
                                        Sign out
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : null}
                    <button
                        type="button"
                        onClick={() => setMobileOpen(v => !v)}
                        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
                        aria-expanded={mobileOpen}
                        aria-controls="mobile-nav"
                        className="flex size-9 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 shadow-sm transition-colors hover:border-stone-300 hover:text-stone-900 lg:hidden"
                    >
                        {mobileOpen ? <TbX className="size-4.5" /> : <TbMenu2 className="size-4.5" />}
                    </button>
                </div>
                {mobileOpen && (
                    <nav
                        id="mobile-nav"
                        aria-label="Main navigation"
                        className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-stone-200/70 bg-white/95 px-4 pb-4 pt-3 backdrop-blur-sm lg:hidden"
                    >
                        {groups.map((group, gi) => (
                            <div key={gi} className={gi > 0 ? 'mt-5' : ''}>
                                {group.label && (
                                    <p className="px-3 pb-2 font-mono text-[11px] font-medium uppercase tracking-widest text-stone-400">
                                        {group.label}
                                    </p>
                                )}
                                <ul className="space-y-1">
                                    {group.routes.map(route => (
                                        <li key={route.href}>
                                            <NavPill
                                                route={route}
                                                pathname={pathname}
                                                onNavigate={() => setMobileOpen(false)}
                                            />
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </nav>
                )}
            </header>
            <main className="flex-1">
                <div className="mx-auto w-full max-w-7xl p-4 sm:p-8">{children}</div>
            </main>
        </div>
    )
}