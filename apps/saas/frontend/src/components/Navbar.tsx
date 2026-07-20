// dropicture/apps/saas/frontend/src/components/Navbar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? '';
const SITE = process.env.NEXT_PUBLIC_WEBSITE_URL ?? 'https://dropicture.com';
const DEBOUNCE_MS = 180;

type MediaView = {
  id: string;
  kind: 'image' | 'video';
  width: number | null;
  height: number | null;
  durationMs: number | null;
  url: string;
};

type Suggestion = {
  username: string;
  name: string;
  bio: string | null;
  avatar: MediaView | null;
  photos: number;
};

type Me = { username: string; firstname: string; lastname: string; avatar: MediaView | null };

const LINKS = [
  { href: '/auth', label: 'Fil' },
  { href: '/auth/library', label: 'Bibliothèque' },
  { href: '/auth/profile', label: 'Vitrine' },
] as const;

const initials = (name: string, username: string) =>
  (name.trim().charAt(0) || username.charAt(0) || '?').toUpperCase();

export default function Navbar() {
  const pathname = usePathname();

  const [me, setMe] = useState<Me | null>(null);
  const [menu, setMenu] = useState(false);

  const [term, setTerm] = useState('');

  const [fetched, setFetched] = useState<{ q: string; profiles: Suggestion[] } | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const searchBox = useRef<HTMLDivElement>(null);
  const menuBox = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();

  const q = term.trim();
  const results = q && fetched?.q === q ? fetched.profiles : [];
  const loading = !!q && fetched?.q !== q;

  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
    setMenu(false);
  }

  useEffect(() => {
    fetch(`${API}/api/profile`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => p && setMe(p))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!q) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`${API}/api/public/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : { profiles: [] }))
        .then((data: { profiles: Suggestion[] }) => {
          setFetched({ q, profiles: data.profiles ?? [] });
          setActive(-1);
        })
        .catch(() => {
          if (!controller.signal.aborted) setFetched({ q, profiles: [] });
        });
    }, DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [q]);

  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      if (!searchBox.current?.contains(e.target as Node)) setOpen(false);
      if (!menuBox.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, []);

  const go = (s: Suggestion) => {
    setOpen(false);
    setTerm('');
    if (me && s.username === me.username) window.location.href = '/auth/profile';
    else window.open(`${SITE}/u/?u=${encodeURIComponent(s.username)}`, '_blank', 'noopener');
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false);
      input.current?.blur();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(results.length - 1, i + 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(-1, i - 1));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const chosen = results[active] ?? results[0];
      if (chosen) go(chosen);
    }
  };

  const signout = async () => {
    await fetch(`${API}/api/auth/signout`, { method: 'POST', credentials: 'include' }).catch(
      () => undefined,
    );
    window.location.href = '/signin';
  };

  const showPanel = open && !!q;
  const name = me ? `${me.firstname} ${me.lastname}`.trim() : '';

  return (
    <header className="sticky top-0 z-40 border-b border-[#EAEAEA] bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Link href="/auth" className="shrink-0 text-[15px] font-semibold tracking-[-0.03em]">
          dropicture
        </Link>
        <nav className="ml-2 flex items-center gap-0.5">
          {LINKS.map((l) => {
            const on = l.href === '/auth' ? pathname === '/auth' : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={on ? 'page' : undefined}
                className={`rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition ${on ? 'bg-[#F4F4F5] text-[#171717]' : 'text-[#8F8F8F] hover:text-[#171717]'
                  }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div ref={searchBox} className="relative ml-auto w-full max-w-xs">
          <div className="relative">
            <svg
              aria-hidden
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#A1A1A1]"
            >
              <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
              <path d="m16 16 4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <input
              ref={input}
              type="search"
              role="combobox"
              aria-expanded={showPanel}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
              value={term}
              onChange={(e) => {
                setTerm(e.target.value);
                setActive(-1);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={onKeyDown}
              maxLength={30}
              placeholder="Chercher un compte"
              className="h-9 w-full rounded-lg border border-[#EAEAEA] bg-white pl-8 pr-9 text-[13px] outline-none transition placeholder:text-[#A1A1A1] focus:border-[#171717] focus:ring-4 focus:ring-[#171717]/8"
            />
            {loading ? (
              <span
                aria-hidden
                className="absolute right-2.5 top-1/2 size-3 -translate-y-1/2 animate-spin rounded-full border-2 border-[#EAEAEA] border-t-[#171717]"
              />
            ) : (
              !term && (
                <kbd
                  aria-hidden
                  className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-[#EAEAEA] bg-[#FAFAFA] px-1.5 font-mono text-[10px] leading-4 text-[#A1A1A1] sm:block"
                >
                  /
                </kbd>
              )
            )}
          </div>
          {showPanel && (
            <div
              id={listId}
              role="listbox"
              className="absolute inset-x-0 top-11 overflow-hidden rounded-xl border border-[#EAEAEA] bg-white/95 p-1 shadow-[0_1px_2px_rgba(9,9,11,0.04),0_16px_40px_-16px_rgba(9,9,11,0.22)] backdrop-blur-xl"
            >
              {results.length === 0 && !loading && (
                <p className="px-3 py-3 text-[13px] text-[#8F8F8F]">
                  Aucun compte ne correspond à «&nbsp;{q}&nbsp;».
                </p>
              )}
              {results.map((s, i) => {
                const self = me?.username === s.username;
                return (
                  <button
                    key={s.username}
                    type="button"
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === active}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(s)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition ${i === active ? 'bg-[#FAFAFA]' : ''
                      }`}
                  >
                    {s.avatar ? (
                      <img
                        src={s.avatar.url}
                        alt=""
                        width={32}
                        height={32}
                        className="size-8 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="grid size-8 shrink-0 place-items-center rounded-full bg-[#171717] font-mono text-[11px] font-medium text-white"
                      >
                        {initials(s.name, s.username)}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 truncate text-[13px] font-medium text-[#171717]">
                        <span className="truncate">{s.name}</span>
                        {self && (
                          <span className="shrink-0 rounded bg-[#171717] px-1 py-px font-mono text-[9px] uppercase tracking-widest text-white">
                            toi
                          </span>
                        )}
                      </span>
                      <span className="block truncate font-mono text-[11px] text-[#8F8F8F]">
                        @{s.username} · {s.photos} en vitrine
                      </span>
                    </span>
                    {!self && (
                      <svg
                        aria-hidden
                        width="11"
                        height="11"
                        viewBox="0 0 24 24"
                        fill="none"
                        className="shrink-0 text-[#A1A1A1]"
                      >
                        <path d="M7 17 17 7M9 7h8v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div ref={menuBox} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenu((v) => !v)}
            aria-expanded={menu}
            aria-haspopup="menu"
            aria-label="Menu du compte"
            className="grid size-9 place-items-center overflow-hidden rounded-full border border-[#EAEAEA] bg-white transition hover:border-[#D4D4D4]"
          >
            {me?.avatar ? (
              <img src={me.avatar.url} alt="" className="size-full object-cover" />
            ) : (
              <span aria-hidden className="font-mono text-[11px] font-medium text-[#171717]">
                {me ? initials(name, me.username) : '·'}
              </span>
            )}
          </button>
          {menu && (
            <div
              role="menu"
              className="absolute right-0 top-11 w-56 overflow-hidden rounded-xl border border-[#EAEAEA] bg-white/95 p-1 shadow-[0_1px_2px_rgba(9,9,11,0.04),0_16px_40px_-16px_rgba(9,9,11,0.22)] backdrop-blur-xl"
            >
              {me && (
                <div className="px-2 py-2">
                  <p className="truncate text-[13px] font-medium text-[#171717]">{name}</p>
                  <p className="truncate font-mono text-[11px] text-[#8F8F8F]">@{me.username}</p>
                </div>
              )}
              <span aria-hidden className="mx-2 block h-px bg-[#EAEAEA]" />
              <Link
                href="/auth/profile"
                role="menuitem"
                onClick={() => setMenu(false)}
                className="block rounded-lg px-2 py-2 text-[13px] text-[#171717] transition hover:bg-[#FAFAFA]"
              >
                Ma vitrine
              </Link>
              <Link
                href="/auth/settings"
                role="menuitem"
                onClick={() => setMenu(false)}
                className="block rounded-lg px-2 py-2 text-[13px] text-[#171717] transition hover:bg-[#FAFAFA]"
              >
                Réglages
              </Link>
              {me && (
                <Link
                  href={`${SITE}/u/?u=${encodeURIComponent(me.username)}`}
                  target="_blank"
                  rel="noreferrer"
                  role="menuitem"
                  onClick={() => setMenu(false)}
                  className="flex items-center justify-between rounded-lg px-2 py-2 text-[13px] text-[#171717] transition hover:bg-[#FAFAFA]"
                >
                  Voir ma page publique
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden className="text-[#A1A1A1]">
                    <path d="M7 17 17 7M9 7h8v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              )}
              <span aria-hidden className="mx-2 block h-px bg-[#EAEAEA]" />
              <button
                type="button"
                role="menuitem"
                onClick={signout}
                className="block w-full rounded-lg px-2 py-2 text-left text-[13px] text-[#E5484D] transition hover:bg-[#FEF2F2]"
              >
                Se déconnecter
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}