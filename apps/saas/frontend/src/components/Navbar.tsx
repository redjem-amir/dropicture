// dropicture/apps/saas/frontend/src/components/Navbar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { useUser } from '@/components/UserProvider';

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const SITE = 'https://dropicture.com';

type NavItem = { href: string; label: string; exact?: boolean };

const NAV: NavItem[] = [
  { href: '/auth', label: 'Fil', exact: true },
  { href: '/auth/library', label: 'Bibliothèque' },
  { href: '/auth/profile', label: 'Vitrine' },
];

const QUOTA = { used: 42.7, total: 200 };
const HANDLE = 'marie.frames';

export default function Navbar() {
  const pathname = usePathname();
  const calm = useReducedMotion() === true;
  const { user, isLoading, logout } = useUser();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const initials = `${user?.firstname?.[0] ?? ''}${user?.lastname?.[0] ?? ''}`.toUpperCase() || '?';
  const pct = Math.min(100, Math.round((QUOTA.used / QUOTA.total) * 100));
  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <header className="z-30 shrink-0 border-b border-[#EAEAEA] bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Link
          href="/app"
          className="group -mx-2 flex shrink-0 items-center gap-2.5 rounded-lg px-2 py-1.5 outline-none transition hover:bg-[#FAFAFA] focus-visible:ring-4 focus-visible:ring-[#171717]/15"
        >
          <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden className="shrink-0 text-[#171717]">
            <rect x="1.85" y="1.85" width="12.3" height="12.3" rx="3.7" stroke="currentColor" strokeWidth="1.5" />
            <rect
              x="5.35" y="5.35" width="5.3" height="5.3" rx="1.2"
              fill="currentColor" transform="rotate(45 8 8)"
              className="origin-center transition-transform duration-500 ease-out group-hover:rotate-90"
            />
          </svg>
          <span className="hidden text-[14px] font-semibold tracking-[-0.02em] text-[#171717] sm:block">
            Dropicture
          </span>
        </Link>
        <nav className="ml-2 flex min-w-0 items-center gap-0.5 overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={isActive(n.href, n.exact) ? 'page' : undefined}
              className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[13px] transition ${isActive(n.href, n.exact)
                ? 'bg-[#F4F4F5] font-medium text-[#171717]'
                : 'text-[#666] hover:bg-[#FAFAFA] hover:text-[#171717]'
                }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/auth/library"
          className="ml-auto hidden h-9 shrink-0 items-center gap-2 rounded-lg bg-[#171717] px-3 text-[13px] font-medium text-white transition hover:bg-[#383838] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#171717]/20 sm:inline-flex"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M12 15.5V4.5M8 8.5 12 4.5l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4.5 15v3.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          Déposer
        </Link>
        <div ref={menuRef} className="relative ml-auto shrink-0 sm:ml-0">
          {isLoading || !user ? (
            <div className="size-8 animate-pulse rounded-full bg-[#F4F4F5]" />
          ) : (
            <>
              <button
                ref={triggerRef}
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-haspopup="menu"
                aria-label={`Compte de ${user.firstname} ${user.lastname}`}
                className="grid size-8 place-items-center rounded-full bg-[#171717] font-mono text-[10px] font-medium text-white outline-none transition hover:bg-[#383838] focus-visible:ring-4 focus-visible:ring-[#171717]/20"
              >
                {initials}
              </button>
              <AnimatePresence>
                {open && (
                  <motion.div
                    role="menu"
                    initial={{ opacity: 0, y: -4, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.98 }}
                    transition={{ duration: calm ? 0 : 0.14, ease: EASE }}
                    className="absolute right-0 top-full z-50 mt-2 w-68 origin-top-right overflow-hidden rounded-xl border border-[#EAEAEA] bg-white p-1 shadow-[0_1px_2px_rgba(9,9,11,0.04),0_16px_40px_-16px_rgba(9,9,11,0.18)]"
                  >
                    <div className="flex items-center gap-3 px-3 py-3">
                      <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-[#171717] font-mono text-[12px] font-medium text-white">
                        {initials}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-[#171717]">
                          {user.firstname} {user.lastname}
                        </p>
                        <p className="truncate font-mono text-[11px] text-[#8F8F8F]">@{HANDLE}</p>
                      </div>
                    </div>
                    <div className="px-3 pb-3">
                      <div className="h-1 w-full overflow-hidden rounded-full bg-[#F4F4F5]">
                        <div
                          className={`h-full rounded-full ${pct > 90 ? 'bg-[#E5484D]' : 'bg-[#171717]'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="mt-1.5 flex items-center justify-between font-mono text-[10px] tabular-nums text-[#A1A1A1]">
                        <span>{QUOTA.used} Go sur {QUOTA.total} Go</span>
                        <span className="text-[#171717]">{pct} %</span>
                      </p>
                    </div>
                    <div className="mx-1 h-px bg-[#EAEAEA]" />
                    <div className="pt-1">
                      <Link
                        href="/auth/settings"
                        role="menuitem"
                        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-[#666] transition hover:bg-[#FAFAFA] hover:text-[#171717]"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden className="text-[#A1A1A1]">
                          <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.7" />
                          <path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M18 6l-1.6 1.6M7.6 16.4 6 18M18 18l-1.6-1.6M7.6 7.6 6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                        </svg>
                        Réglages
                      </Link>
                      <Link
                        href={`${SITE}/@${HANDLE}`}
                        target="_blank"
                        rel="noreferrer"
                        role="menuitem"
                        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-[#666] transition hover:bg-[#FAFAFA] hover:text-[#171717]"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden className="text-[#A1A1A1]">
                          <circle cx="12" cy="12" r="8.6" stroke="currentColor" strokeWidth="1.6" />
                          <path d="M3.4 12h17.2M12 3.4a15 15 0 0 1 0 17.2M12 3.4a15 15 0 0 0 0 17.2" stroke="currentColor" strokeWidth="1.6" />
                        </svg>
                        Voir ma page publique
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden className="ml-auto text-[#D4D4D8]">
                          <path d="M7 17 17 7M9 7h8v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </Link>
                      <div className="mx-2 my-1 h-px bg-[#EAEAEA]" />
                      <button
                        type="button"
                        role="menuitem"
                        onClick={logout}
                        className="group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] text-[#666] transition hover:bg-[#FEF2F2] hover:text-[#E5484D]"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden className="text-[#A1A1A1] transition-colors group-hover:text-[#E5484D]">
                          <path d="M9.5 21H5.5A2 2 0 0 1 3.5 19V5a2 2 0 0 1 2-2h4M16 16.5l4.5-4.5L16 7.5M20.5 12H9.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Se déconnecter
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </div>
    </header>
  );
}