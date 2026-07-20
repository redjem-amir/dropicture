// dropicture/apps/website/src/components/PublicLayout.tsx
'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

const API = process.env.NEXT_PUBLIC_SAAS_BACKEND_URL;
const APP = process.env.NEXT_PUBLIC_SAAS_FRONTEND_URL;
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

const NAV = [
  { href: '/#profiles', label: 'Profils' },
  { href: '/#explore', label: 'Explorer' },
  { href: '/#how', label: 'Comment ça marche' },
  { href: '/#security', label: 'Sécurité' },
];

const initials = (name: string, username: string) =>
  (name.trim().charAt(0) || username.charAt(0) || '?').toUpperCase();

export default function PublicLayout({ children }: { children: ReactNode }) {
  const [term, setTerm] = useState('');
  const [fetched, setFetched] = useState<{ q: string; profiles: Suggestion[] } | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();

  const q = term.trim();
  const results = q && fetched?.q === q ? fetched.profiles : [];
  const loading = !!q && fetched?.q !== q;

  useEffect(() => {
    if (!q) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`${API}/api/public/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : { profiles: [] }))
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
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  const go = (username: string) => {
    setOpen(false);
    setTerm('');
    window.location.href = `/u/?u=${encodeURIComponent(username)}`;
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
      if (chosen) go(chosen.username);
      else if (q) go(q.replace(/^@/, ''));
    }
  };

  const showPanel = open && !!q;

  return (
    <div className="flex min-h-dvh flex-col bg-white text-[#171717]">
      <header className="sticky top-0 z-40 border-b border-[#EAEAEA] bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link href="/" className="shrink-0 text-[15px] font-semibold tracking-[-0.03em]">
            dropicture
          </Link>
          <nav className="ml-2 hidden items-center gap-1 lg:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-2.5 py-1.5 text-[13px] text-[#666] transition hover:bg-[#FAFAFA] hover:text-[#171717]"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div ref={box} className="relative ml-auto w-full max-w-xs">
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
                className="h-9 w-full rounded-lg border border-[#EAEAEA] bg-white pl-8 pr-8 text-[13px] outline-none transition placeholder:text-[#A1A1A1] focus:border-[#171717] focus:ring-4 focus:ring-[#171717]/8"
              />
              {loading && (
                <span
                  aria-hidden
                  className="absolute right-2.5 top-1/2 size-3 -translate-y-1/2 animate-spin rounded-full border-2 border-[#EAEAEA] border-t-[#171717]"
                />
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
                {results.map((p, i) => (
                  <button
                    key={p.username}
                    type="button"
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === active}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(p.username)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition ${i === active ? 'bg-[#FAFAFA]' : ''
                      }`}
                  >
                    {p.avatar ? (
                      <img
                        src={p.avatar.url}
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
                        {initials(p.name, p.username)}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-[#171717]">
                        {p.name}
                      </span>
                      <span className="block truncate font-mono text-[11px] text-[#8F8F8F]">
                        @{p.username}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-[10px] tabular-nums text-[#A1A1A1]">
                      {p.photos}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Link
            href={`${APP}/signin`}
            className="hidden h-9 shrink-0 items-center rounded-lg px-3 text-[13px] font-medium text-[#666] transition hover:text-[#171717] sm:inline-flex"
          >
            Se connecter
          </Link>
          <Link
            href={`${APP}/signup`}
            className="inline-flex h-9 shrink-0 items-center rounded-lg bg-[#171717] px-3 text-[13px] font-medium text-white transition hover:bg-[#383838]"
          >
            Créer un compte
          </Link>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-[#EAEAEA] bg-[#FAFAFA]/60">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-8 sm:px-6">
          <p className="text-[13px] font-semibold tracking-[-0.02em]">dropicture</p>
          <p className="text-[12px] text-[#8F8F8F]">
            Bibliothèque privée, vitrine publique. Hébergé en Union européenne.
          </p>
          <nav className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-[#666]">
            <Link href="/legal/" className="transition hover:text-[#171717]">
              Mentions légales
            </Link>
            <Link href="/privacy/" className="transition hover:text-[#171717]">
              Confidentialité
            </Link>
            <Link href="/terms/" className="transition hover:text-[#171717]">
              Conditions
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}