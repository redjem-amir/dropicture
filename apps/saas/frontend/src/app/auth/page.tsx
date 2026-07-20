// dropicture/apps/saas/frontend/src/app/auth/page.tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const SITE = 'https://dropicture.com';
const API = process.env.NEXT_PUBLIC_API_URL ?? '';
const PAGE_SIZE = 40;

type Scope = 'all' | 'following';

type MediaView = {
  id: string;
  kind: 'image' | 'video';
  width: number | null;
  height: number | null;
  durationMs: number | null;
  url: string;
};

type Author = {
  username: string;
  name: string;
  avatar: MediaView | null;
  following: boolean;
  self: boolean;
};

type Pin = MediaView & {
  publishedAt: string | null;
  mine: boolean;
  author: Author | null;
};

type Me = {
  publishedMedia: number;
  following: number;
  followers: number;
  community: { authors: number; media: number };
};

const ERRORS: Record<string, string> = {
  BAD_CURSOR: 'Pagination expirée. Recharge le fil.',
  ACCOUNT_NOT_FOUND: 'Ce compte n’existe plus.',
  CANNOT_FOLLOW_SELF: 'Tu ne peux pas te suivre toi-même.',
  UNKNOWN: 'Le fil n’a pas pu être chargé.',
};

const say = (e: unknown) => {
  const code = e instanceof Error ? e.message : 'UNKNOWN';
  return ERRORS[code] ?? ERRORS.UNKNOWN;
};

const clip = (ms: number | null) => {
  if (!ms) return null;
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const ago = (iso: string | null) => {
  if (!iso) return null;
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'à l’instant';
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  if (d < 31) return `il y a ${d} j`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
};

async function api<T>(path: string, method = 'GET'): Promise<T> {
  const res = await fetch(`${API}/api${path}`, { method, credentials: 'include' });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.code ?? 'UNKNOWN');
  }
  return res.json() as Promise<T>;
}

function Avatar({ author, size = 20 }: { author: Author; size?: number }) {
  if (author.avatar) {
    return (
      <img
        src={author.avatar.url}
        alt=""
        loading="lazy"
        decoding="async"
        style={{ width: size, height: size }}
        className="shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
      className="grid shrink-0 place-items-center rounded-full bg-white/20 font-mono font-medium text-white backdrop-blur"
    >
      {author.username.slice(0, 2).toUpperCase()}
    </span>
  );
}

export default function Page() {
  const calm = useReducedMotion() === true;

  const [scope, setScope] = useState<Scope>('all');
  const [pins, setPins] = useState<Pin[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const scroller = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);

  const flash = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((t) => (t === message ? null : t)), 3000);
  }, []);

  useEffect(() => {
    api<Me>('/discover/me').then(setMe).catch(() => undefined);
  }, []);

  const query = useCallback(
    (next?: string) => {
      const params = new URLSearchParams({ scope, limit: String(PAGE_SIZE) });
      if (next) params.set('cursor', next);
      return `/discover/feed?${params}`;
    },
    [scope],
  );

  const key = `${nonce}:${query()}`;
  const loading = loadedKey !== key;

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    requestId.current += 1;
    api<{ items: Pin[]; nextCursor: string | null }>(query())
      .then((page) => {
        if (cancelled) return;
        setPins(page.items);
        setCursor(page.nextCursor);
        setError(null);
        scroller.current?.scrollTo({ top: 0 });
      })
      .catch((err) => {
        if (cancelled) return;
        setPins([]);
        setCursor(null);
        setError(say(err));
      })
      .finally(() => {
        if (!cancelled) setLoadedKey(key);
      });
    return () => {
      cancelled = true;
    };
  }, [key, query]);

  const loadMore = useCallback(() => {
    if (!cursor || loadingMore) return;
    const id = requestId.current;
    setLoadingMore(true);
    api<{ items: Pin[]; nextCursor: string | null }>(query(cursor))
      .then((page) => {
        if (id !== requestId.current) return;
        setPins((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          return [...prev, ...page.items.filter((p) => !seen.has(p.id))];
        });
        setCursor(page.nextCursor);
      })
      .catch(() => undefined)
      .finally(() => setLoadingMore(false));
  }, [cursor, loadingMore, query]);

  useEffect(() => {
    const node = sentinel.current;
    const root = scroller.current;
    if (!node || !root || !cursor || loading) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { root, rootMargin: '900px 0px' },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [cursor, loading, loadMore]);

  useEffect(() => {
    const root = scroller.current;
    if (!root || !cursor || loading || loadingMore) return;
    if (root.scrollHeight <= root.clientHeight + 40) loadMore();
  }, [pins, cursor, loading, loadingMore, loadMore]);

  const goTo = useCallback(
    (next: number) => {
      if (!pins.length) return;
      const idx = Math.max(0, Math.min(pins.length - 1, next));
      setViewer(idx);
      if (idx >= pins.length - 3) loadMore();
    },
    [pins.length, loadMore],
  );

  useEffect(() => {
    if (viewer === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setViewer(null);
      if (e.key === 'ArrowRight') goTo(viewer + 1);
      if (e.key === 'ArrowLeft') goTo(viewer - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewer, goTo]);

  const toggleFollow = async (author: Author) => {
    if (author.self) return;
    const next = !author.following;
    const apply = (following: boolean) =>
      setPins((prev) =>
        prev.map((p) =>
          p.author?.username === author.username ? { ...p, author: { ...p.author, following } } : p,
        ),
      );
    apply(next);
    try {
      await api(`/discover/follows/${encodeURIComponent(author.username)}`, next ? 'POST' : 'DELETE');
      setMe((m) => (m ? { ...m, following: m.following + (next ? 1 : -1) } : m));
      flash(next ? `Tu suis @${author.username}` : `Tu ne suis plus @${author.username}`);
    } catch (err) {
      apply(!next);
      flash(say(err));
    }
  };

  const stage = { hidden: {}, show: { transition: { staggerChildren: calm ? 0 : 0.03 } } };
  const rise = {
    hidden: { opacity: calm ? 1 : 0, y: calm ? 0 : 10 },
    show: { opacity: 1, y: 0, transition: { duration: calm ? 0 : 0.4, ease: EASE } },
  };

  const pioneer = me !== null && me.community.authors <= 1;
  const empty = !loading && pins.length === 0 && !error;
  const mineEmpty = me !== null && me.publishedMedia === 0;
  const open = viewer !== null ? pins[viewer] ?? null : null;

  return (
    <div className="relative h-full">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-96 bg-[repeating-linear-gradient(to_right,rgba(9,9,11,0.05)_0_1px,transparent_1px_72px),repeating-linear-gradient(to_bottom,rgba(9,9,11,0.05)_0_1px,transparent_1px_72px)] mask-[radial-gradient(ellipse_80%_100%_at_50%_-10%,#000_30%,transparent_85%)]" />
      </div>
      <div ref={scroller} className="relative h-full overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
          <motion.header
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: calm ? 0 : 0.5, ease: EASE }}
            className="flex flex-wrap items-end justify-between gap-4"
          >
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#A1A1A1]">Public</p>
              <h1 className="mt-2 text-[26px] font-semibold leading-[1.15] tracking-[-0.035em]">
                {pioneer ? 'Le fil commence avec toi' : 'Le fil'}
              </h1>
              <p className="mt-1 text-[14px] leading-relaxed text-[#666]">
                Tout ce que les comptes ont mis en vitrine, du plus récent au plus ancien.
              </p>
              {me && me.community.media > 0 && (
                <p className="mt-1 font-mono text-[12px] tabular-nums text-[#8F8F8F]">
                  {me.community.media} média{me.community.media > 1 ? 's' : ''} ·{' '}
                  {me.community.authors} compte{me.community.authors > 1 ? 's' : ''} · tu suis{' '}
                  {me.following}
                </p>
              )}
            </div>
            <div className="flex items-center gap-0.5 rounded-lg border border-[#EAEAEA] bg-white p-0.5">
              {[
                { key: 'all' as const, label: 'Tout' },
                { key: 'following' as const, label: 'Suivis' },
              ].map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setScope(s.key)}
                  aria-pressed={scope === s.key}
                  className={`h-7 rounded-md px-2.5 text-[12px] font-medium transition ${scope === s.key ? 'bg-[#171717] text-white' : 'text-[#A1A1A1] hover:text-[#171717]'
                    }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </motion.header>
          {error && (
            <div className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-[#FCE8E8] bg-[#FEF2F2] px-3 py-2.5">
              <p className="flex-1 text-[12px] text-[#E5484D]">{error}</p>
              <button
                type="button"
                onClick={reload}
                className="h-7 rounded-md border border-[#FCE8E8] bg-white px-2.5 text-[12px] font-medium text-[#E5484D] transition hover:border-[#E5484D]"
              >
                Réessayer
              </button>
            </div>
          )}
          {loading && (
            <div className="mt-6 columns-2 gap-3 sm:columns-3 lg:columns-4 xl:columns-5">
              {[64, 44, 56, 36, 52, 40, 60, 48, 44, 56, 38, 50].map((h, i) => (
                <div
                  key={i}
                  className="mb-3 animate-pulse break-inside-avoid rounded-xl bg-[#F4F4F5]"
                  style={{ height: `${h * 4}px` }}
                />
              ))}
            </div>
          )}
          {!loading && pins.length > 0 && (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={scope}
                variants={stage}
                initial="hidden"
                animate="show"
                exit={{ opacity: 0, transition: { duration: calm ? 0 : 0.12 } }}
                className="mt-6 columns-2 gap-3 sm:columns-3 lg:columns-4 xl:columns-5"
              >
                {pins.map((p, i) => {
                  const ratio = p.width && p.height ? p.width / p.height : 3 / 4;
                  return (
                    <motion.figure key={p.id} variants={rise} className="group mb-3 break-inside-avoid">
                      <button
                        type="button"
                        onClick={() => goTo(i)}
                        aria-label="Agrandir"
                        className="relative block w-full overflow-hidden rounded-xl bg-[#FAFAFA]"
                        style={{ aspectRatio: ratio }}
                      >
                        {p.kind === 'video' ? (
                          <video
                            src={`${p.url}#t=0.1`}
                            preload="metadata"
                            muted
                            playsInline
                            className="absolute inset-0 size-full object-cover transition duration-300 group-hover:scale-[1.03]"
                          />
                        ) : (
                          <img
                            src={p.url}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            draggable={false}
                            className="absolute inset-0 size-full object-cover transition duration-300 group-hover:scale-[1.03]"
                          />
                        )}
                        {p.mine && (
                          <span className="absolute right-2 top-2 rounded-md bg-[#171717] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-white">
                            toi
                          </span>
                        )}
                        {p.kind === 'video' && (
                          <>
                            <svg
                              aria-hidden
                              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/90 drop-shadow"
                              width="26" height="26" viewBox="0 0 24 24" fill="none"
                            >
                              <circle cx="12" cy="12" r="9.2" stroke="currentColor" strokeWidth="1.2" />
                              <path d="M10.4 8.8 15.6 12l-5.2 3.2V8.8Z" fill="currentColor" />
                            </svg>
                            {clip(p.durationMs) && (
                              <span className="absolute left-2 top-2 rounded-md bg-[#171717]/70 px-1.5 py-0.5 font-mono text-[9px] tabular-nums text-white backdrop-blur">
                                {clip(p.durationMs)}
                              </span>
                            )}
                          </>
                        )}
                        {p.author && (
                          <span className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-linear-to-t from-black/65 to-transparent px-2.5 pb-2 pt-8 opacity-0 transition duration-200 group-hover:opacity-100">
                            <Avatar author={p.author} />
                            <span className="min-w-0 flex-1 truncate text-left font-mono text-[10px] text-white/85">
                              @{p.author.username}
                            </span>
                          </span>
                        )}
                      </button>
                    </motion.figure>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          )}
          {empty && (
            <div className="mt-6 rounded-xl border border-[#EAEAEA] bg-white/85 px-6 py-10 backdrop-blur-xl">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#A1A1A1]">
                {pioneer ? 'Premiers jours' : 'Rien à afficher'}
              </p>
              <p className="mt-2 text-[17px] font-medium tracking-[-0.02em] text-[#171717]">
                {scope === 'following'
                  ? 'Les comptes que tu suis n’ont encore rien en vitrine.'
                  : 'Le fil se remplit dès qu’une photo est mise en vitrine.'}
              </p>
              <p className="mt-1.5 max-w-lg text-[13px] leading-relaxed text-[#666]">
                Ta bibliothèque reste privée. Une photo n’arrive ici qu’au moment où tu la publies sur
                ta vitrine.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link
                  href="/auth/library"
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#171717] px-4 text-[13px] font-medium text-white transition hover:bg-[#383838]"
                >
                  Ouvrir ma bibliothèque
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
                {scope === 'following' && (
                  <button
                    type="button"
                    onClick={() => setScope('all')}
                    className="inline-flex h-10 items-center rounded-lg border border-[#EAEAEA] bg-white px-4 text-[13px] font-medium text-[#171717] transition hover:border-[#D4D4D4]"
                  >
                    Voir tout
                  </button>
                )}
              </div>
            </div>
          )}
          <div ref={sentinel} aria-hidden className="h-px" />
          {loadingMore && (
            <div className="mt-6 columns-2 gap-3 sm:columns-3 lg:columns-4 xl:columns-5">
              {[48, 36, 52, 40, 44].map((h, i) => (
                <div
                  key={i}
                  className="mb-3 animate-pulse break-inside-avoid rounded-xl bg-[#F4F4F5]"
                  style={{ height: `${h * 4}px` }}
                />
              ))}
            </div>
          )}
          {!loading && !loadingMore && !cursor && pins.length > 0 && (
            <p className="mt-10 text-center font-mono text-[11px] text-[#A1A1A1]">Tu as tout vu</p>
          )}
          {!empty && mineEmpty && (
            <div className="mt-10 flex flex-wrap items-center gap-3 rounded-xl border border-[#EAEAEA] bg-white/85 px-5 py-4 backdrop-blur-xl">
              <p className="min-w-56 flex-1 text-[13px] leading-relaxed text-[#666]">
                Tu n’as encore rien en vitrine. Publie depuis ta bibliothèque pour apparaître ici.
              </p>
              <Link
                href="/auth/library"
                className="inline-flex h-9 shrink-0 items-center rounded-lg bg-[#171717] px-3.5 text-[13px] font-medium text-white transition hover:bg-[#383838]"
              >
                Ouvrir ma bibliothèque
              </Link>
            </div>
          )}
        </div>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: calm ? 0 : 0.18 }}
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex flex-col bg-[#09090B]/92 backdrop-blur-sm"
            onClick={() => setViewer(null)}
          >
            <div className="flex items-center gap-3 px-4 py-3">
              {open.author && (
                <>
                  <Avatar author={open.author} size={28} />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-white">{open.author.name}</p>
                    <p className="truncate font-mono text-[11px] text-white/60">
                      @{open.author.username}
                      {ago(open.publishedAt) ? ` · ${ago(open.publishedAt)}` : ''}
                    </p>
                  </div>
                  {!open.author.self && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (open.author) void toggleFollow(open.author);
                      }}
                      aria-pressed={open.author.following}
                      className={`ml-2 h-8 shrink-0 rounded-lg border px-3 text-[12px] font-medium transition ${open.author.following
                        ? 'border-white/25 bg-transparent text-white/80 hover:text-white'
                        : 'border-white bg-white text-[#171717] hover:bg-white/90'
                        }`}
                    >
                      {open.author.following ? 'Suivi' : 'Suivre'}
                    </button>
                  )}
                </>
              )}
              <div className="ml-auto flex items-center gap-1">
                <Link
                  href={open.mine ? '/auth/profile' : `${SITE}/u/?u=${open.author?.username ?? ''}`}
                  {...(open.mine ? {} : { target: '_blank', rel: 'noreferrer' })}
                  onClick={(e) => e.stopPropagation()}
                  className="h-8 rounded-lg border border-white/20 px-3 text-[12px] font-medium leading-8 text-white/80 transition hover:border-white/50 hover:text-white"
                >
                  Voir la vitrine
                </Link>
                <button
                  type="button"
                  onClick={() => setViewer(null)}
                  aria-label="Fermer"
                  className="grid size-8 place-items-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-6">
              <button
                type="button"
                disabled={viewer === 0}
                onClick={(e) => {
                  e.stopPropagation();
                  goTo((viewer ?? 0) - 1);
                }}
                aria-label="Précédent"
                className="absolute left-2 grid size-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-0"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {open.kind === 'video' ? (
                <video
                  key={open.id}
                  src={open.url}
                  controls
                  autoPlay
                  playsInline
                  onClick={(e) => e.stopPropagation()}
                  className="max-h-full max-w-full rounded-xl"
                />
              ) : (
                <img
                  key={open.id}
                  src={open.url}
                  alt=""
                  onClick={(e) => e.stopPropagation()}
                  className="max-h-full max-w-full rounded-xl object-contain"
                />
              )}
              <button
                type="button"
                disabled={viewer === pins.length - 1 && !cursor}
                onClick={(e) => {
                  e.stopPropagation();
                  goTo((viewer ?? 0) + 1);
                }}
                aria-label="Suivant"
                className="absolute right-2 grid size-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-0"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {toast && (
          <motion.p
            role="status"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: calm ? 0 : 0.2, ease: EASE }}
            className="pointer-events-none fixed inset-x-0 bottom-4 z-60 mx-auto w-fit rounded-lg bg-[#171717] px-3 py-1.5 text-[12px] text-white"
          >
            {toast}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}